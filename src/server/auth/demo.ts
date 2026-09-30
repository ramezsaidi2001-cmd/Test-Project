import "server-only";
import { cookies } from "next/headers";
import { isRole, type Role } from "@/domain/tenancy/roles";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const DEMO_COOKIE = "fleetly_demo_role";
export const DEMO_TENANT_ID = "demo";

/** Demo mode = no Supabase configured: role-based login over seeded in-memory data. */
export function isDemoMode(): boolean {
  return getSupabaseEnv() === null;
}

export async function getDemoRole(): Promise<Role | null> {
  const value = (await cookies()).get(DEMO_COOKIE)?.value;
  return isRole(value) ? value : null;
}

export async function setDemoRole(role: Role) {
  (await cookies()).set(DEMO_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearDemoRole() {
  (await cookies()).delete(DEMO_COOKIE);
}
