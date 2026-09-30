import "server-only";
import { invoiceBalance } from "@/domain/billing/invoice";
import { customerRisk } from "@/domain/customers/risk";
import type { Customer } from "@/domain/customers/types";
import { customerName, fail, scope, scopeAny, type Result } from "@/server/core";
import { newId } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

export type CustomerFilters = { q?: string; kind?: string; risk?: string };

export function listCustomers(ctx: TenantContext, filters: CustomerFilters = {}) {
  const data = scope(ctx, "customers.view");
  const now = new Date();
  const q = filters.q?.trim().toLowerCase();

  return data.customers
    .filter((c) => !filters.kind || c.kind === filters.kind)
    .filter(
      (c) =>
        !q ||
        `${c.firstName} ${c.lastName} ${c.companyName ?? ""} ${c.idNumber} ${c.phone} ${c.email ?? ""} ${c.taxId ?? ""}`
          .toLowerCase()
          .includes(q),
    )
    .map((customer) => {
      const risk = customerRisk(customer, data.contracts, data.invoices, now);
      const contracts = data.contracts.filter((c) => c.customerId === customer.id && c.status !== "annulee");
      const balance = data.invoices.filter((i) => i.customerId === customer.id).reduce((s, i) => s + invoiceBalance(i), 0);
      return { customer, name: customerName(customer), risk, contractCount: contracts.length, balance };
    })
    .filter((row) => !filters.risk || row.risk.level === filters.risk)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomerDetail(ctx: TenantContext, id: string) {
  const data = scope(ctx, "customers.view");
  const customer = data.customers.find((c) => c.id === id);
  if (!customer) return null;
  const now = new Date();

  const contracts = data.contracts
    .filter((c) => c.customerId === id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .map((contract) => ({ contract, vehicle: data.vehicles.find((v) => v.id === contract.vehicleId)! }));
  const invoices = data.invoices.filter((i) => i.customerId === id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const totalSpent = invoices.filter((i) => i.status !== "annulee").reduce((s, i) => s + i.total, 0);

  return {
    customer,
    name: customerName(customer),
    risk: customerRisk(customer, data.contracts, data.invoices, now),
    contracts,
    invoices,
    totalSpent,
    balance: invoices.reduce((s, i) => s + invoiceBalance(i), 0),
  };
}

/** Lightweight list for pickers (reservation form). */
export function customerOptions(ctx: TenantContext) {
  const data = scopeAny(ctx, ["customers.view", "contracts.manage"]);
  const now = new Date();
  return data.customers
    .map((c) => ({
      id: c.id,
      name: customerName(c),
      idNumber: c.idNumber,
      phone: c.phone,
      risk: customerRisk(c, data.contracts, data.invoices, now).level,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CustomerInput = Omit<Customer, "id" | "tenantId" | "blacklisted" | "blacklistReason" | "createdAt">;

function duplicate(ctx: TenantContext, input: CustomerInput, excludeId?: string): Result {
  const data = scope(ctx, "customers.manage");
  const idNumber = input.idNumber.replace(/\s/g, "").toUpperCase();
  const clash = data.customers.find(
    (c) => c.id !== excludeId && c.idType === input.idType && c.idNumber.replace(/\s/g, "").toUpperCase() === idNumber,
  );
  if (clash) return fail(`Ce numéro de pièce d'identité est déjà enregistré (${customerName(clash)}).`, "idNumber");
  return { ok: true };
}

export function createCustomer(ctx: TenantContext, input: CustomerInput): Result<{ id: string }> {
  const data = scope(ctx, "customers.manage");
  const check = duplicate(ctx, input);
  if (!check.ok) return check;
  const customer: Customer = {
    ...input,
    id: newId("cus"),
    tenantId: ctx.tenant.id,
    blacklisted: false,
    blacklistReason: null,
    createdAt: new Date().toISOString(),
  };
  data.customers.push(customer);
  return { ok: true, id: customer.id };
}

export function updateCustomer(ctx: TenantContext, id: string, input: CustomerInput): Result {
  const data = scope(ctx, "customers.manage");
  const customer = data.customers.find((c) => c.id === id);
  if (!customer) return fail("Client introuvable.");
  const check = duplicate(ctx, input, id);
  if (!check.ok) return check;
  Object.assign(customer, input);
  return { ok: true };
}

export function setBlacklist(ctx: TenantContext, id: string, blacklisted: boolean, reason: string | null): Result {
  const data = scope(ctx, "customers.manage");
  const customer = data.customers.find((c) => c.id === id);
  if (!customer) return fail("Client introuvable.");
  if (blacklisted && !reason?.trim()) return fail("Indiquez le motif de l'inscription sur liste noire.", "reason");
  customer.blacklisted = blacklisted;
  customer.blacklistReason = blacklisted ? reason!.trim() : null;
  return { ok: true };
}
