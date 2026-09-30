"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bool, int, money, optStr, str } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import {
  completeWorkOrder,
  createWorkOrder,
  startWorkOrder,
  updateWorkOrderCosts,
} from "@/server/maintenance/service";
import { requirePermission } from "@/server/tenancy/context";

/** Form state that also echoes the submitted values so the form keeps them after a failed submit. */
export type WorkOrderFormState = FormState & { values?: Record<string, string> };

const cost = (label: string) => z.number({ error: `${label} : montant invalide.` }).min(0, `${label} : montant positif requis.`);
const notes = z.string().max(1000, "1 000 caractères maximum.").nullable();

const createSchema = z.object({
  vehicleId: z.string().min(1, "Sélectionnez un véhicule."),
  type: z.enum(["entretien_preventif", "reparation", "carrosserie", "pneumatiques", "visite_technique"], {
    error: "Sélectionnez un type d'intervention.",
  }),
  description: z.string().min(3, "Décrivez l'intervention.").max(300, "300 caractères maximum."),
  vendor: z.string().min(1, "Indiquez le garage ou prestataire.").max(120, "120 caractères maximum."),
  immobilizing: z.boolean(),
  partsCost: cost("Pièces"),
  laborCost: cost("Main-d'œuvre"),
  notes,
});

/** Empty money input → 0 (estimates are optional). */
const optMoney = (fd: FormData, key: string) => (str(fd, key) === "" ? 0 : money(fd, key));

function formValues(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function fromResult(result: { error: string; field?: string }): FormState {
  return result.field
    ? { error: "Veuillez corriger les champs signalés.", fieldErrors: { [result.field]: [result.error] } }
    : { error: result.error };
}

export async function createWorkOrderAction(_prev: WorkOrderFormState, formData: FormData): Promise<WorkOrderFormState> {
  const ctx = await requirePermission("maintenance.manage");
  const values = formValues(formData);
  const parsed = createSchema.safeParse({
    vehicleId: str(formData, "vehicleId"),
    type: str(formData, "type"),
    description: str(formData, "description"),
    vendor: str(formData, "vendor"),
    immobilizing: bool(formData, "immobilizing"),
    partsCost: optMoney(formData, "partsCost"),
    laborCost: optMoney(formData, "laborCost"),
    notes: optStr(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Veuillez corriger les champs signalés.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const result = createWorkOrder(ctx, parsed.data);
  if (!result.ok) return { ...fromResult(result), values };

  revalidatePath("/maintenance");
  revalidatePath(`/fleet/${parsed.data.vehicleId}`);
  redirect(`/maintenance/${result.id}`);
}

export async function startWorkOrderAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("maintenance.manage");
  const result = startWorkOrder(ctx, id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/maintenance/${id}`);
  return { message: "Travaux démarrés." };
}

const costsSchema = z.object({
  vendor: z.string().min(1, "Indiquez le garage ou prestataire.").max(120, "120 caractères maximum."),
  partsCost: cost("Pièces"),
  laborCost: cost("Main-d'œuvre"),
  notes,
});

export async function updateWorkOrderCostsAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("maintenance.manage");
  const parsed = costsSchema.safeParse({
    vendor: str(formData, "vendor"),
    partsCost: optMoney(formData, "partsCost"),
    laborCost: optMoney(formData, "laborCost"),
    notes: optStr(formData, "notes"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const result = updateWorkOrderCosts(ctx, id, parsed.data);
  if (!result.ok) return fromResult(result);
  revalidatePath(`/maintenance/${id}`);
  return { message: "Ordre de travail mis à jour." };
}

const completeSchema = z.object({
  km: z.number({ error: "Saisissez un kilométrage valide." }).int("Saisissez un kilométrage valide.").min(0, "Saisissez un kilométrage valide."),
  partsCost: cost("Pièces"),
  laborCost: cost("Main-d'œuvre"),
  notes,
});

export async function completeWorkOrderAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("maintenance.manage");
  const parsed = completeSchema.safeParse({
    km: int(formData, "km"),
    partsCost: optMoney(formData, "partsCost"),
    laborCost: optMoney(formData, "laborCost"),
    notes: optStr(formData, "notes"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const result = completeWorkOrder(ctx, id, parsed.data);
  if (!result.ok) return fromResult(result);
  revalidatePath(`/maintenance/${id}`);
  revalidatePath("/maintenance");
  return { message: "Ordre de travail clôturé." };
}
