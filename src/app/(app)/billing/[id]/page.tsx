import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmSubmit, PrintButton } from "@/components/client";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ID_DOCUMENT, INVOICE_STATUS, PAYMENT_METHOD } from "@/domain/labels";
import { formatDate } from "@/domain/shared/dates";
import { formatTnd, formatTndPlain } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { canRecordPayment, getInvoiceDetail } from "@/server/billing/service";
import { getTenantContext } from "@/server/tenancy/context";
import { cancelInvoiceAction, recordPaymentAction } from "./actions";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Facture" };

function formatBp(bp: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(bp / 100)} %`;
}

export default async function InvoicePage({ params, searchParams }: PageProps<"/billing/[id]">) {
  const ctx = await getTenantContext();
  if (!can(ctx.role, "finance.view") && !can(ctx.role, "contracts.view")) redirect("/dashboard?acces=refuse");

  const { id } = await params;
  const { annulation } = await searchParams;
  const detail = getInvoiceDetail(ctx, id);
  if (!detail) notFound();

  const { invoice, customer, contract, vehicle, settings, paid, balance, status } = detail;
  const statusInfo = INVOICE_STATUS[status];
  const cancelled = invoice.status === "annulee";
  const showPayment = canRecordPayment(ctx) && balance > 0 && !cancelled;
  const showCancel = can(ctx.role, "finance.manage") && !cancelled && invoice.payments.length === 0;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="print:hidden">
        <PageHeader
          title={`Facture ${invoice.number}`}
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
              <span>
                {detail.customerName} · émise le {formatDate(invoice.issuedAt)}
              </span>
            </span>
          }
          back={can(ctx.role, "finance.view") ? { href: "/billing", label: "Facturation" } : undefined}
          actions={
            <>
              {contract && (
                <Link href={`/reservations/${contract.id}`} className="text-sm text-primary hover:underline">
                  Contrat {contract.number}
                </Link>
              )}
              <PrintButton />
            </>
          }
        />
        {annulation === "ok" && <Alert tone="success">La facture a été annulée.</Alert>}
        {annulation === "echec" && (
          <Alert tone="error">Impossible d&apos;annuler une facture ayant des encaissements. Émettez un avoir.</Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Printable A4 invoice */}
        <div data-print-root className="overflow-x-auto rounded-lg border border-border bg-surface print:overflow-visible print:border-0">
          <article className="mx-auto min-w-[36rem] max-w-[210mm] space-y-8 p-6 text-sm sm:p-10 print:min-w-0 print:p-0">
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-0.5">
                <p className="text-lg font-semibold">{settings.tradeName}</p>
                {settings.legalName && <p>{settings.legalName}</p>}
                {settings.taxId && <p>MF : {settings.taxId}</p>}
                {settings.rne && <p>RNE : {settings.rne}</p>}
                <p>{settings.address}</p>
                <p>{settings.city}</p>
                {settings.phone && <p>Tél. : {settings.phone}</p>}
                {settings.email && <p>{settings.email}</p>}
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xl font-bold tracking-tight">FACTURE N° {invoice.number}</p>
                <p>Date d&apos;émission : {formatDate(invoice.issuedAt)}</p>
                <p>Échéance : {formatDate(invoice.dueAt)}</p>
                {cancelled && <p className="font-semibold uppercase text-danger">Annulée</p>}
              </div>
            </header>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Client</p>
                <p className="font-semibold">{detail.customerName}</p>
                <p>{customer.address}</p>
                <p>{customer.city}</p>
                {customer.kind === "entreprise" ? (
                  customer.taxId && <p>MF : {customer.taxId}</p>
                ) : (
                  <p>
                    {ID_DOCUMENT[customer.idType]} : {customer.idNumber}
                  </p>
                )}
              </div>
              {contract && (
                <div className="rounded-md border border-border p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted">Location</p>
                  <p>Contrat : {contract.number}</p>
                  {vehicle && (
                    <p>
                      Véhicule : {vehicle.make} {vehicle.model} · {vehicle.plate}
                    </p>
                  )}
                  <p>
                    Du {formatDate(contract.checkout?.at ?? contract.startAt)} au{" "}
                    {formatDate(contract.checkin?.at ?? contract.endAt)}
                  </p>
                </div>
              )}
            </div>

            <table className="w-full text-left">
              <thead className="border-b-2 border-foreground/70 text-xs uppercase tracking-wide">
                <tr>
                  <th scope="col" className="py-2 pr-2 font-semibold">Désignation</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Qté</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">P.U. HT</th>
                  <th scope="col" className="py-2 pl-2 text-right font-semibold">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">{line.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatTndPlain(line.unitPrice)}</td>
                    <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatTndPlain(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <dl className="w-full max-w-xs space-y-1 tabular-nums">
                <div className="flex justify-between gap-4">
                  <dt>Total HT</dt>
                  <dd>{formatTnd(invoice.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>TVA {formatBp(invoice.tvaBp)}</dt>
                  <dd>{formatTnd(invoice.tva)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Timbre fiscal</dt>
                  <dd>{formatTnd(invoice.timbre)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t-2 border-foreground/70 pt-2 text-base font-bold">
                  <dt>Net à payer TTC</dt>
                  <dd>{formatTnd(invoice.total)}</dd>
                </div>
              </dl>
            </div>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Règlements</h2>
              {invoice.payments.length === 0 ? (
                <p className="text-muted">Aucun règlement enregistré.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="py-1.5 pr-2 font-medium">Date</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">Mode</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">Référence</th>
                      <th scope="col" className="py-1.5 pl-2 text-right font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap py-1.5 pr-2">{formatDate(p.at)}</td>
                        <td className="px-2 py-1.5">{PAYMENT_METHOD[p.method]}</td>
                        <td className="px-2 py-1.5">{p.reference ?? "—"}</td>
                        <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{formatTnd(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 tabular-nums">
                <div className="flex justify-between gap-4">
                  <dt>Déjà réglé</dt>
                  <dd>{formatTnd(paid)}</dd>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>Reste à payer</dt>
                  <dd>{formatTnd(balance)}</dd>
                </div>
              </dl>
            </section>

            {settings.invoiceFooter && (
              <footer className="border-t border-border pt-4 text-center text-xs text-muted">{settings.invoiceFooter}</footer>
            )}
          </article>
        </div>

        <aside className="space-y-4 print:hidden">
          <Card title="Situation">
            <dl className="space-y-2 text-sm tabular-nums">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Statut</dt>
                <dd>
                  <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Total TTC</dt>
                <dd>{formatTnd(invoice.total)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Payé</dt>
                <dd>{formatTnd(paid)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Reste à payer</dt>
                <dd>{formatTnd(balance)}</dd>
              </div>
            </dl>
          </Card>

          {showPayment && (
            <Card title="Enregistrer un paiement">
              <PaymentForm action={recordPaymentAction.bind(null, invoice.id)} defaultAmount={formatTndPlain(balance)} />
            </Card>
          )}

          {showCancel && (
            <Card title="Annulation">
              <p className="mb-3 text-sm text-muted">
                Une facture sans encaissement peut être annulée. Elle reste numérotée et conservée dans l&apos;historique.
              </p>
              <form action={cancelInvoiceAction.bind(null, invoice.id)}>
                <ConfirmSubmit message={`Annuler la facture ${invoice.number} ? Cette action est irréversible.`} className="w-full">
                  Annuler la facture
                </ConfirmSubmit>
              </form>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
