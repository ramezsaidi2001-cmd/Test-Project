import type { Invoice } from "../billing/types";
import { invoiceBalance, isOverdue } from "../billing/invoice";
import type { Contract } from "../rentals/types";
import { DAY } from "../shared/dates";
import type { Millimes } from "../shared/money";
import type { Customer } from "./types";

export type RiskLevel = "faible" | "moyen" | "eleve" | "bloque";

export type CustomerRisk = {
  level: RiskLevel;
  flags: string[];
  lateReturns: number;
  damages: number;
  overdueBalance: Millimes;
};

export const MIN_LICENSE_YEARS = 2;
const LATE_GRACE_MS = 60 * 60 * 1000;

export function customerRisk(customer: Customer, contracts: Contract[], invoices: Invoice[], now: Date): CustomerRisk {
  const flags: string[] = [];
  const mine = contracts.filter((c) => c.customerId === customer.id);

  const lateReturns = mine.filter((c) => {
    if (c.checkin) return new Date(c.checkin.at).getTime() > new Date(c.endAt).getTime() + LATE_GRACE_MS;
    return c.status === "en_cours" && now.getTime() > new Date(c.endAt).getTime() + LATE_GRACE_MS;
  }).length;
  const damages = mine.reduce((n, c) => n + (c.checkin?.damages.length ?? 0), 0);
  const overdueBalance = invoices
    .filter((i) => i.customerId === customer.id && isOverdue(i, now))
    .reduce((sum, i) => sum + invoiceBalance(i), 0);

  if (customer.blacklisted) flags.push(`Liste noire${customer.blacklistReason ? ` : ${customer.blacklistReason}` : ""}`);
  if (lateReturns > 0) flags.push(`${lateReturns} retour(s) en retard`);
  if (damages > 0) flags.push(`${damages} dommage(s) déclaré(s)`);
  if (overdueBalance > 0) flags.push("Factures impayées en retard");

  let licenseExpired = false;
  if (customer.licenseExpiry && new Date(customer.licenseExpiry) < now) {
    licenseExpired = true;
    flags.push("Permis de conduire expiré");
  }
  if (customer.licenseIssueDate) {
    const years = (now.getTime() - new Date(customer.licenseIssueDate).getTime()) / (365.25 * DAY);
    if (years < MIN_LICENSE_YEARS) flags.push(`Permis de moins de ${MIN_LICENSE_YEARS} ans`);
  }

  let level: RiskLevel = "faible";
  if (customer.blacklisted) level = "bloque";
  else if (overdueBalance > 0 || lateReturns >= 2 || damages >= 2 || licenseExpired) level = "eleve";
  else if (flags.length > 0) level = "moyen";

  return { level, flags, lateReturns, damages, overdueBalance };
}

export const RISK_LABEL: Record<RiskLevel, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  faible: { label: "Risque faible", tone: "success" },
  moyen: { label: "Risque moyen", tone: "warning" },
  eleve: { label: "Risque élevé", tone: "danger" },
  bloque: { label: "Liste noire", tone: "danger" },
};
