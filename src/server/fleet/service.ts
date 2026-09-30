import "server-only";
import { vehicleAlerts, type FleetAlert } from "@/domain/fleet/alerts";
import type { FuelLevel, Vehicle, VehicleDocuments } from "@/domain/fleet/types";
import { fleetMetrics } from "@/domain/reports/metrics";
import { addDays } from "@/domain/shared/dates";
import type { Millimes } from "@/domain/shared/money";
import { customerName, fail, scope, type Result } from "@/server/core";
import { newId } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

export type VehicleFilters = { q?: string; status?: string; categoryId?: string; branchId?: string };

export function listVehicles(ctx: TenantContext, filters: VehicleFilters = {}) {
  const data = scope(ctx, "fleet.view");
  const now = new Date();
  const q = filters.q?.trim().toLowerCase();

  return data.vehicles
    .filter((v) => !filters.status || v.status === filters.status)
    .filter((v) => !filters.categoryId || v.categoryId === filters.categoryId)
    .filter((v) => !filters.branchId || v.branchId === filters.branchId)
    .filter((v) => !q || `${v.plate} ${v.make} ${v.model} ${v.vin}`.toLowerCase().includes(q))
    .map((vehicle) => ({
      vehicle,
      category: data.categories.find((c) => c.id === vehicle.categoryId)!,
      branch: data.branches.find((b) => b.id === vehicle.branchId)!,
      alerts: vehicleAlerts(vehicle, now),
      activeContract: data.contracts.find((c) => c.vehicleId === vehicle.id && c.status === "en_cours") ?? null,
    }))
    .sort((a, b) => a.vehicle.plate.localeCompare(b.vehicle.plate));
}

export function getVehicleDetail(ctx: TenantContext, id: string) {
  const data = scope(ctx, "fleet.view");
  const vehicle = data.vehicles.find((v) => v.id === id);
  if (!vehicle) return null;
  const now = new Date();

  const contracts = data.contracts
    .filter((c) => c.vehicleId === id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .map((contract) => {
      const customer = data.customers.find((c) => c.id === contract.customerId)!;
      return { contract, customerName: customerName(customer) };
    });
  const workOrders = data.workOrders.filter((w) => w.vehicleId === id).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const logs = data.mileageLogs.filter((l) => l.vehicleId === id).sort((a, b) => b.at.localeCompare(a.at));

  const contractIds = new Set(contracts.map((c) => c.contract.id));
  const revenue = data.invoices
    .filter((i) => i.status !== "annulee" && i.contractId && contractIds.has(i.contractId))
    .reduce((s, i) => s + i.subtotal, 0);
  const maintenanceCost = workOrders.reduce((s, w) => s + w.partsCost + w.laborCost, 0);
  const firstKm = logs.at(-1)?.km ?? vehicle.mileage;
  const kmDriven = vehicle.mileage - firstKm;
  const last90 = fleetMetrics({
    from: addDays(now, -90),
    to: now,
    now,
    vehicles: data.vehicles,
    contracts: data.contracts,
    workOrders: data.workOrders,
    invoices: data.invoices,
    vehicleIds: new Set([id]),
  });

  return {
    vehicle,
    category: data.categories.find((c) => c.id === vehicle.categoryId)!,
    branch: data.branches.find((b) => b.id === vehicle.branchId)!,
    alerts: vehicleAlerts(vehicle, now),
    contracts,
    workOrders,
    logs,
    stats: {
      revenue,
      maintenanceCost,
      kmDriven,
      /** Maintenance cost per km driven over the tracked period. */
      costPerKm: kmDriven > 0 ? Math.round(maintenanceCost / kmDriven) : 0,
      utilization90: last90.utilization,
      /** Simple TCO: acquisition + maintenance. */
      tco: vehicle.acquisitionCost + maintenanceCost,
    },
  };
}

export function listFleetReferenceData(ctx: TenantContext) {
  const data = scope(ctx, "fleet.view");
  return { categories: data.categories, branches: data.branches };
}

export function listFleetAlerts(ctx: TenantContext): (FleetAlert & { vehicle: Vehicle })[] {
  const data = scope(ctx, "fleet.view");
  const now = new Date();
  return data.vehicles
    .flatMap((vehicle) => vehicleAlerts(vehicle, now).map((a) => ({ ...a, vehicle })))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));
}

export type VehicleInput = {
  plate: string;
  vin: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  color: string;
  categoryId: string;
  fuel: Vehicle["fuel"];
  transmission: Vehicle["transmission"];
  seats: number;
  branchId: string;
  mileage: number;
  serviceIntervalKm: number;
  nextServiceKm: number;
  acquisitionDate: string;
  acquisitionCost: Millimes;
  gpsDeviceId: string | null;
  documents: VehicleDocuments;
};

