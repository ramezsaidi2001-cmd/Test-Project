import "server-only";
import { invoiceBalance, isOverdue } from "@/domain/billing/invoice";
import type { PaymentMethod } from "@/domain/billing/types";
import { vehicleAlerts } from "@/domain/fleet/alerts";
import { fleetMetrics } from "@/domain/reports/metrics";
import { addDays, tunisDay } from "@/domain/shared/dates";
import { customerName, scope } from "@/server/core";
import { getTenantData } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

/** First instant of a month (YYYY-MM) in Tunis time. */
function monthStart(month: string) {
  return new Date(`${month}-01T00:00:00+01:00`);
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Dashboard: visible to every role; each block is filtered in the page by permission. */
export function dashboard(ctx: TenantContext) {
  const data = getTenantData(ctx.tenant.id, ctx.tenant.name);
  const now = new Date();
  const today = tunisDay(now);
  const month = today.slice(0, 7);

  const byStatus = { disponible: 0, loue: 0, maintenance: 0, hors_service: 0 };
  for (const v of data.vehicles) byStatus[v.status]++;
  const activeFleet = data.vehicles.length - byStatus.hors_service;

  const withRefs = (c: (typeof data.contracts)[number]) => ({
    contract: c,
    customerName: customerName(data.customers.find((x) => x.id === c.customerId)!),
    vehicle: data.vehicles.find((v) => v.id === c.vehicleId)!,
  });

  const departures = data.contracts.filter((c) => c.status === "reservee" && tunisDay(c.startAt) <= today).map(withRefs);
  const returns = data.contracts.filter((c) => c.status === "en_cours" && tunisDay(c.endAt) === today).map(withRefs);
  const overdue = data.contracts.filter((c) => c.status === "en_cours" && new Date(c.endAt) < now).map(withRefs);
  const toClose = data.contracts.filter((c) => c.status === "retournee").map(withRefs);

  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i - 5);
    const total = data.invoices
      .filter((inv) => inv.status !== "annulee" && tunisDay(inv.issuedAt).startsWith(m))
      .reduce((s, inv) => s + inv.subtotal, 0);
    return { month: m, total };
  });

  const monthMetrics = fleetMetrics({
    from: monthStart(month),
    to: monthStart(shiftMonth(month, 1)),
    now,
    vehicles: data.vehicles,
    contracts: data.contracts,
    workOrders: data.workOrders,
    invoices: data.invoices,
  });

  const active = data.invoices.filter((i) => i.status !== "annulee");
  return {
    byStatus,
    activeFleet,
    utilizationNow: activeFleet > 0 ? byStatus.loue / activeFleet : 0,
    monthMetrics,
    departures,
    returns,
    overdue,
    toClose,
    revenueByMonth,
    outstanding: active.reduce((s, i) => s + invoiceBalance(i), 0),
    overdueInvoices: active.filter((i) => isOverdue(i, now)).length,
    alerts: data.vehicles.flatMap((vehicle) => vehicleAlerts(vehicle, now).map((a) => ({ ...a, vehicle }))),
    upcoming: data.contracts
      .filter((c) => c.status === "reservee" && new Date(c.startAt) > now && new Date(c.startAt) < addDays(now, 7))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 8)
      .map(withRefs),
  };
}

export function monthlyReport(ctx: TenantContext, month: string) {
  const data = scope(ctx, "reports.view");
  const now = new Date();
  const from = monthStart(month);
  const to = monthStart(shiftMonth(month, 1));
  const base = { now, vehicles: data.vehicles, contracts: data.contracts, workOrders: data.workOrders, invoices: data.invoices };

  const overall = fleetMetrics({ ...base, from, to });
  const previous = fleetMetrics({ ...base, from: monthStart(shiftMonth(month, -1)), to: from });

  const byCategory = data.categories.map((category) => {
    const ids = new Set(data.vehicles.filter((v) => v.categoryId === category.id).map((v) => v.id));
    return { category, count: ids.size, metrics: fleetMetrics({ ...base, from, to, vehicleIds: ids }) };
  });

  const byVehicle = data.vehicles
    .map((vehicle) => {
      const metrics = fleetMetrics({ ...base, from, to, vehicleIds: new Set([vehicle.id]) });
      const maintenanceCost = data.workOrders
        .filter((w) => w.vehicleId === vehicle.id && w.closedAt && w.closedAt >= from.toISOString() && w.closedAt < to.toISOString())
        .reduce((s, w) => s + w.partsCost + w.laborCost, 0);
      return { vehicle, metrics, maintenanceCost, margin: metrics.revenue - maintenanceCost };
    })
    .sort((a, b) => b.metrics.revenue - a.metrics.revenue);

  const trend = Array.from({ length: 12 }, (_, i) => {
    const m = shiftMonth(month, i - 11);
    const metrics = fleetMetrics({ ...base, from: monthStart(m), to: monthStart(shiftMonth(m, 1)) });
    return { month: m, revenue: metrics.revenue, utilization: metrics.utilization };
  });

  const payments: Record<PaymentMethod, number> = { especes: 0, carte: 0, cheque: 0, virement: 0, d17: 0 };
  for (const inv of data.invoices) {
    for (const p of inv.payments) if (p.at >= from.toISOString() && p.at < to.toISOString()) payments[p.method] += p.amount;
  }

  const maintenanceCost = data.workOrders
    .filter((w) => w.closedAt && w.closedAt >= from.toISOString() && w.closedAt < to.toISOString())
    .reduce((s, w) => s + w.partsCost + w.laborCost, 0);

  return { month, overall, previous, byCategory, byVehicle, trend, payments, maintenanceCost, prevMonth: shiftMonth(month, -1), nextMonth: shiftMonth(month, 1) };
}

export function currentMonth() {
  return tunisDay(new Date()).slice(0, 7);
}
