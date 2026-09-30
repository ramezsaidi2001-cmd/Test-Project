"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { signIn } from "../actions";

export function LoginForm({ next, linkError }: { next: string; linkError?: string }) {
  const [state, action, pending] = useActionState(signIn, initialFormState);
  const error = state.error ?? linkError;

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="E-mail" name="email" type="email" autoComplete="email" required errors={state.fieldErrors?.email} />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
