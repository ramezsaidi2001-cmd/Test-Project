import type { Millimes } from "../shared/money";
import type { Invoice, InvoiceStatus } from "./types";

export function amountPaid(invoice: Invoice): Millimes {
  return invoice.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function invoiceBalance(invoice: Invoice): Millimes {
  if (invoice.status === "annulee") return 0;
  return Math.max(0, invoice.total - amountPaid(invoice));
}

export function statusAfterPayments(invoice: Invoice): InvoiceStatus {
  if (invoice.status === "annulee") return "annulee";
  const paid = amountPaid(invoice);
  if (paid >= invoice.total) return "payee";
  return paid > 0 ? "partiellement_payee" : "emise";
}

export function isOverdue(invoice: Invoice, now: Date): boolean {
  return invoiceBalance(invoice) > 0 && new Date(invoice.dueAt) < now;
}

/** Display status, including the derived "en_retard". */
export function displayStatus(invoice: Invoice, now: Date): InvoiceStatus | "en_retard" {
  return isOverdue(invoice, now) ? "en_retard" : invoice.status;
}
