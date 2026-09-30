import "server-only";
import { can, assertCan, type Permission } from "@/domain/tenancy/permissions";
import { getTenantData } from "@/server/store";
import type { TenantData } from "@/server/store/types";
import type { TenantContext } from "@/server/tenancy/context";

export type Ok<T extends object = object> = { ok: true } & T;
export type Fail = { ok: false; error: string; field?: string };
export type Result<T extends object = object> = Ok<T> | Fail;

export const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

/** Tenant-scoped data, after checking the permission (defense in depth behind page/action checks). */
export function scope(ctx: TenantContext, permission: Permission): TenantData {
  assertCan(ctx.role, permission);
  return getTenantData(ctx.tenant.id, ctx.tenant.name);
}

/** Tenant-scoped data when any of the permissions is enough. */
export function scopeAny(ctx: TenantContext, permissions: Permission[]): TenantData {
  if (!permissions.some((p) => can(ctx.role, p))) assertCan(ctx.role, permissions[0]);
  return getTenantData(ctx.tenant.id, ctx.tenant.name);
}

export function customerName(c: { kind: string; firstName: string; lastName: string; companyName: string | null }) {
  return c.kind === "entreprise" && c.companyName ? c.companyName : `${c.firstName} ${c.lastName}`;
}

export function vehicleLabel(v: { make: string; model: string; plate: string }) {
  return `${v.make} ${v.model} · ${v.plate}`;
}
