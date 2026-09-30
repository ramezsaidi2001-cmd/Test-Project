"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { slugify } from "@/domain/tenancy/slug";
import { initialFormState } from "@/lib/form-state";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, initialFormState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Nom de l'agence"
        name="name"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        errors={state.fieldErrors?.name}
      />
      <Field
        label="Adresse de l'espace"
        name="slug"
        required
        value={slug}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(e.target.value.toLowerCase());
        }}
        hint="Lettres minuscules, chiffres et tirets."
        errors={state.fieldErrors?.slug}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création…" : "Créer l'agence"}
      </Button>
    </form>
  );
}
