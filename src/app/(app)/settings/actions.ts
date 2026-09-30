"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bool, int, money, optStr, percentBp, str } from "@/lib/form-data";
import type { Result } from "@/server/core";
import {
  createSeason,
  deleteSeason,
  getSettingsOverview,
  saveBranch,
  saveCategory,
  saveExtra,
  updateAgencySettings,
} from "@/server/settings/service";
import { requirePermission } from "@/server/tenancy/context";
import type { EntityFormState } from "./entity-form";

/** Submitted values echoed back so the form keeps them on error. */
function values(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith("$") && typeof v === "string") out[k] = v;
  return out;
}

function invalid(fd: FormData, error: z.ZodError): EntityFormState {
  return { fieldErrors: z.flattenError(error).fieldErrors, values: values(fd) };
}

function failed(fd: FormData, result: Extract<Result, { ok: false }>): EntityFormState {
  return result.field
    ? { fieldErrors: { [result.field]: [result.error] }, values: values(fd) }
    : { error: result.error, values: values(fd) };
}

const text = (label: string, max = 160) => z.string().min(1, `${label} est obligatoire.`).max(max, `${max} caractères maximum.`);
const optionalText = (max = 160) => z.string().max(max, `${max} caractères maximum.`);
const amount = (msg = "Montant invalide.") => z.number({ error: msg }).int().min(0, "Le montant ne peut pas être négatif.");
const positiveAmount = (msg = "Montant invalide.") => z.number({ error: msg }).int().positive("Le montant doit être supérieur à zéro.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

// ---------------------------------------------------------------- Agence

const agencySchema = z.object({
  tradeName: text("Le nom commercial", 120),
  legalName: text("La raison sociale", 160),
  taxId: text("Le matricule fiscal", 40),
  rne: optionalText(40),
  address: text("L'adresse", 200),
  city: text("La ville", 80),
  phone: text("Le téléphone", 40),
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]),
  tvaBp: z.number({ error: "Taux invalide." }).int().min(0, "Taux invalide.").max(10000, "Taux invalide."),
  timbre: amount(),
  paymentTermDays: z.number({ error: "Nombre de jours invalide." }).int().min(0, "Minimum 0 jour.").max(365, "Maximum 365 jours."),
  invoiceFooter: optionalText(500),
  fuelChargePerEighth: amount(),
  lateGraceMinutes: z.number({ error: "Nombre de minutes invalide." }).int().min(0, "Minimum 0 minute.").max(1440, "Maximum 1 440 minutes."),
  contractTerms: optionalText(10000),
});

export async function updateAgencyAction(_prev: EntityFormState, fd: FormData): Promise<EntityFormState> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = agencySchema.safeParse({
    tradeName: str(fd, "tradeName"),
    legalName: str(fd, "legalName"),
    taxId: str(fd, "taxId"),
    rne: str(fd, "rne"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    tvaBp: str(fd, "tvaBp") === "" ? Number.NaN : percentBp(fd, "tvaBp"),
    timbre: money(fd, "timbre"),
    paymentTermDays: int(fd, "paymentTermDays"),
    invoiceFooter: str(fd, "invoiceFooter"),
    fuelChargePerEighth: money(fd, "fuelChargePerEighth"),
    lateGraceMinutes: int(fd, "lateGraceMinutes"),
    contractTerms: str(fd, "contractTerms")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n"),
  });
  if (!parsed.success) return invalid(fd, parsed.error);

  const result = updateAgencySettings(ctx, parsed.data);
  if (!result.ok) return failed(fd, result);
  revalidatePath("/", "layout");
  return { message: "Paramètres enregistrés." };
}

// ---------------------------------------------------------------- Catégories

const categorySchema = z.object({
  code: z
    .string()
    .min(1, "Le code est obligatoire.")
    .max(8, "8 caractères maximum.")
    .regex(/^[A-Za-z0-9-]+$/, "Lettres, chiffres et tirets uniquement."),
  name: text("Le nom", 80),
  dailyRate: positiveAmount(),
  weeklyDailyRate: positiveAmount(),
  deposit: amount(),
  kmPerDay: z.number({ error: "Kilométrage invalide." }).int().positive("Kilométrage invalide.").nullable(),
  extraKmRate: amount(),
});

