import type { Invoice } from "../billing/types";
import type { Vehicle } from "../fleet/types";
import type { WorkOrder } from "../maintenance/types";
import type { Contract } from "../rentals/types";
import { DAY } from "../shared/dates";
import type { Millimes } from "../shared/money";

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export type FleetMetrics = {
  vehicleDays: number; // fleet capacity in the period (excluding hors service)
  rentedDays: number;
  maintenanceDays: number;
  utilization: number; // 0..1
  downtime: number; // 0..1
  revenue: Millimes; // HT, invoices issued in period
  revPav: Millimes; // revenue per available vehicle-day
};

export function fleetMetrics(params: {
  from: Date;
  to: Date;
  now: Date;
  vehicles: Vehicle[];
  contracts: Contract[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  vehicleIds?: Set<string>;
}): FleetMetrics {
  const from = params.from.getTime();
  const to = Math.min(params.to.getTime(), Math.max(params.now.getTime(), from));
  const inScope = (id: string) => !params.vehicleIds || params.vehicleIds.has(id);
  const fleet = params.vehicles.filter((v) => v.status !== "hors_service" && inScope(v.id));
  const ids = new Set(fleet.map((v) => v.id));

  const vehicleDays = (fleet.length * Math.max(0, to - from)) / DAY;

  let rentedMs = 0;
  for (const c of params.contracts) {
    if (!ids.has(c.vehicleId) || c.status === "annulee" || c.status === "reservee") continue;
    const start = new Date(c.checkout?.at ?? c.startAt).getTime();
    const end = c.checkin ? new Date(c.checkin.at).getTime() : params.now.getTime();
    rentedMs += overlapMs(start, end, from, to);
  }

  let maintenanceMs = 0;
  for (const w of params.workOrders) {
    if (!ids.has(w.vehicleId) || !w.immobilizing) continue;
    const start = new Date(w.openedAt).getTime();
    const end = w.closedAt ? new Date(w.closedAt).getTime() : params.now.getTime();
    maintenanceMs += overlapMs(start, end, from, to);
  }

  const revenue = params.invoices
    .filter((i) => {
      if (i.status === "annulee") return false;
      const t = new Date(i.issuedAt).getTime();
      if (t < from || t >= params.to.getTime()) return false;
      if (!params.vehicleIds) return true;
      const contract = params.contracts.find((c) => c.id === i.contractId);
      return contract ? ids.has(contract.vehicleId) : false;
    })
    .reduce((sum, i) => sum + i.subtotal, 0);

  const rentedDays = rentedMs / DAY;
  const maintenanceDays = maintenanceMs / DAY;

  return {
    vehicleDays,
    rentedDays,
    maintenanceDays,
    utilization: vehicleDays > 0 ? Math.min(1, rentedDays / vehicleDays) : 0,
    downtime: vehicleDays > 0 ? Math.min(1, maintenanceDays / vehicleDays) : 0,
    revenue,
    revPav: vehicleDays > 0 ? Math.round(revenue / vehicleDays) : 0,
  };
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}
