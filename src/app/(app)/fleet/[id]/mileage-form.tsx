"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Field, SelectField } from "@/components/ui";
import { FUEL_LEVELS, fuelLabel } from "@/domain/labels";
import { initialFormState, type FormState } from "@/lib/form-state";

const FUEL_OPTIONS = FUEL_LEVELS.map((l) => ({ value: String(l), label: fuelLabel(l) }));

export function MileageForm({
  action,
  currentKm,
  currentFuel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  currentKm: number;
  currentFuel: number;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          key={`km-${currentKm}`}
          label="Kilométrage (km)"
          name="km"
          type="number"
          inputMode="numeric"
          min={currentKm}
          defaultValue={currentKm}
          errors={errors.km}
          hint={`Dernier relevé : ${currentKm.toLocaleString("fr-FR")} km`}
          required
        />
        <SelectField
          key={`fuel-${currentFuel}`}
          label="Niveau de carburant"
          name="fuelLevel"
          options={FUEL_OPTIONS}
          defaultValue={String(currentFuel)}
          errors={errors.fuelLevel}
        />
      </div>
      <Field label="Note" name="note" placeholder="Optionnel" maxLength={200} errors={errors.note} />
      <SubmitButton variant="secondary">Enregistrer le relevé</SubmitButton>
    </form>
  );
}
