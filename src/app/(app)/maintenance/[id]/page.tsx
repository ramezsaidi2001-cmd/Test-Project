import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/client";
import { Badge, Card, DescriptionList, PageHeader } from "@/components/ui";
import { CONTRACT_STATUS, VEHICLE_STATUS, WORK_ORDER_STATUS, WORK_ORDER_TYPE } from "@/domain/labels";
import { formatDateTime } from "@/domain/shared/dates";
import { formatTnd, formatTndPlain } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { getWorkOrder } from "@/server/maintenance/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { ActionForm } from "../../fleet/_components/action-form";
import { completeWorkOrderAction, startWorkOrderAction, updateWorkOrderCostsAction } from "../actions";
import { CompleteForm, CostsForm } from "./work-order-forms";

export async function generateMetadata({ params }: PageProps<"/maintenance/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requirePagePermission("maintenance.view");
  const detail = getWorkOrder(ctx, id);
  return { title: detail ? `Ordre de travail ${detail.workOrder.number}` : "Ordre de travail introuvable" };
}

export default async function WorkOrderPage({ params }: PageProps<"/maintenance/[id]">) {
  const { id } = await params;
  const ctx = await requirePagePermission("maintenance.view");
  const detail = getWorkOrder(ctx, id);
  if (!detail) notFound();

  const { workOrder: w, vehicle: v, contract } = detail;
  const status = WORK_ORDER_STATUS[w.status];
  const canManage = can(ctx.role, "maintenance.manage");
  const canViewFleet = can(ctx.role, "fleet.view");
  const canViewContracts = can(ctx.role, "contracts.view");
  const done = w.status === "termine";

  const vehicleLabel = `${v.plate} — ${v.make} ${v.model}`;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/maintenance", label: "Entretien" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {w.number}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        description={`${WORK_ORDER_TYPE[w.type]} · ${vehicleLabel}`}
        actions={
          canManage &&
          w.status === "ouvert" && (
            <ActionForm action={startWorkOrderAction.bind(null, w.id)} className="flex flex-col items-end">
              <SubmitButton pendingLabel="Traitement…">Démarrer les travaux</SubmitButton>
            </ActionForm>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Détails">
            <DescriptionList
              items={[
                {
                  label: "Véhicule",
                  value: canViewFleet ? (
                    <Link href={`/fleet/${v.id}`} className="text-primary hover:underline">
                      {vehicleLabel}
                    </Link>
                  ) : (
                    vehicleLabel
                  ),
                },
                { label: "Statut du véhicule", value: <Badge tone={VEHICLE_STATUS[v.status].tone}>{VEHICLE_STATUS[v.status].label}</Badge> },
                { label: "Type", value: WORK_ORDER_TYPE[w.type] },
                { label: "Garage / prestataire", value: w.vendor || "—" },
                { label: "Description", value: w.description },
                { label: "Immobilisation", value: w.immobilizing ? "Oui — véhicule indisponible" : "Non" },
                { label: "Ouvert le", value: formatDateTime(w.openedAt) },
                { label: "Clôturé le", value: w.closedAt ? formatDateTime(w.closedAt) : "—" },
                { label: "Km à l'ouverture", value: `${w.kmAtOpen.toLocaleString("fr-FR")} km` },
                { label: "Km actuel du véhicule", value: `${v.mileage.toLocaleString("fr-FR")} km` },
                { label: "Notes", value: w.notes || "—" },
              ]}
            />
          </Card>

          {contract && (
            <Card title="Contrat lié (dommages constatés au retour)">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {canViewContracts ? (
                  <Link href={`/reservations/${contract.id}`} className="font-medium text-primary hover:underline">
                    {contract.number}
                  </Link>
                ) : (
                  <span className="font-medium">{contract.number}</span>
                )}
                <Badge tone={CONTRACT_STATUS[contract.status].tone}>{CONTRACT_STATUS[contract.status].label}</Badge>
                {contract.checkin?.damages.length ? (
                  <ul className="basis-full list-inside list-disc text-muted">
                    {contract.checkin.damages.map((d, i) => (
                      <li key={i}>
                        {d.description} — {formatTnd(d.cost)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          )}

          {canManage && !done && (
            <Card title="Clôturer l'ordre de travail">
              <CompleteForm
                action={completeWorkOrderAction.bind(null, w.id)}
                km={v.mileage}
                partsCost={formatTndPlain(w.partsCost)}
                laborCost={formatTndPlain(w.laborCost)}
                notes={w.notes ?? ""}
              />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Coûts">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Pièces</dt>
                <dd className="tabular-nums">{formatTnd(w.partsCost)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Main-d&apos;œuvre</dt>
                <dd className="tabular-nums">{formatTnd(w.laborCost)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatTnd(w.partsCost + w.laborCost)}</dd>
              </div>
            </dl>
            {!done && <p className="mt-3 text-xs text-muted">Montants estimatifs jusqu&apos;à la clôture.</p>}
          </Card>

          {canManage && !done && (
            <Card title="Mettre à jour">
              <CostsForm
                action={updateWorkOrderCostsAction.bind(null, w.id)}
                vendor={w.vendor}
                partsCost={formatTndPlain(w.partsCost)}
                laborCost={formatTndPlain(w.laborCost)}
                notes={w.notes ?? ""}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
