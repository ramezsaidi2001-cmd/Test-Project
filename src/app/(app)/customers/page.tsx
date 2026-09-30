import type { Metadata } from "next";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/client";
import { Badge, Button, ButtonLink, EmptyState, PageHeader, Table, TBody, Td, THead } from "@/components/ui";
import { RISK_LABEL, type RiskLevel } from "@/domain/customers/risk";
import { CUSTOMER_KIND, ID_DOCUMENT } from "@/domain/labels";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { listCustomers } from "@/server/customers/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Clients" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requirePagePermission("customers.view");
  const sp = await searchParams;
  const q = one(sp.q);
  const kind = one(sp.kind);
  const risk = one(sp.risk);
  const rows = listCustomers(ctx, { q, kind: kind || undefined, risk: risk || undefined });
  const filtered = Boolean(q || kind || risk);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Clients"
        description={`${rows.length} client${rows.length > 1 ? "s" : ""}${filtered ? " correspondant aux filtres" : ""}.`}
        actions={can(ctx.role, "customers.manage") && <ButtonLink href="/customers/new">Nouveau client</ButtonLink>}
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nom, CIN / passeport, téléphone, matricule fiscal…"
          aria-label="Rechercher un client"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm sm:max-w-sm"
        />
        <AutoSubmitSelect name="kind" defaultValue={kind} aria-label="Type de client">
          <option value="">Tous les types</option>
          {Object.entries(CUSTOMER_KIND).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="risk" defaultValue={risk} aria-label="Niveau de risque">
          <option value="">Tous les risques</option>
          {(Object.keys(RISK_LABEL) as RiskLevel[]).map((v) => (
            <option key={v} value={v}>
              {RISK_LABEL[v].label}
            </option>
          ))}
        </AutoSubmitSelect>
        <Button type="submit" variant="secondary" className="py-1.5">
          Rechercher
        </Button>
        {filtered && (
          <Link href="/customers" className="text-sm text-muted hover:text-foreground">
            Réinitialiser
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Aucun client ne correspond à votre recherche" : "Aucun client pour le moment"}
          description={filtered ? "Modifiez ou réinitialisez les filtres." : "Ajoutez votre premier client pour créer des réservations."}
          action={!filtered && can(ctx.role, "customers.manage") && <ButtonLink href="/customers/new">Nouveau client</ButtonLink>}
        />
      ) : (
        <Table>
          <THead
            columns={[
              "Nom",
              "Type",
              "Pièce d'identité",
              "Téléphone",
              "Ville",
              { label: "Contrats", className: "text-right" },
              { label: "Solde dû", className: "text-right" },
              "Risque",
            ]}
          />
          <TBody>
            {rows.map(({ customer, name, risk: r, contractCount, balance }) => (
              <tr key={customer.id} className="hover:bg-border/20">
                <Td className="font-medium">
                  <Link href={`/customers/${customer.id}`} className="text-primary hover:underline">
                    {name}
                  </Link>
                  {customer.kind === "entreprise" && (
                    <span className="block text-xs text-muted">
                      {customer.firstName} {customer.lastName}
                    </span>
                  )}
                </Td>
                <Td className="text-muted">{CUSTOMER_KIND[customer.kind]}</Td>
                <Td className="whitespace-nowrap">
                  <span className="text-xs text-muted">{ID_DOCUMENT[customer.idType]}</span> {customer.idNumber}
                </Td>
                <Td className="whitespace-nowrap">{customer.phone}</Td>
                <Td>{customer.city}</Td>
                <Td className="text-right tabular-nums">{contractCount}</Td>
                <Td className={`whitespace-nowrap text-right tabular-nums ${balance > 0 ? "font-medium text-danger" : "text-muted"}`}>
                  {formatTnd(balance)}
                </Td>
                <Td>
                  <Badge tone={RISK_LABEL[r.level].tone}>{RISK_LABEL[r.level].label}</Badge>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
