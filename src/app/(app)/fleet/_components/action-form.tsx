"use client";

import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form-state";

/**
 * Small form for in-page mutations (a single button or a few fields that need no field errors).
 * Shows the action's error or success message below its content.
 */
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className={className}>
      {children}
      {(state.error || state.message) && (
        <div className="mt-2 basis-full">
          <Alert tone={state.error ? "error" : "success"}>{state.error ?? state.message}</Alert>
        </div>
      )}
    </form>
  );
}
