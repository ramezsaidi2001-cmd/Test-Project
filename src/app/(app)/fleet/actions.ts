"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FuelLevel } from "@/domain/fleet/types";
import { parseLocalDate } from "@/domain/shared/dates";
import { int, money, optStr, str } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import { createVehicle, recordMileage, setOutOfService, updateVehicle, type VehicleInput } from "@/server/fleet/service";
import { requirePermission } from "@/server/tenancy/context";

/** Form state that also echoes the submitted values so the form keeps them after a failed submit. */
export type VehicleFormState = FormState & { values?: Record<string, string> };

const CURRENT_YEAR = new Date().getFullYear();

const integer = (message: string) => z.number({ error: message }).int(message);
const requiredText = (message: string, max = 80) => z.string().min(1, message).max(max, `${max} caractères maximum.`);
const requiredDate = (message: string) => z.string().min(1, message);

const vehicleSchema = z.object({
  plate: z
    .string()
    .min(1, "Saisissez l'immatriculation.")
    .regex(/^(\d{1,3}\s*TU\s*\d{1,4}|RS\s*\d{1,6})$/i, "Immatriculation invalide (ex. 245 TU 1234)."),
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "Le numéro de châssis (VIN) doit comporter 17 caractères (sans I, O ni Q)."),
  make: requiredText("Saisissez la marque."),
  model: requiredText("Saisissez le modèle."),
  trim: z.string().max(80, "80 caractères maximum."),
  year: integer("Année invalide.")
    .min(1990, "Année invalide.")
    .max(CURRENT_YEAR + 1, "Année invalide."),
  color: requiredText("Saisissez la couleur.", 40),
  categoryId: z.string().min(1, "Sélectionnez une catégorie."),
  fuel: z.enum(["essence", "diesel", "hybride", "electrique"], { error: "Sélectionnez un carburant." }),
  transmission: z.enum(["manuelle", "automatique"], { error: "Sélectionnez une boîte de vitesses." }),
  seats: integer("Nombre de places invalide.").min(2, "2 places minimum.").max(9, "9 places maximum."),
  branchId: z.string().min(1, "Sélectionnez une agence."),
  serviceIntervalKm: integer("Intervalle invalide.")
    .min(1000, "1 000 km minimum.")
    .max(100000, "100 000 km maximum."),
  nextServiceKm: integer("Kilométrage invalide.").min(0, "Kilométrage invalide."),
  acquisitionDate: requiredDate("Date d'acquisition invalide."),
  acquisitionCost: z.number({ error: "Montant invalide." }).min(0, "Le montant doit être positif."),
  gpsDeviceId: z.string().max(60, "60 caractères maximum.").nullable(),
  registrationNumber: requiredText("Saisissez le numéro de carte grise.", 40),
  insurer: requiredText("Saisissez l'assureur."),
  insuranceExpiry: requiredDate("Date d'expiration de l'assurance invalide."),
  technicalInspectionExpiry: requiredDate("Date de la visite technique invalide."),
  vignetteExpiry: requiredDate("Date de la vignette invalide."),
});

const mileageSchema = z.object({
  mileage: integer("Kilométrage invalide.").min(0, "Kilométrage invalide.").max(2_000_000, "Kilométrage invalide."),
});

/** `<input type="date">` → ISO string, or "" when missing/invalid (rejected by the schema). */
function isoDate(fd: FormData, key: string) {
  return parseLocalDate(str(fd, key))?.toISOString() ?? "";
}

