import type { Vehicle } from "../fleet/types";
import type { WorkOrder } from "../maintenance/types";
import { overlaps } from "../shared/dates";
import type { Contract } from "./types";

export const BLOCKING_STATUSES = new Set<Contract["status"]>(["reservee", "en_cours"]);
/** An overdue rental blocks the car for at least this long after now (check-out also requires the car to be back). */
export const OVERDUE_BUFFER_MS = 24 * 60 * 60 * 1000;

export type AvailabilityResult =
  | { ok: true }
  | { ok: false; reason: "hors_service" | "immobilise" | "conflit"; message: string; conflict?: Contract };

/**
 * Whether a vehicle can be booked for [start, end). An overdue active rental keeps blocking
 * the next 24 hours, because the car has not come back yet.
 */
export function checkAvailability(params: {
  vehicle: Vehicle;
  start: Date;
  end: Date;
  contracts: Contract[];
  workOrders: WorkOrder[];
  now: Date;
  excludeContractId?: string;
}): AvailabilityResult {
  const { vehicle, start, end, now } = params;

  if (vehicle.status === "hors_service") {
    return { ok: false, reason: "hors_service", message: "Ce véhicule est hors service." };
  }

  const immobilized = params.workOrders.some(
    (w) => w.vehicleId === vehicle.id && w.immobilizing && w.status !== "termine",
  );
  if (immobilized) {
    return { ok: false, reason: "immobilise", message: "Ce véhicule est immobilisé pour entretien." };
  }

  for (const c of params.contracts) {
    if (c.vehicleId !== vehicle.id || c.id === params.excludeContractId || !BLOCKING_STATUSES.has(c.status)) continue;
    const cStart = new Date(c.startAt);
    let cEnd = new Date(c.endAt);
    // Overdue: the return time is unknown, so keep a rolling buffer ahead of now.
    if (c.status === "en_cours" && cEnd < now) cEnd = new Date(now.getTime() + OVERDUE_BUFFER_MS);
    if (overlaps(start, end, cStart, cEnd)) {
      return {
        ok: false,
        reason: "conflit",
        message: `Déjà réservé sur cette période (contrat ${c.number}).`,
        conflict: c,
      };
    }
  }

  return { ok: true };
}
