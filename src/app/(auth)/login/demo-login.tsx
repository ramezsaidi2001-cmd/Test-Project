import { ROLE_LABELS, ROLES } from "@/domain/tenancy/roles";
import { demoSignIn } from "../actions";

const ROLE_HINTS = {
  admin: "Accès complet : flotte, contrats, facturation, paramètres et équipe.",
  fleet_manager: "Véhicules, kilométrage, entretien et rapports d'utilisation.",
  desk_agent: "Clients, réservations, départs et retours au comptoir.",
  accountant: "Factures, encaissements, impayés et rapports financiers.",
} as const;

export function DemoLogin({ next }: { next: string }) {
  return (
    <div className="mt-6 space-y-3">
      <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
        Mode démo : données fictives d&apos;une agence tunisienne. Choisissez un rôle pour tester les droits d&apos;accès.
      </p>
      {ROLES.map((role) => (
        <form key={role} action={demoSignIn}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <span className="block text-sm font-medium">Se connecter en tant que {ROLE_LABELS[role]}</span>
            <span className="mt-0.5 block text-xs text-muted">{ROLE_HINTS[role]}</span>
          </button>
        </form>
      ))}
    </div>
  );
}
