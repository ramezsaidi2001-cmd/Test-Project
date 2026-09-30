"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FuelLevel } from "@/domain/fleet/types";
import type { Damage, DepositMethod, RateSnapshot } from "@/domain/rentals/types";
import { parseLocalDateTime } from "@/domain/shared/dates";
import { parseTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { bool, int, optStr, percentBp, str } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import {
  cancelReservation,
  checkinContract,
  checkoutContract,
  closeContract,
  createReservation,
  MAX_DISCOUNT_BP,
  quoteBooking,
} from "@/server/rentals/service";
import type { Fail } from "@/server/core";
import { requirePermission } from "@/server/tenancy/context";

const DEPOSIT_METHODS: DepositMethod[] = ["especes", "carte", "cheque"];

function failure(result: Fail): FormState {
  return result.field ? { error: result.error, fieldErrors: { [result.field]: [result.error] } } : { error: result.error };
}

function fuel(fd: FormData, key: string): FuelLevel | null {
  const v = int(fd, key);
  return Number.isInteger(v) && v >= 0 && v <= 8 ? (v as FuelLevel) : null;
}

export type QuoteInput = {
  vehicleId: string;
  start: string; // datetime-local (Tunis)
  end: string;
  extraIds: string[];
  discountPercent: string;
};

/** Live price preview for the booking form. Returns null when the input is incomplete or invalid. */
export async function quoteAction(input: QuoteInput): Promise<RateSnapshot | null> {
  const ctx = await requirePermission("contracts.manage");
  const start = parseLocalDateTime(input.start);
  const end = parseLocalDateTime(input.end);
  if (!input.vehicleId || !start || !end || end <= start) return null;

  const fd = new FormData();
  fd.set("discount", input.discountPercent ?? "");
  const maxDiscount = ctx.role === "admin" ? MAX_DISCOUNT_BP.admin : MAX_DISCOUNT_BP.other;
  const raw = percentBp(fd, "discount");
  const discountBp = Number.isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), maxDiscount);

  return quoteBooking(ctx, {
    vehicleId: input.vehicleId,
    start,
    end,
    extras: [...new Set(input.extraIds)].map((extraId) => ({ extraId, quantity: 1 })),
    discountBp,
  });
}

export async function createReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("contracts.manage");
  const start = parseLocalDateTime(str(formData, "start"));
  const end = parseLocalDateTime(str(formData, "end"));
  const fieldErrors: Record<string, string[]> = {};

  if (!start) fieldErrors.start = ["Date de départ invalide."];
  if (!end) fieldErrors.end = ["Date de retour invalide."];
  if (!str(formData, "vehicleId")) fieldErrors.vehicleId = ["Sélectionnez un véhicule."];
  if (!str(formData, "customerId")) fieldErrors.customerId = ["Sélectionnez un client."];
  const discountBp = percentBp(formData, "discount");
  if (Number.isNaN(discountBp)) fieldErrors.discount = ["Remise invalide (ex. : 5 ou 7,5)."];
  const depositMethod = str(formData, "depositMethod") as DepositMethod;
  if (!DEPOSIT_METHODS.includes(depositMethod)) fieldErrors.depositMethod = ["Choisissez le mode de caution."];
  if (Object.keys(fieldErrors).length > 0 || !start || !end) {
    return { error: "Veuillez corriger les champs signalés.", fieldErrors };
  }

  const extras = [...new Set(formData.getAll("extra").filter((v): v is string => typeof v === "string"))];
  const result = createReservation(ctx, {
    vehicleId: str(formData, "vehicleId"),
    customerId: str(formData, "customerId"),
    start,
    end,
    extras: extras.map((extraId) => ({ extraId, quantity: 1 })),
    discountBp,
    pickupBranchId: str(formData, "pickupBranchId"),
    returnBranchId: str(formData, "returnBranchId"),
    additionalDriver: optStr(formData, "additionalDriver"),
    depositMethod,
    notes: optStr(formData, "notes"),
  });
  if (!result.ok) return failure(result);

  revalidatePath("/reservations");
  revalidatePath("/planning");
  redirect(`/reservations/${result.id}`);
}

