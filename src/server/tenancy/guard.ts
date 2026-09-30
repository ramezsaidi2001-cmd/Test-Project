import "server-only";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/domain/tenancy/permissions";
import { getTenantContext, type TenantContext } from "./context";

/** For pages: resolves the tenant and redirects to the dashboard (with a notice) if the role lacks the permission. */
export async function requirePagePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!can(ctx.role, permission)) redirect("/dashboard?acces=refuse");
  return ctx;
}
