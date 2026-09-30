import type { Millimes } from "../shared/money";

export type WorkOrderType = "entretien_preventif" | "reparation" | "carrosserie" | "pneumatiques" | "visite_technique";
export type WorkOrderStatus = "ouvert" | "en_cours" | "termine";

export type WorkOrder = {
  id: string;
  tenantId: string;
  number: string; // OT-2026-0001
  vehicleId: string;
  type: WorkOrderType;
  description: string;
  status: WorkOrderStatus;
  /** Vehicle is taken out of service while the order is open. */
  immobilizing: boolean;
  vendor: string;
  openedAt: string;
  closedAt: string | null;
  kmAtOpen: number;
  partsCost: Millimes;
  laborCost: Millimes;
  contractId: string | null; // damage reported on return
  notes: string | null;
};
