import type { Role } from "./roles";

// Application-level RBAC. RLS policies on each module's tables must grant the same roles
// (the database is the source of truth for isolation; this drives UI and early rejection).
export const PERMISSIONS = [
  "tenant.manage",
  "members.view",
  "members.manage",
  "fleet.view",
  "fleet.manage",
  "customers.view",
  "customers.manage",
  "contracts.view",
  "contracts.manage",
  "maintenance.view",
  "maintenance.manage",
  "finance.view",
  "finance.manage",
  "reports.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  fleet_manager: new Set<Permission>([
    "members.view",
    "fleet.view",
    "fleet.manage",
    "maintenance.view",
    "maintenance.manage",
    "customers.view",
    "contracts.view",
    "reports.view",
  ]),
  desk_agent: new Set<Permission>([
    "members.view",
    "fleet.view",
    "customers.view",
    "customers.manage",
    "contracts.view",
    "contracts.manage",
  ]),
  accountant: new Set<Permission>([
    "members.view",
    "customers.view",
    "contracts.view",
    "finance.view",
    "finance.manage",
    "reports.view",
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}
