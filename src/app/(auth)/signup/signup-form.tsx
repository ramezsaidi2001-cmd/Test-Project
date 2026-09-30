"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { signUp } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initialFormState);

  if (state.message) {
    return (
      <div className="mt-6">
        <Alert tone="success">{state.message}</Alert>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Nom complet" name="fullName" autoComplete="name" required errors={state.fieldErrors?.fullName} />
      <Field
        label="E-mail professionnel"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Au moins 8 caractères."
        errors={state.fieldErrors?.password}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
