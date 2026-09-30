import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { isDemoMode } from "@/server/auth/demo";
import { DemoLogin } from "./demo-login";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  if (isDemoMode()) {
    return (
      <>
        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">Bienvenue sur Fleetly.</p>
        <DemoLogin next={nextPath} />
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Bon retour sur Fleetly.</p>
      <LoginForm
        next={nextPath}
        linkError={error === "auth_link" ? "Ce lien est invalide ou a expiré." : undefined}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Nouveau sur Fleetly ?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
