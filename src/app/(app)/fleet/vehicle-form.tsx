"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, ButtonLink, Field, SelectField } from "@/components/ui";
import { FUEL_TYPE, TRANSMISSION } from "@/domain/labels";
import type { VehicleFormState } from "./actions";

export type VehicleFormDefaults = Record<string, string>;

type Option = { value: string; label: string };

const FUEL_OPTIONS = Object.entries(FUEL_TYPE).map(([value, label]) => ({ value, label }));
const TRANSMISSION_OPTIONS = Object.entries(TRANSMISSION).map(([value, label]) => ({ value, label }));

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description && <p className="mb-4 text-xs text-muted">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function VehicleForm({
  mode,
  action,
  defaults,
  categories,
  branches,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (state: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  defaults: VehicleFormDefaults;
  categories: Option[];
  branches: Option[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {} as VehicleFormState);
  const errors = state.fieldErrors ?? {};
  // After a failed submit, keep what the user typed (React resets the form after each action).
  const v = (name: string) => state.values?.[name] ?? defaults[name] ?? "";

  return (
    <form action={formAction} className="max-w-4xl space-y-6" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Section title="Identification">
        <Field
          label="Immatriculation"
          name="plate"
          placeholder="245 TU 1234"
          hint="Format tunisien : série TU numéro"
          defaultValue={v("plate")}
          errors={errors.plate}
          required
          autoComplete="off"
        />
        <Field
          label="Numéro de châssis (VIN)"
          name="vin"
          maxLength={17}
          hint="17 caractères"
          defaultValue={v("vin")}
          errors={errors.vin}
          required
          autoComplete="off"
          className="block w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger"
        />
        <Field label="Marque" name="make" placeholder="Renault" defaultValue={v("make")} errors={errors.make} required />
        <Field label="Modèle" name="model" placeholder="Clio" defaultValue={v("model")} errors={errors.model} required />
        <Field label="Finition" name="trim" placeholder="Zen" defaultValue={v("trim")} errors={errors.trim} />
        <Field
          label="Année"
          name="year"
          type="number"
          inputMode="numeric"
          min={1990}
          defaultValue={v("year")}
          errors={errors.year}
          required
        />
        <Field label="Couleur" name="color" placeholder="Blanc" defaultValue={v("color")} errors={errors.color} required />
      </Section>

      <Section title="Caractéristiques">
        <SelectField
          label="Catégorie"
          name="categoryId"
          options={categories}
          placeholder="Sélectionner…"
          defaultValue={v("categoryId")}
          errors={errors.categoryId}
          required
        />
        <SelectField
          label="Carburant"
          name="fuel"
          options={FUEL_OPTIONS}
          defaultValue={v("fuel") || "essence"}
          errors={errors.fuel}
          required
        />
        <SelectField
          label="Boîte de vitesses"
          name="transmission"
          options={TRANSMISSION_OPTIONS}
          defaultValue={v("transmission") || "manuelle"}
          errors={errors.transmission}
          required
        />
        <Field
          label="Nombre de places"
          name="seats"
          type="number"
          inputMode="numeric"
          min={2}
          max={9}
          defaultValue={v("seats") || "5"}
          errors={errors.seats}
          required
        />
      </Section>

      <Section title="Exploitation">
        <SelectField
          label="Agence de rattachement"
          name="branchId"
          options={branches}
          placeholder="Sélectionner…"
          defaultValue={v("branchId")}
          errors={errors.branchId}
          required
        />
        {mode === "create" ? (
          <Field
            label="Kilométrage actuel (km)"
            name="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={v("mileage")}
            errors={errors.mileage}
            required
          />
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Kilométrage</p>
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">
              {defaults.mileageLabel} — modifiable uniquement via « Relever le kilométrage ».
            </p>
          </div>
        )}
        <Field
          label="Intervalle d'entretien (km)"
          name="serviceIntervalKm"
          type="number"
          inputMode="numeric"
          min={1000}
          step={500}
          defaultValue={v("serviceIntervalKm") || "10000"}
          errors={errors.serviceIntervalKm}
          required
        />
        <Field
          label="Prochain entretien (km)"
          name="nextServiceKm"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={v("nextServiceKm")}
          errors={errors.nextServiceKm}
          hint={mode === "create" ? "Laisser vide : kilométrage actuel + intervalle" : undefined}
          required={mode === "edit"}
        />
        <Field
          label="Date d'acquisition"
          name="acquisitionDate"
          type="date"
          defaultValue={v("acquisitionDate")}
          errors={errors.acquisitionDate}
          required
        />
        <Field
          label="Coût d'acquisition (DT)"
          name="acquisitionCost"
          inputMode="decimal"
          placeholder="45 000,000"
          defaultValue={v("acquisitionCost")}
          errors={errors.acquisitionCost}
          required
        />
        <Field
          label="Boîtier GPS"
          name="gpsDeviceId"
          placeholder="Optionnel"
          defaultValue={v("gpsDeviceId")}
          errors={errors.gpsDeviceId}
          hint="Identifiant du traceur, si le véhicule en est équipé"
        />
      </Section>

      <Section title="Documents & échéances" description="Les échéances à moins de 30 jours déclenchent une alerte.">
        <Field
          label="N° de carte grise"
          name="registrationNumber"
          defaultValue={v("registrationNumber")}
          errors={errors.registrationNumber}
          required
        />
        <Field
          label="Assureur"
          name="insurer"
          placeholder="STAR, COMAR, GAT…"
          defaultValue={v("insurer")}
          errors={errors.insurer}
          required
        />
        <Field
          label="Fin de l'assurance"
          name="insuranceExpiry"
          type="date"
          defaultValue={v("insuranceExpiry")}
          errors={errors.insuranceExpiry}
          required
        />
        <Field
          label="Visite technique valable jusqu'au"
          name="technicalInspectionExpiry"
          type="date"
          defaultValue={v("technicalInspectionExpiry")}
          errors={errors.technicalInspectionExpiry}
          required
        />
        <Field
          label="Vignette valable jusqu'au"
          name="vignetteExpiry"
          type="date"
          defaultValue={v("vignetteExpiry")}
          errors={errors.vignetteExpiry}
          required
        />
      </Section>

      <div className="flex flex-wrap gap-2">
        <SubmitButton>{mode === "create" ? "Ajouter le véhicule" : "Enregistrer les modifications"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}
