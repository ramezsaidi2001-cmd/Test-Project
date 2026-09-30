import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantData } from "@/server/store";
import { DEMO_TENANT_ID, getDemoRole, isDemoMode } from "./demo";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
};

/** Verified current user (JWT signature checked via getClaims), or null. Deduped per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (isDemoMode()) {
    const role = await getDemoRole();
    if (!role) return null;
    const user = getTenantData(DEMO_TENANT_ID).users.find((u) => u.role === role)!;
    return { id: user.id, email: user.email, name: user.name };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const meta = data.claims.user_metadata as { full_name?: unknown } | undefined;
  return {
    id: data.claims.sub,
    email,
    name: typeof meta?.full_name === "string" && meta.full_name ? meta.full_name : (email ?? "Utilisateur"),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
