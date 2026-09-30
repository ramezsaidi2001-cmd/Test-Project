"use client";

import { useActionState } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { Alert, Field, TextareaField } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </>
  );
}

export function CostsForm({
  action,
  vendor,
  partsCost,
  laborCost,
  notes,
}: {
  action: Action;
  vendor: string;
  partsCost: string;
  laborCost: string;
  notes: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  // Key on the saved values so the inputs pick up the new defaults after a successful save.
  const key = [vendor, partsCost, laborCost, notes].join("|");

  return (
    <form key={key} action={formAction} className="space-y-3" noValidate>
      <Messages state={state} />
      <Field label="Garage / prestataire" name="vendor" defaultValue={vendor} errors={errors.vendor} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pièces (DT)" name="partsCost" inputMode="decimal" defaultValue={partsCost} errors={errors.partsCost} />
        <Field label="Main-d'œuvre (DT)" name="laborCost" inputMode="decimal" defaultValue={laborCost} errors={errors.laborCost} />
      </div>
      <TextareaField label="Notes" name="notes" defaultValue={notes} errors={errors.notes} />
      <SubmitButton variant="secondary">Mettre à jour</SubmitButton>
    </form>
  );
}

export function CompleteForm({
  action,
  km,
  partsCost,
  laborCost,
  notes,
}: {
  action: Action;
  km: number;
  partsCost: string;
  laborCost: string;
  notes: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <Messages state={state} />
      <Field
        label="Kilométrage à la sortie (km)"
        name="km"
        type="number"
        inputMode="numeric"
        min={km}
        defaultValue={km}
        errors={errors.km}
        hint={`Dernier relevé : ${km.toLocaleString("fr-FR")} km`}
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pièces — final (DT)" name="partsCost" inputMode="decimal" defaultValue={partsCost} errors={errors.partsCost} />
        <Field label="Main-d'œuvre — final (DT)" name="laborCost" inputMode="decimal" defaultValue={laborCost} errors={errors.laborCost} />
      </div>
      <TextareaField label="Notes de clôture" name="notes" defaultValue={notes} errors={errors.notes} />
      <ConfirmSubmit variant="primary" message="Clôturer cet ordre de travail ? Il ne pourra plus être modifié.">
        Clôturer
      </ConfirmSubmit>
    </form>
  );
}
