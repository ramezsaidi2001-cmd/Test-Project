import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/server/auth/demo";
import { Logo } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getMemberships } from "@/server/tenancy/context";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Configurer votre agence" };

export default async function OnboardingPage() {
  if (isDemoMode()) redirect("/dashboard");
  const user = await requireUser();
  const memberships = await getMemberships(user.id);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Configurez votre agence</h1>
        <p className="mt-1 text-sm text-muted">
          Vous en serez l&apos;administrateur et pourrez inviter plus tard des gestionnaires de flotte, des agents de
          comptoir et des comptables.
        </p>
        <OnboardingForm />
        {memberships.length > 0 && (
          <p className="mt-6 text-center text-sm">
            <Link href="/dashboard" className="text-primary hover:underline">
              Retour au tableau de bord
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
