import type { FuelLevel } from "../fleet/types";
import type { Millimes } from "../shared/money";

export type ContractStatus = "reservee" | "en_cours" | "retournee" | "cloturee" | "annulee";
export type DepositMethod = "especes" | "carte" | "cheque";
export type DepositStatus = "en_attente" | "bloquee" | "restituee" | "retenue";

export type SeasonalRate = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string; // YYYY-MM-DD inclusive
  /** Adjustment in basis points: 3000 = +30 %, -1500 = -15 %. */
  adjustmentBp: number;
};

export type RentalExtra = {
  id: string;
  name: string;
  pricing: "par_jour" | "forfait";
  price: Millimes; // HT
  active: boolean;
};

export type PriceLine = {
  label: string;
  quantity: number;
  unitPrice: Millimes; // HT
  total: Millimes; // HT
  kind: "location" | "saison" | "option" | "km_sup" | "retard" | "carburant" | "dommage" | "remise";
};

/** Frozen at booking time so later rate changes never alter past contracts. */
export type RateSnapshot = {
  categoryName: string;
  days: number;
  dailyRate: Millimes;
  kmPerDay: number | null;
  extraKmRate: Millimes;
  deposit: Millimes;
  tvaBp: number;
  timbre: Millimes;
  lines: PriceLine[];
  subtotal: Millimes; // HT
  tva: Millimes;
  total: Millimes; // TTC incl. timbre
};

export type Inspection = {
  at: string;
  km: number;
  fuelLevel: FuelLevel;
  notes: string | null;
  recordedBy: string;
};

export type Damage = { description: string; cost: Millimes };

export type Contract = {
  id: string;
  tenantId: string;
  number: string; // CT-2026-0001
  customerId: string;
  vehicleId: string;
  pickupBranchId: string;
  returnBranchId: string;
  startAt: string;
  endAt: string;
  status: ContractStatus;
  extras: { extraId: string; quantity: number }[];
  additionalDriver: string | null;
  rate: RateSnapshot;
  depositMethod: DepositMethod;
  depositStatus: DepositStatus;
  checkout: Inspection | null;
  checkin: (Inspection & { damages: Damage[] }) | null;
  signature: { name: string; image: string; at: string } | null;
  invoiceId: string | null;
  notes: string | null;
  cancelledReason: string | null;
  createdBy: string;
  createdAt: string;
};
