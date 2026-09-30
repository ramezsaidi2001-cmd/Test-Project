"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Checkbox, Field, SelectField, TextareaField } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form-state";

/** Form state that echoes submitted values so inputs keep them after React resets the form on error. */
export type EntityFormState = FormState & { values?: Record<string, string> };

type Common = { name: string; label: string; hint?: string; required?: boolean; span?: "full" };

export type FieldSpec =
  | { kind: "section"; title: string; description?: string }
  | (Common & {
      kind?: "text" | "email" | "tel" | "date" | "decimal" | "integer";
      defaultValue?: string;
      placeholder?: string;
    })
  | (Common & { kind: "select"; defaultValue?: string; options: { value: string; label: string }[] })
  | (Common & { kind: "textarea"; defaultValue?: string; rows?: number; placeholder?: string })
  | (Common & { kind: "checkbox"; defaultChecked?: boolean });

/** Generic settings form rendered from a serializable field list. */
export function EntityForm({
  action,
  fields,
  submitLabel = "Enregistrer",
  cancelHref,
  columns = 2,
}: {
  action: (prev: EntityFormState, formData: FormData) => Promise<EntityFormState>;
  fields: FieldSpec[];
  submitLabel?: string;
  cancelHref?: string;
  columns?: 2 | 3 | 4;
}) {
  const [state, formAction] = useActionState(action, initialFormState as EntityFormState);
  const v = state.values;
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className={`grid gap-4 ${grid}`}>
        {fields.map((f, i) => {
          if (f.kind === "section") {
            return (
              <div key={`section-${i}`} className={`col-span-full ${i > 0 ? "border-t border-border pt-4" : ""}`}>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                {f.description && <p className="mt-0.5 text-xs text-muted">{f.description}</p>}
              </div>
            );
          }
          const span = f.span === "full" ? "col-span-full" : "";
          const errors = state.fieldErrors?.[f.name];
          if (f.kind === "checkbox") {
            return (
              <div key={f.name} className={`self-end pb-2 ${span}`}>
                <Checkbox label={f.label} name={f.name} hint={f.hint} defaultChecked={v ? v[f.name] === "on" : f.defaultChecked} />
              </div>
            );
          }
          const defaultValue = v ? (v[f.name] ?? "") : (f.defaultValue ?? "");
          if (f.kind === "select") {
            return (
              <SelectField
                key={f.name}
                label={f.label}
                name={f.name}
                hint={f.hint}
                required={f.required}
                options={f.options}
                defaultValue={defaultValue}
                errors={errors}
                wrapperClassName={span}
              />
            );
          }
          if (f.kind === "textarea") {
            return (
              <TextareaField
                key={f.name}
                label={f.label}
                name={f.name}
                hint={f.hint}
                required={f.required}
                rows={f.rows ?? 3}
                placeholder={f.placeholder}
                defaultValue={defaultValue}
                errors={errors}
                wrapperClassName={span}
              />
            );
          }
          const type = f.kind === "email" || f.kind === "tel" || f.kind === "date" ? f.kind : "text";
          const inputMode = f.kind === "decimal" ? "decimal" : f.kind === "integer" ? "numeric" : undefined;
          return (
            <Field
              key={f.name}
              label={f.label}
              name={f.name}
              type={type}
              inputMode={inputMode}
              hint={f.hint}
              required={f.required}
              placeholder={f.placeholder}
              defaultValue={defaultValue}
              errors={errors}
              wrapperClassName={span}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {cancelHref && (
          <Link href={cancelHref} className="text-sm text-muted hover:text-foreground">
            Annuler
          </Link>
        )}
      </div>
    </form>
  );
}
