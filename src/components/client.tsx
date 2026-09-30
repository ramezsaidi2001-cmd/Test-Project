"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Button } from "./ui";

/** Submit button that shows a pending label while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || props.disabled} className={className} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Submit button that asks for confirmation first (destructive or irreversible actions). */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  className,
}: {
  children: ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Traitement…" : children}
    </Button>
  );
}

/** <select> that submits its GET form on change (filters). */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={`rounded-md border border-border bg-surface px-2 py-1.5 text-sm ${props.className ?? ""}`}
    />
  );
}

export function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
