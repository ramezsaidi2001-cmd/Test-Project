import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode } from "@/server/auth/demo";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  if (isDemoMode()) {
    return (
      <>
        <h1 className="text-xl font-semibold">Créer un compte</h1>
        <p className="mt-3 text-sm text-muted">
          L&apos;inscription sera disponible dès que la base de données Supabase sera connectée. En attendant, testez la
          plateforme avec un compte de démonstration.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Accéder à la démo
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Créez votre compte</h1>
      <p className="mt-1 text-sm text-muted">Vous configurerez votre agence juste après.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        Vous avez déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