export async function cancelReservationAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("contracts.manage");
  const reason = str(formData, "reason");
  if (!reason) return { error: "Indiquez le motif de l'annulation.", fieldErrors: { reason: ["Indiquez le motif de l'annulation."] } };
  const result = cancelReservation(ctx, id, reason);
  if (!result.ok) return failure(result);
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
  revalidatePath("/planning");
  return { message: "Réservation annulée." };
}

export async function checkoutAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("contracts.manage");
  const km = int(formData, "km");
  const fuelLevel = fuel(formData, "fuelLevel");
  const signatureName = str(formData, "signatureName");
  const signatureImage = str(formData, "signatureImage");
  const fieldErrors: Record<string, string[]> = {};

  if (!Number.isInteger(km) || km < 0) fieldErrors.km = ["Kilométrage invalide."];
  if (fuelLevel === null) fieldErrors.fuelLevel = ["Niveau de carburant invalide."];
  if (!signatureName) fieldErrors.signatureName = ["Saisissez le nom du signataire."];
  if (!signatureImage.startsWith("data:image/")) fieldErrors.signature = ["La signature du client est requise."];
  if (!bool(formData, "terms")) fieldErrors.terms = ["Le client doit accepter les conditions générales de location."];
  if (Object.keys(fieldErrors).length > 0 || fuelLevel === null) {
    return { error: "Veuillez compléter l'état des lieux de départ.", fieldErrors };
  }

  const result = checkoutContract(ctx, id, { km, fuelLevel, notes: optStr(formData, "notes"), signatureName, signatureImage });
  if (!result.ok) return failure(result);
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
  revalidatePath("/planning");
  return { message: "Départ enregistré. Bonne route !" };
}

export async function checkinAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("contracts.manage");
  const km = int(formData, "km");
  const fuelLevel = fuel(formData, "fuelLevel");
  const fieldErrors: Record<string, string[]> = {};
  if (!Number.isInteger(km) || km < 0) fieldErrors.km = ["Kilométrage invalide."];
  if (fuelLevel === null) fieldErrors.fuelLevel = ["Niveau de carburant invalide."];

  const damages: Damage[] = [];
  try {
    const raw: unknown = JSON.parse(str(formData, "damages") || "[]");
    if (!Array.isArray(raw)) throw new Error("invalid");
    for (const row of raw as { description?: unknown; cost?: unknown }[]) {
      const description = typeof row.description === "string" ? row.description.trim() : "";
      const costText = typeof row.cost === "string" ? row.cost.trim() : "";
      if (!description && !costText) continue;
      const cost = costText === "" ? 0 : parseTnd(costText);
      if (!description || cost === null || cost < 0) {
        fieldErrors.damages = ["Chaque dommage doit avoir une description et un coût valide (en DT)."];
        break;
      }
      damages.push({ description, cost });
    }
  } catch {
    fieldErrors.damages = ["Liste des dommages invalide."];
  }
  if (Object.keys(fieldErrors).length > 0 || fuelLevel === null) {
    return { error: "Veuillez compléter l'état des lieux de retour.", fieldErrors };
  }

  const result = checkinContract(ctx, id, {
    km,
    fuelLevel,
    notes: optStr(formData, "notes"),
    damages,
    returnBranchId: str(formData, "returnBranchId"),
  });
  if (!result.ok) return failure(result);
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
  revalidatePath("/planning");
  return { message: damages.length > 0 ? "Retour enregistré. Le véhicule est envoyé à l'atelier (dommages)." : "Retour enregistré." };
}

export async function closeContractAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("contracts.manage");
  const decision = str(formData, "depositStatus");
  if (decision !== "restituee" && decision !== "retenue") {
    return { error: "Choisissez le sort de la caution.", fieldErrors: { depositStatus: ["Choisissez le sort de la caution."] } };
  }
  const result = closeContract(ctx, id, { depositStatus: decision });
  if (!result.ok) return failure(result);
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
  revalidatePath("/billing");
  // Desk agents cannot open invoices (finance.view): send them back to the closed contract.
  redirect(can(ctx.role, "finance.view") ? `/billing/${result.invoiceId}` : `/reservations/${id}`);
}
