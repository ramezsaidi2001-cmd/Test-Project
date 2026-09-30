import type { Millimes } from "../shared/money";

export type VehicleStatus = "disponible" | "loue" | "maintenance" | "hors_service";
export type FuelType = "essence" | "diesel" | "hybride" | "electrique";
export type Transmission = "manuelle" | "automatique";
/** Fuel level in eighths of a tank (0 = empty, 8 = full). */
export type FuelLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Branch = {
  id: string;
  name: string;
  city: string;
  kind: "agence" | "aeroport";
  address: string;
  phone: string;
};

export type VehicleCategory = {
  id: string;
  code: string;
  name: string;
  /** Daily rate HT for 1–6 days. */
  dailyRate: Millimes;
  /** Daily rate HT applied when the rental lasts 7 days or more. */
  weeklyDailyRate: Millimes;
  deposit: Millimes;
  /** Included kilometres per day; null = unlimited. */
  kmPerDay: number | null;
  extraKmRate: Millimes;
};

export type VehicleDocuments = {
  registrationNumber: string; // carte grise
  insurer: string;
  insuranceExpiry: string; // ISO date
  technicalInspectionExpiry: string; // visite technique
  vignetteExpiry: string; // vignette / taxe de circulation
};

export type Vehicle = {
  id: string;
  tenantId: string;
  plate: string; // e.g. "245 TU 1234"
  vin: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  color: string;
  categoryId: string;
  fuel: FuelType;
  transmission: Transmission;
  seats: number;
  status: VehicleStatus;
  branchId: string;
  mileage: number; // denormalized from the latest mileage log
  fuelLevel: FuelLevel;
  serviceIntervalKm: number;
  nextServiceKm: number;
  acquisitionDate: string;
  acquisitionCost: Millimes;
  gpsDeviceId: string | null;
  documents: VehicleDocuments;
  createdAt: string;
};

export type MileageSource = "depart" | "retour" | "entretien" | "manuel";

/** Append-only telemetry log (never updated or deleted). */
export type MileageLog = {
  id: string;
  tenantId: string;
  vehicleId: string;
  at: string;
  km: number;
  fuelLevel: FuelLevel;
  source: MileageSource;
  reference: string | null;
  note: string | null;
  recordedBy: string;
};
