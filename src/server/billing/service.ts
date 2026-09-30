import "server-only";
import { amountPaid, displayStatus, invoiceBalance, isOverdue, statusAfterPayments } from "@/domain/billing/invoice";
import type { PaymentMethod } from "@/domain/billing/types";
import { tunisDay } from "@/domain/shared/dates";
import type { Millimes } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { customerName, fail, scope, scopeAny, type Result } from "@/server/core";
import { newId } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

export type InvoiceFilters = { status?: string; q?: string };

export function listInvoices(ctx: TenantContext, filters: InvoiceFilters = {}) {
  const data = scopeAny(ctx, ["finance.view", "contracts.view"]);
  const now = new Date();
  const q = filters.q?.trim().toLowerCase();

  return data.invoices
    .map((invoice) => {
      const customer = data.customers.find((c) => c.id === invoice.customerId)!;
      return {
        invoice,
        customerName: customerName(customer),
        status: displayStatus(invoice, now),
        paid: amountPaid(invoice),
        balance: invoiceBalance(invoice),
      };
    })
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => !q || `${r.invoice.number} ${r.customerName}`.toLowerCase().includes(q))
    .sort((a, b) => b.invoice.issuedAt.localeCompare(a.invoice.issuedAt));
}

export function billingSummary(ctx: TenantContext) {
  const data = scopeAny(ctx, ["finance.view", "contracts.view"]);
  const now = new Date();
  const month = tunisDay(now).slice(0, 7);
  const active = data.invoices.filter((i) => i.status !== "annulee");
  const thisMonth = active.filter((i) => tunisDay(i.issuedAt).startsWith(month));
  const collectedThisMonth = active
    .flatMap((i) => i.payments)
    .filter((p) => tunisDay(p.at).startsWith(month))
    .reduce((s, p) => s + p.amount, 0);

  return {
    invoicedThisMonth: thisMonth.reduce((s, i) => s + i.total, 0),
    collectedThisMonth,
    outstanding: active.reduce((s, i) => s + invoiceBalance(i), 0),
    overdue: active.filter((i) => isOverdue(i, now)).reduce((s, i) => s + invoiceBalance(i), 0),
    overdueCount: active.filter((i) => isOverdue(i, now)).length,
  };
}

export function getInvoiceDetail(ctx: TenantContext, id: string) {
  const data = scopeAny(ctx, ["finance.view", "contracts.view"]);
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) return null;
  const customer = data.customers.find((c) => c.id === invoice.customerId)!;
  const contract = invoice.contractId ? (data.contracts.find((c) => c.id === invoice.contractId) ?? null) : null;
  const vehicle = contract ? (data.vehicles.find((v) => v.id === contract.vehicleId) ?? null) : null;

  return {
    invoice,
    customer,
    customerName: customerName(customer),
    contract,
    vehicle,
    settings: data.settings,
    paid: amountPaid(invoice),
    balance: invoiceBalance(invoice),
    status: displayStatus(invoice, new Date()),
  };
}

/** Desk agents collect payments at the counter; accountants record transfers and cheques. */
export function canRecordPayment(ctx: TenantContext) {
  return can(ctx.role, "finance.manage") || can(ctx.role, "contracts.manage");
}

export function recordPayment(
  ctx: TenantContext,
  id: string,
  input: { amount: Millimes; method: PaymentMethod; reference: string | null },
): Result {
  const data = scopeAny(ctx, ["finance.manage", "contracts.manage"]);
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) return fail("Facture introuvable.");
  if (invoice.status === "annulee") return fail("Cette facture est annulée.");
  const balance = invoiceBalance(invoice);
  if (input.amount <= 0) return fail("Le montant doit être positif.", "amount");
  if (input.amount > balance) return fail("Le montant dépasse le reste à payer.", "amount");
  if ((input.method === "cheque" || input.method === "virement") && !input.reference?.trim()) {
    return fail("Indiquez le numéro du chèque ou la référence du virement.", "reference");
  }

  invoice.payments.push({
    id: newId("pay"),
    at: new Date().toISOString(),
    amount: input.amount,
    method: input.method,
    reference: input.reference?.trim() || null,
    recordedBy: ctx.user.name,
  });
  invoice.status = statusAfterPayments(invoice);
  return { ok: true };
}

export function cancelInvoice(ctx: TenantContext, id: string): Result {
  const data = scope(ctx, "finance.manage");
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) return fail("Facture introuvable.");
  if (invoice.payments.length > 0) return fail("Impossible d'annuler une facture ayant des encaissements. Émettez un avoir.");
  invoice.status = "annulee";
  return { ok: true };
}
