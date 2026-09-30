import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { Tone } from "@/domain/labels";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:bg-border/40",
  ghost: "text-foreground hover:bg-border/60",
  danger: "bg-danger text-white hover:opacity-90",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonBase} ${VARIANTS[variant]} ${className}`} {...props} />;
}

const inputBase =
  "block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger disabled:opacity-60";

function FieldShell({
  label,
  name,
  errors,
  hint,
  children,
  className = "",
}: {
  label: string;
  name: string;
  errors?: string[];
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {errors?.length ? (
        <p id={`${name}-error`} className="text-xs text-danger">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, errors?: string[], hint?: ReactNode) {
  return errors?.length ? `${name}-error` : hint ? `${name}-hint` : undefined;
}

type FieldExtras = { label: string; name: string; errors?: string[]; hint?: ReactNode; wrapperClassName?: string };

export function Field({ label, name, errors, hint, wrapperClassName, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldExtras) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint} className={wrapperClassName}>
      <input
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, errors, hint)}
        className={inputBase}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  errors,
  hint,
  wrapperClassName,
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> &
  FieldExtras & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint} className={wrapperClassName}>
      <select
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, errors, hint)}
        className={inputBase}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  errors,
  hint,
  wrapperClassName,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint} className={wrapperClassName}>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, errors, hint)}
        className={inputBase}
        {...props}
      />
    </FieldShell>
  );
}

export function Checkbox({ label, name, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} className="mt-0.5 size-4 accent-[var(--primary)]" {...props} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "warning" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-danger-surface text-danger",
    success: "bg-success-surface text-success",
    warning: "bg-warning-surface text-warning",
    info: "bg-primary/10 text-primary",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

const TONES: Record<Tone, string> = {
  neutral: "bg-border/70 text-foreground",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-primary/10 text-primary",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 space-y-2">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function StatCard({ label, value, hint, tone, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-lg border border-border bg-surface p-4";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-primary`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ columns }: { columns: (string | { label: string; className?: string })[] }) {
  return (
    <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
      <tr>
        {columns.map((c) => {
          const col = typeof c === "string" ? { label: c } : c;
          return (
            <th key={col.label} scope="col" className={`whitespace-nowrap px-4 py-3 font-medium ${col.className ?? ""}`}>
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

/** Link-based tabs; `current` matches `tab.value`. */
export function Tabs({ tabs, current }: { tabs: { value: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Filtres" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-border px-1.5 text-xs text-foreground">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Label/value pairs. */
export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" }[columns];
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${cols}`}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">F</span>
      Fleetly
    </span>
  );
}

/** Simple horizontal bar for inline charts (value 0..1). */
export function Bar({ value, tone = "info" }: { value: number; tone?: Tone }) {
  const color = { neutral: "bg-muted", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-primary" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border" role="presentation">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
