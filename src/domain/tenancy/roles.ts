import type { Enums } from "@/lib/supabase/database.types";

export type Role = Enums<"app_role">;
export type PlanTier = Enums<"plan_tier">;

export const ROLES = ["admin", "fleet_manager", "desk_agent", "accountant"] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  fleet_manager: "Gestionnaire de flotte",
  desk_agent: "Agent de comptoir",
  accountant: "Comptable",
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  standard: "Standard",
  enterprise: "Entreprise",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
