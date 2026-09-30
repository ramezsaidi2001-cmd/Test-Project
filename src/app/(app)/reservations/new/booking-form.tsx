"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Alert, Badge, Button, Card, Checkbox, Field, SelectField, TextareaField } from "@/components/ui";
import { RISK_LABEL, type RiskLevel } from "@/domain/customers/risk";
import { DEPOSIT_METHOD } from "@/domain/labels";
import type { RateSnapshot } from "@/domain/rentals/types";
import { formatTnd } from "@/domain/shared/money";
import { initialFormState } from "@/lib/form-state";
import { createReservationAction, quoteAction } from "../actions";

type VehicleOption = { id: string; plate: string; label: string; details: string; category: string; dailyRate: number };
type CustomerOption = { id: string; name: string; idNumber: string; phone: string; risk: RiskLevel };
type ExtraOption = { id: string; name: string; price: number; pricing: "par_jour" | "forfait" };

export function BookingForm(props: {
  start: string;
  end: string;
  pickupBranchId: string;
  returnBranchId: string;
  vehicles: VehicleOption[];
  customers: CustomerOption[];
  initialCustomerId: string;
  initialVehicleId: string;
  extras: ExtraOption[];
  maxDiscountPercent: number;
}) {
  const [state, action, submitting] = useActionState(createReservationAction, initialFormState);
  const [vehicleId, setVehicleId] = useState(() => (props.vehicles.some((v) => v.id === props.initialVehicleId) ? props.initialVehicleId : ""));
  const [customerId, setCustomerId] = useState(() =>
    props.customers.some((c) => c.id === props.initialCustomerId && c.risk !== "bloque") ? props.initialCustomerId : "",
  );
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState("");
  const [rate, setRate] = useState<RateSnapshot | null>(null);
  const [quoting, startQuote] = useTransition();
  const e = state.fieldErrors ?? {};

  const discountValue = Number(discount.replace(",", "."));
  const discountError =
    discount.trim() === ""
      ? undefined
      : !Number.isFinite(discountValue) || discountValue < 0
        ? "Remise invalide."
        : discountValue > props.maxDiscountPercent
          ? `Remise maximale autorisée : ${props.maxDiscountPercent} %.`
          : undefined;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    startQuote(async () => {
      const next = await quoteAction({ vehicleId, start: props.start, end: props.end, extraIds, discountPercent: discount });
      if (!cancelled) setRate(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, extraIds, discount, props.start, props.end]);

  const selectedCustomer = props.customers.find((c) => c.id === customerId);
  const driverChecked = extraIds.includes("ex_driver");

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="start" value={props.start} />
      <input type="hidden" name="end" value={props.end} />
      <input type="hidden" name="pickupBranchId" value={props.pickupBranchId} />
      <input type="hidden" name="returnBranchId" value={props.returnBranchId} />

      <div className="min-w-0 space-y-6">
        {state.error && <Alert tone="error">{state.error}</Alert>}

        <Card title={`2. Véhicule (${props.vehicles.length} disponible${props.vehicles.length > 1 ? "s" : ""})`}>
          {e.vehicleId && <p className="mb-3 text-xs text-danger">{e.vehicleId[0]}</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {props.vehicles.map((v) => (
              <label
                key={v.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition ${
                  vehicleId === v.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border hover:border-primary/60"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{v.plate}</span>
                  <input
                    type="radio"
                    name="vehicleId"
                    value={v.id}
                    checked={vehicleId === v.id}
                    onChange={() => setVehicleId(v.id)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                </span>
                <span>{v.label}</span>
                <span className="text-xs text-muted">{v.details}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <Badge>{v.category}</Badge>
                  <span className="font-medium tabular-nums">{formatTnd(v.dailyRate)} HT / j</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card
          title="3. Client"
          actions={
            <Link href="/customers/new" className="text-sm text-primary hover:underline">
              + Nouveau client
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="customerId" className="block text-sm font-medium">
                Client
              </label>
              <select
                id="customerId"
                name="customerId"
                value={customerId}
                onChange={(ev) => setCustomerId(ev.target.value)}
                aria-invalid={e.customerId ? true : undefined}
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger"
              >
                <option value="">Sélectionnez un client…</option>
                {props.customers.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.risk === "bloque"}>
                    {c.name} · {c.idNumber} · {c.risk === "bloque" ? "Liste noire" : RISK_LABEL[c.risk].label}
                  </option>
                ))}
              </select>
              {e.customerId && <p className="text-xs text-danger">{e.customerId[0]}</p>}
            </div>
            {selectedCustomer && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge tone={RISK_LABEL[selectedCustomer.risk].tone}>{RISK_LABEL[selectedCustomer.risk].label}</Badge>
                {selectedCustomer.phone}
                <Link href={`/customers/${selectedCustomer.id}`} className="text-primary hover:underline" target="_blank">
                  Voir la fiche
                </Link>
              </p>
            )}
            {selectedCustomer && selectedCustomer.risk !== "faible" && (
              <Alert tone="warning">Ce client présente des points d&apos;attention : vérifiez sa fiche avant de confirmer.</Alert>
            )}
          </div>
        </Card>

        <Card title="4. Options et conditions">
          <div className="space-y-5">
            {props.extras.length > 0 && (
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">Options</legend>
                {props.extras.map((x) => (
                  <Checkbox
                    key={x.id}
                    name="extra"
                    value={x.id}
                    label={x.name}
                    hint={`${formatTnd(x.price)} HT ${x.pricing === "par_jour" ? "/ jour" : "forfait"}`}
                    checked={extraIds.includes(x.id)}
                    onChange={(ev) =>
                      setExtraIds((ids) => (ev.target.checked ? [...ids, x.id] : ids.filter((id) => id !== x.id)))
                    }
                  />
                ))}
              </fieldset>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={driverChecked ? "Conducteur additionnel" : "Conducteur additionnel (facultatif)"}
                name="additionalDriver"
                placeholder="Prénom et nom"
                errors={e.additionalDriver}
              />
              <Field
                label="Remise (%)"
                name="discount"
                inputMode="decimal"
                value={discount}
                onChange={(ev) => setDiscount(ev.target.value)}
                placeholder="0"
                hint={`Max. 10 % (30 % pour un administrateur) — votre plafond : ${props.maxDiscountPercent} %.`}
                errors={discountError ? [discountError] : e.discount}
              />
              <SelectField
                label="Mode de caution"
                name="depositMethod"
                defaultValue="carte"
                options={Object.entries(DEPOSIT_METHOD).map(([value, label]) => ({ value, label }))}
                errors={e.depositMethod}
              />
            </div>
            <TextareaField label="Notes" name="notes" placeholder="Vol, heure d'arrivée, demande particulière…" />
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card title="Tarif" actions={quoting && <span className="text-xs text-muted">Calcul…</span>}>
          {!vehicleId || !rate ? (
            <p className="text-sm text-muted">Sélectionnez un véhicule pour afficher le détail du prix.</p>
          ) : (
            <div className={`space-y-3 text-sm ${quoting ? "opacity-60" : ""}`}>
              <ul className="space-y-2">
                {rate.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {l.label}
                      <span className="block text-xs text-muted">
                        {l.quantity} × {formatTnd(l.unitPrice)} HT
                      </span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums">{formatTnd(l.total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 border-t border-border pt-3">
                <div className="flex justify-between">
                  <dt className="text-muted">Sous-total HT</dt>
                  <dd className="tabular-nums">{formatTnd(rate.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">TVA {rate.tvaBp / 100} %</dt>
                  <dd className="tabular-nums">{formatTnd(rate.tva)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Timbre fiscal</dt>
                  <dd className="tabular-nums">{formatTnd(rate.timbre)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total TTC</dt>
                  <dd className="tabular-nums">{formatTnd(rate.total)}</dd>
                </div>
              </dl>
              <dl className="space-y-1 rounded-md bg-border/30 p-3 text-xs">
                <div className="flex justify-between">
                  <dt>Caution</dt>
                  <dd className="font-medium tabular-nums">{formatTnd(rate.deposit)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Kilométrage inclus</dt>
                  <dd className="font-medium">
                    {rate.kmPerDay === null ? "Illimité" : `${(rate.kmPerDay * rate.days).toLocaleString("fr-FR")} km (${rate.kmPerDay} km/j)`}
                  </dd>
                </div>
                {rate.kmPerDay !== null && (
                  <div className="flex justify-between">
                    <dt>Km supplémentaire</dt>
                    <dd className="tabular-nums">{formatTnd(rate.extraKmRate)} HT</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          <Button type="submit" className="mt-4 w-full" disabled={submitting || !vehicleId || !customerId || Boolean(discountError)}>
            {submitting ? "Création…" : "Confirmer la réservation"}
          </Button>
        </Card>
      </aside>
    </form>
  );
}
