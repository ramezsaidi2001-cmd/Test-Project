import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, ButtonLink, Card, DescriptionList, EmptyState, PageHeader, StatCard, Table, TBody, Td, THead } from "@/components/ui";
import { displayStatus, invoiceBalance } from "@/domain/billing/invoice";
import { MIN_LICENSE_YEARS, RISK_LABEL } from "@/domain/customers/risk";
import { CONTRACT_STATUS, CUSTOMER_KIND, ID_DOCUMENT, INVOICE_STATUS } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { getCustomerDetail } from "@/server/customers/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { BlacklistForm } from "./blacklist-form";

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const ctx = await requirePagePermission("customers.view");
  const detail = getCustomerDetail(ctx, (await params).id);
  return { title: detail ? detail.name : "Client introuvable" };
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const ctx = await requirePagePermission("customers.view");
  const { id } = await params;
  const detail = getCustomerDetail(ctx, id);
  if (!detail) notFound();

  const { customer, risk, contracts, invoices } = detail;
  const canManage = can(ctx.role, "customers.manage");
  const canBook = can(ctx.role, "contracts.manage");
  const canSeeContracts = can(ctx.role, "contracts.view");
  const canSeeInvoices = can(ctx.role, "finance.view");
  const now = new Date();
  const activeContracts = contracts.filter((c) => c.contract.status !== "annulee");
  const licenseExpired = customer.licenseExpiry ? new Date(customer.licenseExpiry) < now : false;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/customers", label: "Clients" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {detail.name}
            <Badge tone="neutral">{CUSTOMER_KIND[customer.kind]}</Badge>
            <Badge tone={RISK_LABEL[risk.level].tone}>{RISK_LABEL[risk.level].label}</Badge>
          </span>
        }
        description={`Client depuis le ${formatDate(customer.createdAt)}`}
        actions={
          <>
            {canManage && (
              <ButtonLink href={`/customers/${id}/edit`} variant="secondary">
                Modifier
              </ButtonLink>
            )}
            {canBook && !customer.blacklisted && (
              <ButtonLink href={`/reservations/new?customerId=${id}`}>Nouvelle réservation</ButtonLink>
            )}
          </>
        }
      />

      {risk.flags.length > 0 && (
        <Alert tone={risk.level === "moyen" ? "warning" : "error"}>
          <p className="font-medium">Points d&apos;attention</p>
          <ul className="mt-1 list-disc pl-5">
            {risk.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total dépensé (TTC)" value={formatTnd(detail.totalSpent)} />
        <StatCard label="Solde dû" value={formatTnd(detail.balance)} tone={detail.balance > 0 ? "danger" : undefined} />
        <StatCard label="Contrats" value={activeContracts.length} hint={`${risk.lateReturns} retard(s) · ${risk.damages} dommage(s)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={customer.kind === "entreprise" ? "Entreprise et contact" : "Identité"}>
          <DescriptionList
            items={[
              ...(customer.kind === "entreprise"
                ? [
                    { label: "Raison sociale", value: customer.companyName },
                    { label: "Matricule fiscal", value: customer.taxId },
                    { label: "Contact", value: `${customer.firstName} ${customer.lastName}` },
                  ]
                : [
                    { label: "Prénom", value: customer.firstName },
                    { label: "Nom", value: customer.lastName },
                  ]),
              { label: ID_DOCUMENT[customer.idType], value: customer.idNumber },
              { label: "Nationalité", value: customer.nationality },
              { label: "Date de naissance", value: customer.birthDate ? formatDate(customer.birthDate) : "—" },
              { label: "Téléphone", value: <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">{customer.phone}</a> },
              {
                label: "E-mail",
                value: customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  "—"
                ),
              },
              { label: "Adresse", value: `${customer.address}, ${customer.city}` },
            ]}
          />
        </Card>

        <div className="space-y-6">
          <Card title="Permis de conduire">
            <DescriptionList
              items={[
                { label: "Numéro", value: customer.licenseNumber },
                { label: "Délivré le", value: customer.licenseIssueDate ? formatDate(customer.licenseIssueDate) : "—" },
                {
                  label: "Expire le",
                  value: customer.licenseExpiry ? (
                    <span className={licenseExpired ? "font-medium text-danger" : ""}>
                      {formatDate(customer.licenseExpiry)}
                      {licenseExpired && " (expiré)"}
                    </span>
                  ) : (
                    "—"
                  ),
                },
                { label: "Ancienneté minimale", value: `${MIN_LICENSE_YEARS} ans` },
              ]}
            />
          </Card>
          {customer.notes && (
            <Card title="Notes internes">
              <p className="whitespace-pre-line text-sm">{customer.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Contrats</h2>
        {contracts.length === 0 ? (
          <EmptyState
            title="Aucun contrat"
            action={canBook && !customer.blacklisted && <ButtonLink href={`/reservations/new?customerId=${id}`}>Nouvelle réservation</ButtonLink>}
          />
        ) : (
          <Table>
            <THead columns={["N°", "Véhicule", "Départ", "Retour", { label: "Montant TTC", className: "text-right" }, "Statut"]} />
            <TBody>
              {contracts.map(({ contract, vehicle }) => (
                <tr key={contract.id}>
                  <Td className="whitespace-nowrap font-medium">
                    {canSeeContracts ? (
                      <Link href={`/reservations/${contract.id}`} className="text-primary hover:underline">
                        {contract.number}
                      </Link>
                    ) : (
                      contract.number
                    )}
                  </Td>
                  <Td>
                    {vehicle.make} {vehicle.model}
                    <span className="block text-xs text-muted">{vehicle.plate}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(contract.startAt)}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(contract.endAt)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(contract.rate.total)}</Td>
                  <Td>
                    <Badge tone={CONTRACT_STATUS[contract.status].tone}>{CONTRACT_STATUS[contract.status].label}</Badge>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Factures</h2>
        {invoices.length === 0 ? (
          <EmptyState title="Aucune facture" />
        ) : (
          <Table>
            <THead
              columns={[
                "N°",
                "Émise le",
                "Échéance",
                { label: "Total TTC", className: "text-right" },
                { label: "Reste dû", className: "text-right" },
                "Statut",
              ]}
            />
            <TBody>
              {invoices.map((invoice) => {
                const status = INVOICE_STATUS[displayStatus(invoice, now)];
                const due = invoiceBalance(invoice);
                return (
                  <tr key={invoice.id}>
                    <Td className="whitespace-nowrap font-medium">
                      {canSeeInvoices ? (
                        <Link href={`/billing/${invoice.id}`} className="text-primary hover:underline">
                          {invoice.number}
                        </Link>
                      ) : (
                        invoice.number
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(invoice.issuedAt)}</Td>
                    <Td className="whitespace-nowrap">{formatDate(invoice.dueAt)}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(invoice.total)}</Td>
                    <Td className={`whitespace-nowrap text-right tabular-nums ${due > 0 ? "font-medium text-danger" : "text-muted"}`}>
                      {formatTnd(due)}
                    </Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      {canManage && (
        <Card title="Liste noire" className="max-w-2xl">
          <BlacklistForm customerId={id} blacklisted={customer.blacklisted} reason={customer.blacklistReason} />
        </Card>
      )}
    </div>
  );
}
