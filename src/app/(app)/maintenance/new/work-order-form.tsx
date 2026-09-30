"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, ButtonLink, Checkbox, Field, SelectField, TextareaField } from "@/components/ui";
import { WORK_ORDER_TYPE } from "@/domain/labels";
import { createWorkOrderAction, type WorkOrderFormState } from "../actions";

const TYPE_OPTIONS = Object.entries(WORK_ORDER_TYPE).map(([value, label]) => ({ value, label }));

export function WorkOrderForm({
  vehicles,
  defaultVehicleId,
  defaultType,
  cancelHref,
}: {
  vehicles: { value: string; label: string }[];
  defaultVehicleId: string;
  defaultType: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(createWorkOrderAction, {} as WorkOrderFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  return (
    <form action={formAction} className="max-w-3xl space-y-6" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset className="rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Intervention</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Véhicule"
            name="vehicleId"
            options={vehicles}
            placeholder="Sélectionner un véhicule…"
            defaultValue={v?.vehicleId ?? defaultVehicleId}
            errors={errors.vehicleId}
            required
          />
          <SelectField
            label="Type d'intervention"
            name="type"
            options={TYPE_OPTIONS}
            defaultValue={v?.type ?? (defaultType || "reparation")}
            errors={errors.type}
            required
          />
          <TextareaField
            label="Description"
            name="description"
            placeholder="Vidange + filtres, bruit de freinage à l'avant…"
            defaultValue={v?.description}
            errors={errors.description}
            wrapperClassName="sm:col-span-2"
            required
          />
          <Field
            label="Garage / prestataire"
            name="vendor"
            placeholder="Garage Ben Ali, atelier interne…"
            defaultValue={v?.vendor}
            errors={errors.vendor}
            required
          />
          <div className="sm:pt-7">
            <Checkbox
              label="Immobiliser le véhicule"
              name="immobilizing"
              hint="Le véhicule sera indisponible à la réservation"
              defaultChecked={v ? v.immobilizing === "on" : true}
            />
            {errors.immobilizing && <p className="mt-1 text-xs text-danger">{errors.immobilizing[0]}</p>}
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Estimation des coûts</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Pièces (DT)"
            name="partsCost"
            inputMode="decimal"
            placeholder="0,000"
            defaultValue={v?.partsCost}
            errors={errors.partsCost}
          />
          <Field
            label="Main-d'œuvre (DT)"
            name="laborCost"
            inputMode="decimal"
            placeholder="0,000"
            defaultValue={v?.laborCost}
            errors={errors.laborCost}
          />
          <TextareaField
            label="Notes"
            name="notes"
            placeholder="Optionnel"
            defaultValue={v?.notes}
            errors={errors.notes}
            wrapperClassName="sm:col-span-2"
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <SubmitButton>Créer l&apos;ordre de travail</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}
