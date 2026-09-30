import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertCan, type Permission } from "@/domain/tenancy/permissions";
import type { PlanTier, Role } from "@/domain/tenancy/roles";
import { DEMO_TENANT_ID, isDemoMode } from "@/server/auth/demo";
import { requireUser, type SessionUser } from "@/server/auth/session";
import { getTenantData } from "@/server/store";

export const ACTIVE_TENANT_COOKIE = "fleetly_tenant";

export type Membership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: PlanTier;
  role: Role;
};

export type TenantContext = {
  user: SessionUser;
  tenant: { id: string; name: string; slug: string; plan: PlanTier };
  role: Role;
  memberships: Membership[];
};

export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  if (isDemoMode()) {
    const data = getTenantData(DEMO_TENANT_ID);
    const user = data.users.find((u) => u.id === userId);
    if (!user) return [];
    return [
      {
        tenantId: DEMO_TENANT_ID,
        tenantName: data.settings.tradeName,
        tenantSlug: "carthage-rent-car",
        plan: "enterprise",
        role: user.role,
      },
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, tenant:tenants!inner(id, name, slug, plan)")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to load memberships: ${error.message}`);

  return data
    .map((m) => ({
      tenantId: m.tenant.id,
      tenantName: m.tenant.name,
      tenantSlug: m.tenant.slug,
      plan: m.tenant.plan,
      role: m.role,
    }))
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
});

/**
 * Resolves the signed-in user's active tenant. The cookie only selects among the user's
 * own memberships, so a tampered value can never grant access to another tenant.
 * Redirects to /login (no session) or /onboarding (no tenant yet).
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) redirect("/onboarding");

  const preferred = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  const active = memberships.find((m) => m.tenantId === preferred) ?? memberships[0];

  return {
    user,
    tenant: { id: active.tenantId, name: active.tenantName, slug: active.tenantSlug, plan: active.plan },
    role: active.role,
    memberships,
  };
});

/** For Server Actions and pages: resolve the tenant and enforce an RBAC permission. */
export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await getTenantContext();
  assertCan(ctx.role, permission);
  return ctx;
}

export async function setActiveTenantCookie(tenantId: string) {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
