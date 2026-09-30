"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { Alert, Button, Checkbox, Field, SelectField, TextareaField } from "@/components/ui";
import { FUEL_LEVELS, fuelLabel } from "@/domain/labels";
import { initialFormState, type FormState } from "@/lib/form-state";
import { cancelReservationAction, checkinAction, checkoutAction, closeContractAction } from "../actions";
import { SignaturePad } from "./signature-pad";

const fuelOptions = [...FUEL_LEVELS].reverse().map((l) => ({ value: String(l), label: fuelLabel(l) }));

/** Submits without React's automatic form reset, so typed values survive validation errors. */
function manualSubmit(action: (fd: FormData) => void) {
  return (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  };
}

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </>
  );
}

export function CheckoutForm({ contractId, defaultKm, defaultName }: { contractId: string; defaultKm: number; defaultName: string }) {
  const [state, action, pending] = useActionState(checkoutAction.bind(null, contractId), initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form noValidate onSubmit={manualSubmit(action)} className="space-y-4">
      <Messages state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Kilométrage au départ"
          name="km"
          type="number"
          inputMode="numeric"
          min={defaultKm}
          defaultValue={defaultKm}
          required
          hint={`Dernier relevé : ${defaultKm.toLocaleString("fr-FR")} km`}
          errors={e.km}
        />
        <SelectField label="Niveau de carburant" name="fuelLevel" defaultValue="8" options={fuelOptions} errors={e.fuelLevel} />
      </div>
      <TextareaField label="État du véhicule / remarques" name="notes" placeholder="Rayures, accessoires remis, propreté…" />
      <Field label="Nom du signataire" name="signatureName" defaultValue={defaultName} required errors={e.signatureName} />
      <SignaturePad error={e.signature?.[0]} />
      <div className="space-y-1">
        <Checkbox name="terms" label="J'ai lu et accepte les conditions générales de location" required />
        {e.terms && <p className="text-xs text-danger">{e.terms[0]}</p>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le départ"}
      </Button>
    </form>
  );
}

export function CancelForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState(cancelReservationAction.bind(null, contractId), initialFormState);
  return (
    <form action={action} className="space-y-3">
      {state.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
      <TextareaField label="Motif de l'annulation" name="reason" rows={2} required errors={state.fieldErrors?.reason} />
      <ConfirmSubmit message="Annuler définitivement cette réservation ?">Annuler la réservation</ConfirmSubmit>
    </form>
  );
}

type DamageRow = { key: number; description: string; cost: string };

export function CheckinForm({
  contractId,
  defaultKm,
  defaultBranchId,
  branches,
}: {
  contractId: string;
  defaultKm: number;
  defaultBranchId: string;
  branches: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(checkinAction.bind(null, contractId), initialFormState);
  const [damages, setDamages] = useState<DamageRow[]>([]);
  const e = state.fieldErrors ?? {};

  const update = (key: number, patch: Partial<DamageRow>) =>
    setDamages((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form noValidate onSubmit={manualSubmit(action)} className="space-y-4">
      <Messages state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Kilométrage au retour"
          name="km"
          type="number"
          inputMode="numeric"
          min={defaultKm}
          defaultValue={defaultKm}
          required
          hint={`Départ : ${defaultKm.toLocaleString("fr-FR")} km`}
          errors={e.km}
        />
        <SelectField label="Niveau de carburant" name="fuelLevel" defaultValue="8" options={fuelOptions} errors={e.fuelLevel} />
        <SelectField label="Agence de retour" name="returnBranchId" defaultValue={defaultBranchId} options={branches} errors={e.returnBranchId} />
      </div>
      <TextareaField label="Remarques" name="notes" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Dommages constatés</legend>
        {damages.length === 0 && <p className="text-sm text-muted">Aucun dommage déclaré.</p>}
        {damages.map((d, i) => (
          <div key={d.key} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1 text-xs">
              <span className="text-muted">Description {i + 1}</span>
              <input
                value={d.description}
                onChange={(ev) => update(d.key, { description: ev.target.value })}
                placeholder="Rayure portière avant droite…"
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="w-32 space-y-1 text-xs">
              <span className="text-muted">Coût (DT HT)</span>
              <input
                value={d.cost}
                inputMode="decimal"
                onChange={(ev) => update(d.key, { cost: ev.target.value })}
                placeholder="0,000"
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <Button type="button" variant="ghost" onClick={() => setDamages((rows) => rows.filter((r) => r.key !== d.key))}>
              Retirer
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="py-1.5 text-xs"
          onClick={() => setDamages((rows) => [...rows, { key: Date.now(), description: "", cost: "" }])}
        >
          + Ajouter un dommage
        </Button>
        {e.damages && <p className="text-xs text-danger">{e.damages[0]}</p>}
        {damages.length > 0 && (
          <p className="text-xs text-muted">Un véhicule endommagé est automatiquement immobilisé avec un ordre de travail carrosserie.</p>
        )}
        <input type="hidden" name="damages" value={JSON.stringify(damages.map(({ description, cost }) => ({ description, cost })))} />
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le retour"}
      </Button>
    </form>
  );
}

export function CloseForm({ contractId, children }: { contractId: string; children: ReactNode }) {
  const [state, action] = useActionState(closeContractAction.bind(null, contractId), initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {children}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Caution</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="depositStatus" value="restituee" defaultChecked className="accent-[var(--primary)]" />
          Restituer la caution
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="depositStatus" value="retenue" className="accent-[var(--primary)]" />
          Retenir la caution
        </label>
      </fieldset>
      <SubmitButton pendingLabel="Facturation…">Clôturer et facturer</SubmitButton>
    </form>
  );
}