export async function saveCategoryAction(id: string | null, _prev: EntityFormState, fd: FormData): Promise<EntityFormState> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = categorySchema.safeParse({
    code: str(fd, "code"),
    name: str(fd, "name"),
    dailyRate: money(fd, "dailyRate"),
    weeklyDailyRate: money(fd, "weeklyDailyRate"),
    deposit: money(fd, "deposit"),
    kmPerDay: str(fd, "kmPerDay") === "" ? null : int(fd, "kmPerDay"),
    extraKmRate: str(fd, "extraKmRate") === "" ? 0 : money(fd, "extraKmRate"),
  });
  if (!parsed.success) return invalid(fd, parsed.error);

  const result = saveCategory(ctx, id, parsed.data);
  if (!result.ok) return failed(fd, result);
  revalidatePath("/settings/tarifs");
  redirect("/settings/tarifs");
}

// ---------------------------------------------------------------- Saisons

const seasonSchema = z
  .object({
    name: text("Le nom", 80),
    startDate: date,
    endDate: date,
    adjustmentBp: z
      .number({ error: "Pourcentage invalide." })
      .int()
      .min(-9000, "Minimum −90 %.")
      .max(20000, "Maximum +200 %.")
      .refine((n) => n !== 0, "L'ajustement ne peut pas être nul."),
  })
  .refine((s) => s.endDate >= s.startDate, { path: ["endDate"], message: "La date de fin doit suivre la date de début." });

/** "+30", "30", "-15" or "−12,5" → basis points; NaN when empty or invalid. */
function signedPercentBp(fd: FormData, key: string) {
  const v = str(fd, key).replace(/\s|%/g, "").replace("−", "-").replace(/^\+/, "").replace(",", ".");
  return /^-?\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : Number.NaN;
}

export async function createSeasonAction(_prev: EntityFormState, fd: FormData): Promise<EntityFormState> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = seasonSchema.safeParse({
    name: str(fd, "name"),
    startDate: str(fd, "startDate"),
    endDate: str(fd, "endDate"),
    adjustmentBp: signedPercentBp(fd, "adjustmentBp"),
  });
  if (!parsed.success) return invalid(fd, parsed.error);

  const result = createSeason(ctx, parsed.data);
  if (!result.ok) return failed(fd, result);
  revalidatePath("/settings/tarifs");
  return { message: `Saison « ${parsed.data.name} » ajoutée.` };
}

export async function deleteSeasonAction(id: string) {
  const ctx = await requirePermission("tenant.manage");
  deleteSeason(ctx, id);
  revalidatePath("/settings/tarifs");
}

// ---------------------------------------------------------------- Options

const extraSchema = z.object({
  name: text("Le nom", 80),
  pricing: z.enum(["par_jour", "forfait"], { error: "Choisissez une tarification." }),
  price: amount(),
  active: z.boolean(),
});

export async function saveExtraAction(id: string | null, _prev: EntityFormState, fd: FormData): Promise<EntityFormState> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = extraSchema.safeParse({
    name: str(fd, "name"),
    pricing: str(fd, "pricing"),
    price: money(fd, "price"),
    active: bool(fd, "active"),
  });
  if (!parsed.success) return invalid(fd, parsed.error);

  const result = saveExtra(ctx, id, parsed.data);
  if (!result.ok) return failed(fd, result);
  revalidatePath("/settings/tarifs");
  redirect("/settings/tarifs");
}

export async function toggleExtraAction(id: string) {
  const ctx = await requirePermission("tenant.manage");
  const extra = getSettingsOverview(ctx).extras.find((e) => e.id === id);
  if (!extra) return;
  const { id: _id, ...input } = extra;
  void _id;
  saveExtra(ctx, id, { ...input, active: !extra.active });
  revalidatePath("/settings/tarifs");
}

// ---------------------------------------------------------------- Agences / points de retrait

const branchSchema = z.object({
  name: text("Le nom", 80),
  city: text("La ville", 80),
  kind: z.enum(["agence", "aeroport"], { error: "Choisissez un type." }),
  address: text("L'adresse", 200),
  phone: optionalText(40),
});

export async function saveBranchAction(id: string | null, _prev: EntityFormState, fd: FormData): Promise<EntityFormState> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = branchSchema.safeParse({
    name: str(fd, "name"),
    city: str(fd, "city"),
    kind: str(fd, "kind"),
    address: str(fd, "address"),
    phone: optStr(fd, "phone") ?? "",
  });
  if (!parsed.success) return invalid(fd, parsed.error);

  const result = saveBranch(ctx, id, parsed.data);
  if (!result.ok) return failed(fd, result);
  revalidatePath("/settings/agences");
  redirect("/settings/agences");
}
