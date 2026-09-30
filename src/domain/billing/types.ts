import type { PriceLine } from "../rentals/types";
import type { Millimes } from "../shared/money";

export type PaymentMethod = "especes" | "carte" | "cheque" | "virement" | "d17";
export type InvoiceStatus = "emise" | "partiellement_payee" | "payee" | "annulee";

export type Payment = {
  id: string;
  at: string;
  amount: Millimes;
  method: PaymentMethod;
  reference: string | null;
  recordedBy: string;
};

export type Invoice = {
  id: string;
  tenantId: string;
  number: string; // FA-2026-0001
  customerId: string;
  contractId: string | null;
  issuedAt: string;
  dueAt: string;
  lines: PriceLine[];
  subtotal: Millimes; // HT
  tvaBp: number;
  tva: Millimes;
  timbre: Millimes;
  total: Millimes; // TTC
  payments: Payment[];
  status: InvoiceStatus;
};
