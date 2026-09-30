"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SLUG_MAX, SLUG_MIN, SLUG_PATTERN } from "@/domain/tenancy/slug";
import type { FormState } from "@/lib/form-state";
import { isDemoMode } from "@/server/auth/demo";
import { requireUser } from "@/server/auth/session";
import { setActiveTenantCookie } from "@/server/tenancy/context";
import { createTenant } from "@/server/tenancy/tenants";

const schema = z.object({
  name: z.string().trim().min(2, "Saisissez le nom de votre agence.").max(120, "120 caractères maximum."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(SLUG_MIN, `Utilisez au moins ${SLUG_MIN} caractères.`)
    .max(SLUG_MAX, `${SLUG_MAX} caractères maximum.`)
    .regex(SLUG_PATTERN, "Utilisez des lettres minuscules, des chiffres et des tirets simples."),
});

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  if (isDemoMode()) return { error: "La création d'agence n'est pas disponible en mode démo." };

  const parsed = schema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const result = await createTenant(parsed.data.name, parsed.data.slug);
  if (!result.ok) {
    return result.reason === "slug_taken" ? { fieldErrors: { slug: [result.message] } } : { error: result.message };
  }

  await setActiveTenantCookie(result.tenantId);
  redirect("/dashboard");
}
