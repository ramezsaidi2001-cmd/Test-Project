import type { Invoice } from "@/domain/billing/types";
import type { Customer } from "@/domain/customers/types";
import type { Branch, MileageLog, Vehicle, VehicleCategory } from "@/domain/fleet/types";
import type { WorkOrder } from "@/domain/maintenance/types";
import type { Contract, RentalExtra, SeasonalRate } from "@/domain/rentals/types";
import type { AgencySettings } from "@/domain/settings/types";
import type { Role } from "@/domain/tenancy/roles";

export type DemoUser = { id: string; name: string; email: string; role: Role; joinedAt: string };

export type TenantData = {
  settings: AgencySettings;
  users: DemoUser[];
  branches: Branch[];
  categories: VehicleCategory[];
  seasons: SeasonalRate[];
  extras: RentalExtra[];
  vehicles: Vehicle[];
  mileageLogs: MileageLog[];
  customers: Customer[];
  contracts: Contract[];
  invoices: Invoice[];
  workOrders: WorkOrder[];
  counters: Record<string, number>;
};
