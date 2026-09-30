"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Field, SelectField } from "@/components/ui";
import { PAYMENT_METHOD } from "@/domain/labels";
import { initialFormState, type FormState } from "@/lib/form-state";

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }));

export function PaymentForm({
  action,
  defaultAmount,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Remaining balance, formatted in dinars ("125,500"). */
  defaultAmount: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [method, setMethod] = useState("especes");
  const needsReference = method === "cheque" || method === "virement";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field
        key={defaultAmount}
        label="Montant (DT)"
        name="amount"
        inputMode="decimal"
        required
        defaultValue={defaultAmount}
        errors={state.fieldErrors?.amount}
      />
      <SelectField
        label="Mode de paiement"
        name="method"
        options={METHOD_OPTIONS}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        errors={state.fieldErrors?.method}
      />
      <Field
        label={needsReference ? "Référence (obligatoire)" : "Référence"}
        name="reference"
        required={needsReference}
        placeholder={method === "cheque" ? "N° du chèque" : method === "virement" ? "Référence du virement" : "Facultatif"}
        errors={state.fieldErrors?.reference}
      />
      <SubmitButton className="w-full">Enregistrer le paiement</SubmitButton>
    </form>
  );
}
