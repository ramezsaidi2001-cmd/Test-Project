import "server-only";
import { seedTenant } from "./seed";
import type { TenantData } from "./types";

// Demo/testing persistence: in-memory, per tenant, kept on globalThis so it survives hot reloads.
// Data resets when the server restarts (and is per-instance on serverless hosts).
// Replace with Supabase repositories for production.
const g = globalThis as unknown as { __fleetlyStore?: Map<string, TenantData> };
const store = (g.__fleetlyStore ??= new Map());

export function getTenantData(tenantId: string, tenantName?: string): TenantData {
  let data = store.get(tenantId);
  if (!data) {
    // Anchor the seed to the start of the current hour so that separate server instances
    // (serverless) generate identical baseline data and ids within that hour.
    const anchor = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    data = seedTenant(tenantId, anchor, tenantName);
    store.set(tenantId, data);
  }
  return data;
}

export function resetTenantData(tenantId: string) {
  store.delete(tenantId);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Sequential document numbers per tenant and year, e.g. CT-2026-0042. */
export function nextNumber(data: TenantData, prefix: "CT" | "FA" | "OT", at = new Date()): string {
  const year = at.getFullYear();
  const key = `${prefix}-${year}`;
  const n = (data.counters[key] ?? 0) + 1;
  data.counters[key] = n;
  return `${key}-${String(n).padStart(4, "0")}`;
}