function formValues(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

type ParsedVehicle = { ok: true; input: Omit<VehicleInput, "mileage">; mileage: number } | { ok: false; state: VehicleFormState };

function parseVehicle(fd: FormData, withMileage: boolean): ParsedVehicle {
  const values = formValues(fd);
  const mileage = withMileage ? int(fd, "mileage") : 0;
  const serviceIntervalKm = int(fd, "serviceIntervalKm");
  // On creation, an empty "next service" defaults to current mileage + interval.
  const nextServiceKm =
    withMileage && str(fd, "nextServiceKm") === "" ? mileage + serviceIntervalKm : int(fd, "nextServiceKm");

  const raw = {
    plate: str(fd, "plate"),
    vin: str(fd, "vin").replace(/\s+/g, ""),
    make: str(fd, "make"),
    model: str(fd, "model"),
    trim: str(fd, "trim"),
    year: int(fd, "year"),
    color: str(fd, "color"),
    categoryId: str(fd, "categoryId"),
    fuel: str(fd, "fuel"),
    transmission: str(fd, "transmission"),
    seats: int(fd, "seats"),
    branchId: str(fd, "branchId"),
    serviceIntervalKm,
    nextServiceKm,
    acquisitionDate: isoDate(fd, "acquisitionDate"),
    acquisitionCost: money(fd, "acquisitionCost"),
    gpsDeviceId: optStr(fd, "gpsDeviceId"),
    registrationNumber: str(fd, "registrationNumber"),
    insurer: str(fd, "insurer"),
    insuranceExpiry: isoDate(fd, "insuranceExpiry"),
    technicalInspectionExpiry: isoDate(fd, "technicalInspectionExpiry"),
    vignetteExpiry: isoDate(fd, "vignetteExpiry"),
  };

  const parsed = vehicleSchema.safeParse(raw);
  const parsedMileage = withMileage ? mileageSchema.safeParse({ mileage }) : null;
  const fieldErrors: Record<string, string[] | undefined> = {
    ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
    ...(parsedMileage && !parsedMileage.success ? z.flattenError(parsedMileage.error).fieldErrors : {}),
  };
  if (parsed.success && withMileage && parsed.data.nextServiceKm < mileage) {
    fieldErrors.nextServiceKm = ["Le prochain entretien doit être supérieur au kilométrage actuel."];
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { error: "Veuillez corriger les champs signalés.", fieldErrors, values } };
  }

  const d = parsed.data;
  return {
    ok: true,
    mileage,
    input: {
      plate: d.plate,
      vin: d.vin,
      make: d.make,
      model: d.model,
      trim: d.trim,
      year: d.year,
      color: d.color,
      categoryId: d.categoryId,
      fuel: d.fuel,
      transmission: d.transmission,
      seats: d.seats,
      branchId: d.branchId,
      serviceIntervalKm: d.serviceIntervalKm,
      nextServiceKm: d.nextServiceKm,
      acquisitionDate: d.acquisitionDate,
      acquisitionCost: d.acquisitionCost,
      gpsDeviceId: d.gpsDeviceId,
      documents: {
        registrationNumber: d.registrationNumber,
        insurer: d.insurer,
        insuranceExpiry: d.insuranceExpiry,
        technicalInspectionExpiry: d.technicalInspectionExpiry,
        vignetteExpiry: d.vignetteExpiry,
      },
    },
  };
}

function failure(result: { error: string; field?: string }, values?: Record<string, string>): VehicleFormState {
  return result.field
    ? { error: "Veuillez corriger les champs signalés.", fieldErrors: { [result.field]: [result.error] }, values }
    : { error: result.error, values };
}

export async function createVehicleAction(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const ctx = await requirePermission("fleet.manage");
  const parsed = parseVehicle(formData, true);
  if (!parsed.ok) return parsed.state;

  const result = createVehicle(ctx, { ...parsed.input, mileage: parsed.mileage });
  if (!result.ok) return failure(result, formValues(formData));

  revalidatePath("/fleet");
  redirect(`/fleet/${result.id}`);
}

export async function updateVehicleAction(id: string, _prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const ctx = await requirePermission("fleet.manage");
  const parsed = parseVehicle(formData, false);
  if (!parsed.ok) return parsed.state;

  const result = updateVehicle(ctx, id, parsed.input);
  if (!result.ok) return failure(result, formValues(formData));

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${id}`);
  redirect(`/fleet/${id}`);
}

export async function setOutOfServiceAction(id: string, outOfService: boolean): Promise<FormState> {
  const ctx = await requirePermission("fleet.manage");
  const result = setOutOfService(ctx, id, outOfService);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/fleet/${id}`);
  return { message: outOfService ? "Véhicule mis hors service." : "Véhicule remis en service." };
}

const mileageLogSchema = z.object({
  km: integer("Saisissez un kilométrage valide.").min(0, "Saisissez un kilométrage valide."),
  fuelLevel: integer("Niveau de carburant invalide.").min(0, "Niveau de carburant invalide.").max(8, "Niveau de carburant invalide."),
  note: z.string().max(200, "200 caractères maximum.").nullable(),
});

export async function recordMileageAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("fleet.manage");
  const parsed = mileageLogSchema.safeParse({
    km: int(formData, "km"),
    fuelLevel: int(formData, "fuelLevel"),
    note: optStr(formData, "note"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const result = recordMileage(ctx, id, { ...parsed.data, fuelLevel: parsed.data.fuelLevel as FuelLevel });
  if (!result.ok) return result.field ? { fieldErrors: { [result.field]: [result.error] } } : { error: result.error };

  revalidatePath(`/fleet/${id}`);
  return { message: "Relevé enregistré." };
}
