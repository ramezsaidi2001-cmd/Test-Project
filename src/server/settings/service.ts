import "server-only";
import type { Branch, VehicleCategory } from "@/domain/fleet/types";
import type { RentalExtra, SeasonalRate } from "@/domain/rentals/types";
import type { AgencySettings } from "@/domain/settings/types";
import { fail, scope, scopeAny, type Result } from "@/server/core";
import { newId, resetTenantData } from "@/server/store";
import type { TenantContext } from "@/server/tenancy/context";

export function getSettingsOverview(ctx: TenantContext) {
  const data = scopeAny(ctx, ["tenant.manage", "members.view"]);
  return {
    settings: data.settings,
    categories: data.categories,
    seasons: [...data.seasons].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    extras: data.extras,
    branches: data.branches,
    vehicleCountByCategory: Object.fromEntries(
      data.categories.map((c) => [c.id, data.vehicles.filter((v) => v.categoryId === c.id).length]),
    ),
    vehicleCountByBranch: Object.fromEntries(
      data.branches.map((b) => [b.id, data.vehicles.filter((v) => v.branchId === b.id).length]),
    ),
  };
}

export type AgencySettingsInput = Omit<AgencySettings, "tenantId">;

export function updateAgencySettings(ctx: TenantContext, input: AgencySettingsInput): Result {
  const data = scope(ctx, "tenant.manage");
  Object.assign(data.settings, input);
  return { ok: true };
}

export type CategoryInput = Omit<VehicleCategory, "id">;

export function saveCategory(ctx: TenantContext, id: string | null, input: CategoryInput): Result {
  const data = scope(ctx, "tenant.manage");
  const code = input.code.toUpperCase();
  if (data.categories.some((c) => c.id !== id && c.code === code)) return fail("Ce code de catégorie existe déjà.", "code");
  if (input.weeklyDailyRate > input.dailyRate) {
    return fail("Le tarif semaine doit être inférieur ou égal au tarif journalier.", "weeklyDailyRate");
  }
  if (id) {
    const category = data.categories.find((c) => c.id === id);
    if (!category) return fail("Catégorie introuvable.");
    // Existing contracts keep their frozen rate snapshot; only new bookings use the new rates.
    Object.assign(category, { ...input, code });
  } else {
    data.categories.push({ ...input, code, id: newId("cat") });
  }
  return { ok: true };
}

export type SeasonInput = Omit<SeasonalRate, "id">;

export function createSeason(ctx: TenantContext, input: SeasonInput): Result {
  const data = scope(ctx, "tenant.manage");
  if (input.endDate < input.startDate) return fail("La date de fin doit suivre la date de début.", "endDate");
  data.seasons.push({ ...input, id: newId("ss") });
  return { ok: true };
}

export function deleteSeason(ctx: TenantContext, id: string): Result {
  const data = scope(ctx, "tenant.manage");
  data.seasons = data.seasons.filter((s) => s.id !== id);
  return { ok: true };
}

export type ExtraInput = Omit<RentalExtra, "id">;

export function saveExtra(ctx: TenantContext, id: string | null, input: ExtraInput): Result {
  const data = scope(ctx, "tenant.manage");
  if (id) {
    const extra = data.extras.find((e) => e.id === id);
    if (!extra) return fail("Option introuvable.");
    Object.assign(extra, input);
  } else {
    data.extras.push({ ...input, id: newId("ex") });
  }
  return { ok: true };
}

export type BranchInput = Omit<Branch, "id">;

export function saveBranch(ctx: TenantContext, id: string | null, input: BranchInput): Result {
  const data = scope(ctx, "tenant.manage");
  if (id) {
    const branch = data.branches.find((b) => b.id === id);
    if (!branch) return fail("Agence introuvable.");
    Object.assign(branch, input);
  } else {
    data.branches.push({ ...input, id: newId("br") });
  }
  return { ok: true };
}

export function resetDemoData(ctx: TenantContext): Result {
  scope(ctx, "tenant.manage");
  resetTenantData(ctx.tenant.id);
  return { ok: true };
}
