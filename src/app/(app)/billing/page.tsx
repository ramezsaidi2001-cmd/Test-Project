import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, EmptyState, PageHeader, StatCard, Table, TBody, Td, THead, Tabs } from "@/components/ui";
import { INVOICE_STATUS } from "@/domain/labels";
import { formatDate } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { billingSummary, listInvoices } from "@/server/billing/service";
import { listContracts } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Facturation" };

const STATUS_TABS = [
  { value: "", label: "Toutes" },
  { value: "emise", label: "Émises" },
  { value: "partiellement_payee", label: "Partiellement payées" },
  { value: "payee", label: "Payées" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulées" },
] as const;

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const ctx = await requirePagePermission("finance.view");
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const statusParam = first(sp.status);
  const status = STATUS_TABS.some((t) => t.value === statusParam) ? statusParam : "";

  const summary = billingSummary(ctx);
  const all = listInvoices(ctx, { q });
  const rows = status ? all.filter((r) => r.status === status) : all;
  const contractNumbers = new Map(
    can(ctx.role, "contracts.view") ? listContracts(ctx).map((c) => [c.contract.id, c.contract.number] as const) : [],
  );

  const hrefFor = (value: string) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/billing?${s}` : "/billing";
  };

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Facturation" description="Factures émises à la clôture des contrats, encaissements et relances." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Facturé ce mois (TTC)" value={formatTnd(summary.invoicedThisMonth)} />
        <StatCard label="Encaissé ce mois" value={formatTnd(summary.collectedThisMonth)} />
        <StatCard label="Reste à encaisser" value={formatTnd(summary.outstanding)} href={hrefFor("")} />
        <StatCard
          label="En retard"
          value={formatTnd(summary.overdue)}
          tone={summary.overdueCount > 0 ? "danger" : undefined}
          hint={`${summary.overdueCount} facture${summary.overdueCount > 1 ? "s" : ""} échue${summary.overdueCount > 1 ? "s" : ""}`}
          href={hrefFor("en_retard")}
        />
      </div>

      <div>
        <Tabs
          current={status}
          tabs={STATUS_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            href: hrefFor(t.value),
            count: t.value ? all.filter((r) => r.status === t.value).length : all.length,
          }))}
        />

        <form method="get" action="/billing" className="mb-4 flex flex-wrap gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="N° de facture ou client…"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:max-w-sm"
          />
          <Button type="submit" variant="secondary">
            Rechercher
          </Button>
          {q && (
            <Link href={hrefFor(status)} className="self-center text-sm text-muted hover:text-foreground">
              Effacer
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <EmptyState
            title="Aucune facture"
            description={q ? "Aucune facture ne correspond à votre recherche." : "Aucune facture dans cette catégorie."}
          />
        ) : (
          <Table>
            <THead
              columns={[
                "N°",
                "Date",
                "Client",
                "Contrat",
                { label: "Total TTC", className: "text-right" },
                { label: "Payé", className: "text-right" },
                { label: "Reste", className: "text-right" },
                "Statut",
              ]}
            />
            <TBody>
              {rows.map((r) => (
                <tr key={r.invoice.id} className="hover:bg-border/20">
                  <Td className="whitespace-nowrap font-medium">
                    <Link href={`/billing/${r.invoice.id}`} className="text-primary hover:underline">
                      {r.invoice.number}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatDate(r.invoice.issuedAt)}</Td>
                  <Td>{r.customerName}</Td>
                  <Td className="whitespace-nowrap">
                    {r.invoice.contractId ? (
                      <Link href={`/reservations/${r.invoice.contractId}`} className="hover:text-primary hover:underline">
                        {contractNumbers.get(r.invoice.contractId) ?? "Voir le contrat"}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(r.invoice.total)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(r.paid)}</Td>
                  <Td className={`whitespace-nowrap text-right tabular-nums ${r.balance > 0 ? "font-medium" : "text-muted"}`}>
                    {formatTnd(r.balance)}
                  </Td>
                  <Td>
                    <Badge tone={INVOICE_STATUS[r.status].tone}>{INVOICE_STATUS[r.status].label}</Badge>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
