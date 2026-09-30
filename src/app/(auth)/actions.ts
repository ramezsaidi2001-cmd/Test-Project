"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isRole } from "@/domain/tenancy/roles";
import { createClient } from "@/lib/supabase/server";
import { clearDemoRole, isDemoMode, setDemoRole } from "@/server/auth/demo";
import { safeNextPath } from "@/lib/safe-redirect";
import type { FormState } from "@/lib/form-state";

const signInSchema = z.object({
  email: z.email("Saisissez une adresse e-mail valide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Saisissez votre nom complet.").max(120, "120 caractères maximum."),
  email: z.email("Saisissez une adresse e-mail valide."),
  password: z.string().min(8, "Utilisez au moins 8 caractères.").max(72, "72 caractères maximum."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirmez votre adresse e-mail avant de vous connecter."
          : "E-mail ou mot de passe incorrect.",
    };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=/onboarding` : undefined,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Mot de passe trop faible. Choisissez-en un plus robuste."] } };
    }
    return { error: "Impossible de créer votre compte. Veuillez réessayer." };
  }

  // Email confirmation disabled: the user is signed in immediately.
  if (data.session) redirect("/onboarding");

  return { message: "Consultez votre boîte de réception pour confirmer votre e-mail, puis connectez-vous." };
}

export async function signOut() {
  if (isDemoMode()) {
    await clearDemoRole();
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Demo mode only: sign in as one of the seeded users of the given role. */
export async function demoSignIn(formData: FormData) {
  const role = formData.get("role");
  if (!isDemoMode() || !isRole(role)) redirect("/login");
  await setDemoRole(role);
  redirect(safeNextPath(formData.get("next")));
}