function normalizePlate(plate: string) {
  return plate.toUpperCase().replace(/\s+/g, " ").trim();
}

function validateRefs(ctx: TenantContext, input: VehicleInput, excludeId?: string): Result {
  const data = scope(ctx, "fleet.manage");
  const plate = normalizePlate(input.plate);
  if (data.vehicles.some((v) => v.id !== excludeId && normalizePlate(v.plate) === plate)) {
    return fail("Un véhicule avec cette immatriculation existe déjà.", "plate");
  }
  if (data.vehicles.some((v) => v.id !== excludeId && v.vin.toUpperCase() === input.vin.toUpperCase())) {
    return fail("Un véhicule avec ce numéro de châssis (VIN) existe déjà.", "vin");
  }
  if (!data.categories.some((c) => c.id === input.categoryId)) return fail("Catégorie inconnue.", "categoryId");
  if (!data.branches.some((b) => b.id === input.branchId)) return fail("Agence inconnue.", "branchId");
  return { ok: true };
}

export function createVehicle(ctx: TenantContext, input: VehicleInput): Result<{ id: string }> {
  const data = scope(ctx, "fleet.manage");
  const check = validateRefs(ctx, input);
  if (!check.ok) return check;

  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    ...input,
    id: newId("veh"),
    tenantId: ctx.tenant.id,
    plate: normalizePlate(input.plate),
    vin: input.vin.toUpperCase(),
    status: "disponible",
    fuelLevel: 8,
    createdAt: now,
  };
  data.vehicles.push(vehicle);
  data.mileageLogs.push({
    id: newId("mil"),
    tenantId: ctx.tenant.id,
    vehicleId: vehicle.id,
    at: now,
    km: vehicle.mileage,
    fuelLevel: 8,
    source: "manuel",
    reference: "Mise en service",
    note: null,
    recordedBy: ctx.user.name,
  });
  return { ok: true, id: vehicle.id };
}

/** Mileage is not editable here: it only moves forward through the append-only log. */
export function updateVehicle(ctx: TenantContext, id: string, input: Omit<VehicleInput, "mileage">): Result {
  const data = scope(ctx, "fleet.manage");
  const vehicle = data.vehicles.find((v) => v.id === id);
  if (!vehicle) return fail("Véhicule introuvable.");
  const check = validateRefs(ctx, { ...input, mileage: vehicle.mileage }, id);
  if (!check.ok) return check;
  Object.assign(vehicle, { ...input, plate: normalizePlate(input.plate), vin: input.vin.toUpperCase() });
  return { ok: true };
}

export function setOutOfService(ctx: TenantContext, id: string, outOfService: boolean): Result {
  const data = scope(ctx, "fleet.manage");
  const vehicle = data.vehicles.find((v) => v.id === id);
  if (!vehicle) return fail("Véhicule introuvable.");
  if (outOfService) {
    if (vehicle.status === "loue") return fail("Impossible : le véhicule est actuellement en location.");
    const upcoming = data.contracts.some((c) => c.vehicleId === id && c.status === "reservee");
    if (upcoming) return fail("Impossible : des réservations à venir existent pour ce véhicule. Réaffectez-les d'abord.");
    vehicle.status = "hors_service";
  } else {
    if (vehicle.status !== "hors_service") return { ok: true };
    const immobilized = data.workOrders.some((w) => w.vehicleId === id && w.immobilizing && w.status !== "termine");
    vehicle.status = immobilized ? "maintenance" : "disponible";
  }
  return { ok: true };
}

export function recordMileage(
  ctx: TenantContext,
  id: string,
  input: { km: number; fuelLevel: FuelLevel; note: string | null },
): Result {
  const data = scope(ctx, "fleet.manage");
  const vehicle = data.vehicles.find((v) => v.id === id);
  if (!vehicle) return fail("Véhicule introuvable.");
  if (input.km < vehicle.mileage) {
    return fail(`Le kilométrage ne peut pas diminuer (actuel : ${vehicle.mileage.toLocaleString("fr-FR")} km).`, "km");
  }
  data.mileageLogs.push({
    id: newId("mil"),
    tenantId: ctx.tenant.id,
    vehicleId: id,
    at: new Date().toISOString(),
    km: input.km,
    fuelLevel: input.fuelLevel,
    source: "manuel",
    reference: null,
    note: input.note,
    recordedBy: ctx.user.name,
  });
  vehicle.mileage = input.km;
  vehicle.fuelLevel = input.fuelLevel;
  return { ok: true };
}
