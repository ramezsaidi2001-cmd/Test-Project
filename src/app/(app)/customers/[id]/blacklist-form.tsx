"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/client";
import { Alert, TextareaField } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { blacklistAction } from "../actions";

export function BlacklistForm({ customerId, blacklisted, reason }: { customerId: string; blacklisted: boolean; reason: string | null }) {
  const [state, action] = useActionState(blacklistAction.bind(null, customerId, !blacklisted), initialFormState);

  return (
    <form action={action} className="space-y-3">
      {state.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {blacklisted ? (
        <>
          <Alert tone="error">
            <strong>Client sur liste noire.</strong> Motif : {reason ?? "non précisé"}
          </Alert>
          <ConfirmSubmit variant="secondary" message="Retirer ce client de la liste noire ? Il pourra de nouveau réserver.">
            Retirer de la liste noire
          </ConfirmSubmit>
        </>
      ) : (
        <>
          <TextareaField
            label="Motif"
            name="reason"
            placeholder="Ex. : véhicule rendu endommagé et non réglé, impayés répétés…"
            required
            errors={state.fieldErrors?.reason}
            hint="Un client sur liste noire ne peut plus réserver."
          />
          <ConfirmSubmit message="Inscrire ce client sur la liste noire ? Toute nouvelle réservation sera refusée.">
            Inscrire sur liste noire
          </ConfirmSubmit>
        </>
      )}
    </form>
  );
}
