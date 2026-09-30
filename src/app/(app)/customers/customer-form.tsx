"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Alert, Button, Field, SelectField, TextareaField } from "@/components/ui";
import type { Customer, CustomerKind, IdDocumentType } from "@/domain/customers/types";
import { CUSTOMER_KIND, ID_DOCUMENT } from "@/domain/labels";
import { initialFormState } from "@/lib/form-state";
import { saveCustomerAction } from "./actions";

export function CustomerForm({ customer, cancelHref }: { customer?: Customer; cancelHref: string }) {
  const [state, action, pending] = useActionState(saveCustomerAction.bind(null, customer?.id ?? null), initialFormState);
  const [kind, setKind] = useState<CustomerKind>(customer?.kind ?? "particulier");
  const [idType, setIdType] = useState<IdDocumentType>(customer?.idType ?? "cin");
  const e = state.fieldErrors ?? {};
  const isCompany = kind === "entreprise";

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(ev) => {
        // Submit manually so React does not reset this long form when validation fails.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Type de client</legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(CUSTOMER_KIND) as CustomerKind[]).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                kind === k ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="accent-[var(--primary)]"
              />
              {CUSTOMER_KIND[k]}
            </label>
          ))}
        </div>
        {isCompany && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Raison sociale" name="companyName" defaultValue={customer?.companyName ?? ""} required errors={e.companyName} />
            <Field
              label="Matricule fiscal"
              name="taxId"
              defaultValue={customer?.taxId ?? ""}
              placeholder="1234567/A/M/000"
              required
              errors={e.taxId}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">{isCompany ? "Contact" : "Identité"}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={isCompany ? "Prénom du contact" : "Prénom"}
            name="firstName"
            defaultValue={customer?.firstName}
            autoComplete="given-name"
            required
            errors={e.firstName}
          />
          <Field
            label={isCompany ? "Nom du contact" : "Nom"}
            name="lastName"
            defaultValue={customer?.lastName}
            autoComplete="family-name"
            required
            errors={e.lastName}
          />
          <SelectField
            label="Pièce d'identité"
            name="idType"
            value={idType}
            onChange={(ev) => setIdType(ev.target.value as IdDocumentType)}
            options={(Object.keys(ID_DOCUMENT) as IdDocumentType[]).map((v) => ({ value: v, label: ID_DOCUMENT[v] }))}
            errors={e.idType}
          />
          <Field
            label="Numéro de la pièce"
            name="idNumber"
            defaultValue={customer?.idNumber}
            required
            inputMode={idType === "cin" ? "numeric" : undefined}
            maxLength={idType === "cin" ? 8 : 30}
            hint={idType === "cin" ? "8 chiffres" : undefined}
            errors={e.idNumber}
          />
          <Field label="Nationalité" name="nationality" defaultValue={customer?.nationality ?? "Tunisienne"} required errors={e.nationality} />
          <Field label="Date de naissance" name="birthDate" type="date" defaultValue={customer?.birthDate?.slice(0, 10) ?? ""} errors={e.birthDate} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Coordonnées</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Téléphone"
            name="phone"
            type="tel"
            defaultValue={customer?.phone}
            placeholder="+216 22 123 456"
            autoComplete="tel"
            required
            errors={e.phone}
          />
          <Field label="E-mail (facultatif)" name="email" type="email" defaultValue={customer?.email ?? ""} autoComplete="email" errors={e.email} />
          <Field label="Adresse" name="address" defaultValue={customer?.address} autoComplete="street-address" required errors={e.address} />
          <Field label="Ville" name="city" defaultValue={customer?.city} autoComplete="address-level2" required errors={e.city} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Permis de conduire</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Numéro de permis" name="licenseNumber" defaultValue={customer?.licenseNumber} required errors={e.licenseNumber} />
          <Field
            label="Date de délivrance"
            name="licenseIssueDate"
            type="date"
            defaultValue={customer?.licenseIssueDate?.slice(0, 10) ?? ""}
            errors={e.licenseIssueDate}
          />
          <Field
            label="Date d'expiration"
            name="licenseExpiry"
            type="date"
            defaultValue={customer?.licenseExpiry?.slice(0, 10) ?? ""}
            errors={e.licenseExpiry}
          />
        </div>
      </fieldset>

      <TextareaField label="Notes internes" name="notes" defaultValue={customer?.notes ?? ""} errors={e.notes} />

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-border/60">
          Annuler
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : customer ? "Enregistrer les modifications" : "Créer le client"}
        </Button>
      </div>
    </form>
  );
}
