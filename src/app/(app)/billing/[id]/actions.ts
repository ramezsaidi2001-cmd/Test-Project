"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { money, optStr, str } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import { cancelInvoice, canRecordPayment, recordPayment } from "@/server/billing/service";
import { getTenantContext, requirePermission } from "@/server/tenancy/context";

const paymentSchema = z
  .object({
    amount: z.number({ error: "Montant invalide." }).int().positive("Le montant doit être positif."),
    method: z.enum(["especes", "carte", "cheque", "virement", "d17"], { error: "Choisissez un mode de paiement." }),
    reference: z.string().max(120, "120 caractères maximum.").nullable(),
  })
  .refine((v) => !(v.method === "cheque" || v.method === "virement") || !!v.reference, {
    path: ["reference"],
    message: "Indiquez le numéro du chèque ou la référence du virement.",
  });

export async function recordPaymentAction(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getTenantContext();
  if (!canRecordPayment(ctx)) return { error: "Votre rôle ne permet pas d'enregistrer un paiement." };

  const parsed = paymentSchema.safeParse({
    amount: money(formData, "amount"),
    method: str(formData, "method"),
    reference: optStr(formData, "reference"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const result = recordPayment(ctx, invoiceId, parsed.data);
  if (!result.ok) return result.field ? { fieldErrors: { [result.field]: [result.error] } } : { error: result.error };

  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  return { message: "Paiement enregistré." };
}

export async function cancelInvoiceAction(invoiceId: string) {
  const ctx = await requirePermission("finance.manage");
  const result = cancelInvoice(ctx, invoiceId);
  revalidatePath("/billing");
  redirect(`/billing/${invoiceId}?annulation=${result.ok ? "ok" : "echec"}`);
}
