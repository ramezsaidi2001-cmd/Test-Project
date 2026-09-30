import "server-only";
import { vehicleAlerts } from "@/domain/fleet/alerts";
import type { WorkOrder, WorkOrderType } from "@/domain/maintenance/types";
import { addDays } from "@/domain/shared/dates";
import type { Millimes } from "@/domain/shared/money";
import { fail, scope, type Result } from "@/server/core";
import { newId, nextNumber } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

export type WorkOrderFilters = { status?: string; type?: string; vehicleId?: string };

export function listWorkOrders(ctx: TenantContext, filters: WorkOrderFilters = {}) {
  const data = scope(ctx, "maintenance.view");
  return data.workOrders
    .filter((w) => !filters.status || w.status === filters.status)
    .filter((w) => !filters.type || w.type === filters.type)
    .filter((w) => !filters.vehicleId || w.vehicleId === filters.vehicleId)
    .map((workOrder) => ({ workOrder, vehicle: data.vehicles.find((v) => v.id === workOrder.vehicleId)! }))
    .sort((a, b) => {
      const open = (w: WorkOrder) => (w.status === "termine" ? 1 : 0);
      return open(a.workOrder) - open(b.workOrder) || b.workOrder.openedAt.localeCompare(a.workOrder.openedAt);
    });
}

export function getWorkOrder(ctx: TenantContext, id: string) {
  const data = scope(ctx, "maintenance.view");
  const workOrder = data.workOrders.find((w) => w.id === id);
  if (!workOrder) return null;
  const vehicle = data.vehicles.find((v) => v.id === workOrder.vehicleId)!;
  const contract = workOrder.contractId ? (data.contracts.find((c) => c.id === workOrder.contractId) ?? null) : null;
  return { workOrder, vehicle, contract };
}

/** Service schedule: every active vehicle with km to next service and document deadlines. */
export function serviceSchedule(ctx: TenantContext) {
  const data = scope(ctx, "maintenance.view");
  const now = new Date();
  return data.vehicles
    .filter((v) => v.status !== "hors_service")
    .map((vehicle) => ({
      vehicle,
      kmLeft: vehicle.nextServiceKm - vehicle.mileage,
      alerts: vehicleAlerts(vehicle, now),
      openOrder: data.workOrders.find((w) => w.vehicleId === vehicle.id && w.status !== "termine") ?? null,
    }))
    .sort((a, b) => a.kmLeft - b.kmLeft);
}

export function maintenanceSummary(ctx: TenantContext) {
  const data = scope(ctx, "maintenance.view");
  const since = addDays(new Date(), -365).toISOString();
  const closedYear = data.workOrders.filter((w) => w.status === "termine" && (w.closedAt ?? "") >= since);
  return {
    open: data.workOrders.filter((w) => w.status !== "termine").length,
    immobilized: data.vehicles.filter((v) => v.status === "maintenance").length,
    costYear: closedYear.reduce((s, w) => s + w.partsCost + w.laborCost, 0),
    serviceDue: data.vehicles.filter((v) => v.status !== "hors_service" && v.nextServiceKm - v.mileage <= 1000).length,
  };
}

export type WorkOrderInput = {
  vehicleId: string;
  type: WorkOrderType;
  description: string;
  vendor: string;
  immobilizing: boolean;
  partsCost: Millimes;
  laborCost: Millimes;
  notes: string | null;
};

export function createWorkOrder(ctx: TenantContext, input: WorkOrderInput): Result<{ id: string }> {
  const data = scope(ctx, "maintenance.manage");
  const vehicle = data.vehicles.find((v) => v.id === input.vehicleId);
  if (!vehicle) return fail("Sélectionnez un véhicule.", "vehicleId");
  if (input.immobilizing && vehicle.status === "loue") {
    return fail("Le véhicule est en location : il ne peut pas être immobilisé avant son retour.", "immobilizing");
  }

  const now = new Date();
  const workOrder: WorkOrder = {
    ...input,
    id: newId("wo"),
    tenantId: ctx.tenant.id,
    number: nextNumber(data, "OT", now),
    status: "ouvert",
    openedAt: now.toISOString(),
    closedAt: null,
    kmAtOpen: vehicle.mileage,
    contractId: null,
  };
  data.workOrders.push(workOrder);
  if (input.immobilizing && vehicle.status === "disponible") vehicle.status = "maintenance";
  return { ok: true, id: workOrder.id };
}

export function startWorkOrder(ctx: TenantContext, id: string): Result {
  const data = scope(ctx, "maintenance.manage");
  const workOrder = data.workOrders.find((w) => w.id === id);
  if (!workOrder) return fail("Ordre de travail introuvable.");
  if (workOrder.status !== "ouvert") return fail("Cet ordre de travail n'est pas au statut « Ouvert ».");
  workOrder.status = "en_cours";
  return { ok: true };
}

export function updateWorkOrderCosts(
  ctx: TenantContext,
  id: string,
  input: { vendor: string; partsCost: Millimes; laborCost: Millimes; notes: string | null },
): Result {
  const data = scope(ctx, "maintenance.manage");
  const workOrder = data.workOrders.find((w) => w.id === id);
  if (!workOrder) return fail("Ordre de travail introuvable.");
  if (workOrder.status === "termine") return fail("Un ordre de travail terminé ne peut plus être modifié.");
  Object.assign(workOrder, input);
  return { ok: true };
}

export function completeWorkOrder(
  ctx: TenantContext,
  id: string,
  input: { km: number; partsCost: Millimes; laborCost: Millimes; notes: string | null },
): Result {
  const data = scope(ctx, "maintenance.manage");
  const workOrder = data.workOrders.find((w) => w.id === id);
  if (!workOrder) return fail("Ordre de travail introuvable.");
  if (workOrder.status === "termine") return fail("Cet ordre de travail est déjà terminé.");
  const vehicle = data.vehicles.find((v) => v.id === workOrder.vehicleId)!;
  if (input.km < vehicle.mileage) {
    return fail(`Kilométrage inférieur au dernier relevé (${vehicle.mileage.toLocaleString("fr-FR")} km).`, "km");
  }

  const now = new Date();
  Object.assign(workOrder, {
    status: "termine",
    closedAt: now.toISOString(),
    partsCost: input.partsCost,
    laborCost: input.laborCost,
    notes: input.notes ?? workOrder.notes,
  });

  if (input.km > vehicle.mileage || workOrder.type === "entretien_preventif") {
    data.mileageLogs.push({
      id: newId("mil"),
      tenantId: ctx.tenant.id,
      vehicleId: vehicle.id,
      at: now.toISOString(),
      km: input.km,
      fuelLevel: vehicle.fuelLevel,
      source: "entretien",
      reference: workOrder.number,
      note: null,
      recordedBy: ctx.user.name,
    });
    vehicle.mileage = input.km;
  }
  if (workOrder.type === "entretien_preventif") {
    vehicle.nextServiceKm = input.km + vehicle.serviceIntervalKm;
  }
  if (workOrder.type === "visite_technique") {
    vehicle.documents.technicalInspectionExpiry = addDays(now, 365).toISOString();
  }

  const stillImmobilized = data.workOrders.some(
    (w) => w.vehicleId === vehicle.id && w.immobilizing && w.status !== "termine",
  );
  if (vehicle.status === "maintenance" && !stillImmobilized) vehicle.status = "disponible";
  return { ok: true };
}
