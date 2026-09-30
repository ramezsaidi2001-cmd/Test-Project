import Link from "next/link";
import { Logo } from "@/components/ui";

const MODULES = [
  { title: "Flotte", body: "Inventaire des véhicules, kilométrage et carburant, documents et alertes d'échéance." },
  { title: "Clients", body: "Profils particuliers et entreprises, vérification des permis et signalements de risque." },
  { title: "Réservations", body: "De la réservation au retour jusqu'à la facture, sans conflit de disponibilité." },
  { title: "Entretien", body: "Entretiens planifiés au kilométrage, ordres de travail et coût total de possession." },
  { title: "Facturation", body: "Cautions, factures, paiements et suivi des impayés." },
  { title: "Rapports", body: "Taux d'utilisation, revenu par véhicule disponible et immobilisations." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-md px-3 py-2 font-medium hover:bg-border/60">
            Se connecter
          </Link>
          <Link href="/signup" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90">
            Commencer
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Pilotez toute votre flotte de location depuis un seul outil.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Fleetly remplace les tableurs et les outils dispersés pour les agences de plus de 25 véhicules.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.title} className="rounded-lg border border-border bg-surface p-5">
              <h2 className="font-medium">{m.title}</h2>
              <p className="mt-1 text-sm text-muted">{m.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
