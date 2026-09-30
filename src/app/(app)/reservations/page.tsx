import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, ButtonLink, EmptyState, PageHeader, Table, TBody, Td, THead, Tabs } from "@/components/ui";
import { CONTRACT_STATUS } from "@/domain/labels";
import type { ContractStatus } from "@/domain/rentals/types";
import { formatDateTime } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { listContracts, type ContractFilters } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Réservations et contrats" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const STATUS_TABS: { value: ContractStatus | ""; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "reservee", label: "Réservées" },
  { value: "en_cours", label: "En cours" },
  { value: "retournee", label: "Retournées (à clôturer)" },
  { value: "cloturee", label: "Clôturées" },
  { value: "annulee", label: "Annulées" },
];

const PERIODS: { value: NonNullable<ContractFilters["period"]>; label: string }[] = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "a_venir", label: "À venir" },
  { value: "en_retard", label: "En retard" },
];

function href(params: { status?: string; period?: string; q?: string }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/reservations?${s}` : "/reservations";
}

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const ctx = await requirePagePermission("contracts.view");
  const sp = await searchParams;
  const status = STATUS_TABS.some((t) => t.value === one(sp.status)) ? one(sp.status) : "";
  const period = PERIODS.find((p) => p.value === one(sp.period))?.value;
  const q = one(sp.q);

  // Counts per status reflect the period + search filters, so tabs stay consistent with the table.
  const base = listContracts(ctx, { q, period });
  const rows = status ? base.filter((r) => r.contract.status === status) : base;
  const canManage = can(ctx.role, "contracts.manage");
  const filtered = Boolean(q || period);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Réservations et contrats"
        description="Suivi des réservations, départs, retours et clôtures."
        actions={canManage && <ButtonLink href="/reservations/new">Nouvelle réservation</ButtonLink>}
      />

      <Tabs
        current={status}
        tabs={STATUS_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          href: href({ status: t.value, period, q }),
          count: t.value ? base.filter((r) => r.contract.status === t.value).length : base.length,
        }))}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Période">
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Link
                key={p.value}
                href={href({ status, period: active ? undefined : p.value, q })}
                aria-current={active ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form method="get" className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          {period && <input type="hidden" name="period" value={period} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="N°, client, immatriculation…"
            aria-label="Rechercher un contrat"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm sm:max-w-xs"
          />
          <Button type="submit" variant="secondary" className="py-1.5">
            Rechercher
          </Button>
          {filtered && (
            <Link href={href({ status })} className="text-sm text-muted hover:text-foreground">
              Réinitialiser
            </Link>
          )}
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun contrat"
          description={filtered || status ? "Aucun contrat ne correspond à ces filtres." : "Créez votre première réservation."}
          action={canManage && !filtered && !status && <ButtonLink href="/reservations/new">Nouvelle réservation</ButtonLink>}
        />
      ) : (
        <Table>
          <THead columns={["N°", "Client", "Véhicule", "Départ", "Retour", { label: "Montant TTC", className: "text-right" }, "Statut"]} />
          <TBody>
            {rows.map(({ contract, customerName, vehicle, pickupBranch, returnBranch, overdue }) => (
              <tr key={contract.id} className="hover:bg-border/20">
                <Td className="whitespace-nowrap font-medium">
                  <Link href={`/reservations/${contract.id}`} className="text-primary hover:underline">
                    {contract.number}
                  </Link>
                </Td>
                <Td>{customerName}</Td>
                <Td>
                  <span className="whitespace-nowrap font-medium">{vehicle.plate}</span>
                  <span className="block text-xs text-muted">
                    {vehicle.make} {vehicle.model}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(contract.startAt)}
                  <span className="block text-xs text-muted">{pickupBranch.name}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(contract.endAt)}
                  <span className="block text-xs text-muted">{returnBranch.name}</span>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(contract.rate.total)}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={CONTRACT_STATUS[contract.status].tone}>{CONTRACT_STATUS[contract.status].label}</Badge>
                    {overdue && <Badge tone="danger">En retard</Badge>}
                  </span>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
