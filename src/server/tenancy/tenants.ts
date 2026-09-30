import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CreateTenantResult =
  | { ok: true; tenantId: string }
  | { ok: false; reason: "slug_taken" | "invalid" | "unknown"; message: string };

/** Creates a tenant and makes the current user its admin (atomic, via the create_tenant RPC). */
export async function createTenant(name: string, slug: string): Promise<CreateTenantResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tenant", { p_name: name, p_slug: slug });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, reason: "slug_taken", message: "Cette adresse est déjà utilisée." };
    }
    if (error.code === "23514") {
      return { ok: false, reason: "invalid", message: "Le nom ou l'adresse est invalide." };
    }
    console.error("create_tenant failed", error);
    return { ok: false, reason: "unknown", message: "Impossible de créer l'agence. Veuillez réessayer." };
  }

  return { ok: true, tenantId: data.id };
}
