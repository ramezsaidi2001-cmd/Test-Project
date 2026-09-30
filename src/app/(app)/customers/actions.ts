"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { optStr, str } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import { createCustomer, setBlacklist, updateCustomer, type CustomerInput } from "@/server/customers/service";
import { requirePermission } from "@/server/tenancy/context";

const optionalDate = z
  .string()
  .nullable()
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide.");

/** Accepts "+216 22 123 456", "22123456" (local) or any international "+…" number; returns a normalized value. */
function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s.\-()]/g, "");
  if (/^\d{8}$/.test(compact)) return `+216 ${compact.slice(0, 2)} ${compact.slice(2, 5)} ${compact.slice(5)}`;
  if (compact.startsWith("+216") || compact.startsWith("00216")) {
    const digits = compact.replace(/^(\+|00)216/, "");
    if (!/^\d{8}$/.test(digits)) return null;
    return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return raw.trim().replace(/\s+/g, " ");
  return null;
}

const customerSchema = z
  .object({
    kind: z.enum(["particulier", "entreprise"], "Choisissez le type de client."),
    companyName: z.string().nullable(),
    taxId: z.string().nullable(),
    firstName: z.string().min(1, "Saisissez le prénom.").max(80, "80 caractères maximum."),
    lastName: z.string().min(1, "Saisissez le nom.").max(80, "80 caractères maximum."),
    idType: z.enum(["cin", "passeport", "carte_sejour"], "Choisissez le type de pièce d'identité."),
    idNumber: z.string().min(1, "Saisissez le numéro de la pièce d'identité.").max(30, "30 caractères maximum."),
    nationality: z.string().min(1, "Saisissez la nationalité.").max(60, "60 caractères maximum."),
    birthDate: optionalDate,
    phone: z.string().min(1, "Saisissez le numéro de téléphone."),
    email: z.email("Adresse e-mail invalide.").nullable(),
    address: z.string().min(1, "Saisissez l'adresse.").max(200, "200 caractères maximum."),
    city: z.string().min(1, "Saisissez la ville.").max(80, "80 caractères maximum."),
    licenseNumber: z.string().min(1, "Saisissez le numéro du permis de conduire.").max(30, "30 caractères maximum."),
    licenseIssueDate: optionalDate,
    licenseExpiry: optionalDate,
    notes: z.string().max(1000, "1000 caractères maximum.").nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "entreprise") {
      if (!v.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: "Saisissez la raison sociale." });
      if (!v.taxId) ctx.addIssue({ code: "custom", path: ["taxId"], message: "Saisissez le matricule fiscal." });
      else if (!/^\d{7}\/?[A-Z](\/[A-Z])*\/\d{3}$/i.test(v.taxId.replace(/\s/g, ""))) {
        ctx.addIssue({ code: "custom", path: ["taxId"], message: "Format attendu : 1234567/A/M/000." });
      }
    }
    if (v.idType === "cin" && !/^\d{8}$/.test(v.idNumber.replace(/\s/g, ""))) {
      ctx.addIssue({ code: "custom", path: ["idNumber"], message: "Le numéro de CIN comporte exactement 8 chiffres." });
    }
    if (!normalizePhone(v.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Numéro invalide : +216 suivi de 8 chiffres, ou numéro international commençant par +.",
      });
    }
    if (v.birthDate && v.birthDate > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "La date de naissance est dans le futur." });
    }
    if (v.licenseIssueDate && v.licenseExpiry && v.licenseExpiry <= v.licenseIssueDate) {
      ctx.addIssue({ code: "custom", path: ["licenseExpiry"], message: "La date d'expiration doit suivre la date de délivrance." });
    }
  });

function parseCustomer(fd: FormData) {
  const kind = str(fd, "kind");
  const isCompany = kind === "entreprise";
  return customerSchema.safeParse({
    kind,
    companyName: isCompany ? optStr(fd, "companyName") : null,
    taxId: isCompany ? (optStr(fd, "taxId")?.toUpperCase() ?? null) : null,
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    idType: str(fd, "idType"),
    idNumber: str(fd, "idNumber").toUpperCase(),
    nationality: str(fd, "nationality"),
    birthDate: optStr(fd, "birthDate"),
    phone: str(fd, "phone"),
    email: optStr(fd, "email"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    licenseNumber: str(fd, "licenseNumber"),
    licenseIssueDate: optStr(fd, "licenseIssueDate"),
    licenseExpiry: optStr(fd, "licenseExpiry"),
    notes: optStr(fd, "notes"),
  });
}

export async function saveCustomerAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("customers.manage");
  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { error: "Veuillez corriger les champs signalés.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const input: CustomerInput = {
    ...parsed.data,
    idNumber: parsed.data.idNumber.replace(/\s/g, ""),
    phone: normalizePhone(parsed.data.phone)!,
  };

  const result = id ? updateCustomer(ctx, id, input) : createCustomer(ctx, input);
  if (!result.ok) {
    return result.field ? { error: result.error, fieldErrors: { [result.field]: [result.error] } } : { error: result.error };
  }

  const targetId = id ?? ("id" in result ? (result as { id: string }).id : "");
  revalidatePath("/customers");
  redirect(`/customers/${targetId}`);
}

export async function blacklistAction(id: string, blacklisted: boolean, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("customers.manage");
  const result = setBlacklist(ctx, id, blacklisted, blacklisted ? str(formData, "reason") : null);
  if (!result.ok) {
    return result.field ? { error: result.error, fieldErrors: { [result.field]: [result.error] } } : { error: result.error };
  }
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { message: blacklisted ? "Client inscrit sur la liste noire." : "Client retiré de la liste noire." };
}
