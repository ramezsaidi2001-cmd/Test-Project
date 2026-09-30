import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/client";
import { Badge, ButtonLink, Card, DescriptionList, EmptyState, PageHeader, StatCard, TBody, THead, Table, Td } from "@/components/ui";
import {
  CONTRACT_STATUS,
  FUEL_TYPE,
  MILEAGE_SOURCE,
  TRANSMISSION,
  VEHICLE_STATUS,
  WORK_ORDER_STATUS,
  WORK_ORDER_TYPE,
  fuelLabel,
  type Tone,
} from "@/domain/labels";
import { DAY, formatDate, formatDateTime } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { getVehicleDetail } from "@/server/fleet/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { ActionForm } from "../_components/action-form";
import { recordMileageAction, setOutOfServiceAction } from "../actions";
import { MileageForm } from "./mileage-form";

export async function generateMetadata({ params }: PageProps<"/fleet/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requirePagePermission("fleet.view");
  const detail = getVehicleDetail(ctx, id);
  return { title: detail ? `Véhicule ${detail.vehicle.plate}` : "Véhicule introuvable" };
}

/** Expiry status of a vehicle document (computed outside render for purity). */
function expiryStatus(iso: string): { label: string; tone: Tone } {
  const daysLeft = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  if (daysLeft < 0) return { label: "Expiré", tone: "danger" };
  if (daysLeft <= 30) return { label: `J-${daysLeft}`, tone: "warning" };
  return { label: "Valide", tone: "success" };
}

const km = (n: number) => `${n.toLocaleString("fr-FR")} km`;

export default async function VehiclePage({ params }: PageProps<"/fleet/[id]">) {
  const { id } = await params;
  const ctx = await requirePagePermission("fleet.view");
  const detail = getVehicleDetail(ctx, id);
  if (!detail) notFound();

  const { vehicle: v, category, branch, alerts, contracts, workOrders, logs, stats } = detail;
  const status = VEHICLE_STATUS[v.status];
  const canManage = can(ctx.role, "fleet.manage");
  const canViewMaintenance = can(ctx.role, "maintenance.view");
  const canManageMaintenance = can(ctx.role, "maintenance.manage");
  const kmLeft = v.nextServiceKm - v.mileage;

  const documents = [
    { label: "Assurance", sub: v.documents.insurer, date: v.documents.insuranceExpiry },
    { label: "Visite technique", sub: null, date: v.documents.technicalInspectionExpiry },
    { label: "Vignette", sub: null, date: v.documents.vignetteExpiry },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/fleet", label: "Flotte" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {v.plate}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        description={`${v.make} ${v.model} ${v.trim} · ${v.year} · ${category?.name ?? "—"} · ${branch?.name ?? "—"}`}
        actions={
          <>
            {canManageMaintenance && (
              <ButtonLink href={`/maintenance/new?vehicleId=${v.id}`} variant="secondary">
                Créer un ordre de travail
              </ButtonLink>
            )}
            {canManage && (
              <ButtonLink href={`/fleet/${v.id}/edit`} variant="secondary">
                Modifier
              </ButtonLink>
            )}
            {canManage &&
              (v.status === "hors_service" ? (
                <ActionForm action={setOutOfServiceAction.bind(null, v.id, false)} className="flex flex-col items-end">
                  <ConfirmSubmit variant="primary" message={`Remettre ${v.plate} en service ?`}>
                    Remettre en service
                  </ConfirmSubmit>
                </ActionForm>
              ) : (
                <ActionForm action={setOutOfServiceAction.bind(null, v.id, true)} className="flex flex-col items-end">
                  <ConfirmSubmit message={`Mettre ${v.plate} hors service ? Il ne pourra plus être réservé.`}>
                    Mettre hors service
                  </ConfirmSubmit>
                </ActionForm>
              ))}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Revenu HT" value={formatTnd(stats.revenue)} />
        <StatCard label="Coût d'entretien" value={formatTnd(stats.maintenanceCost)} />
        <StatCard label="Km parcourus" value={stats.kmDriven.toLocaleString("fr-FR")} hint="Depuis le premier relevé" />
        <StatCard label="Coût / km" value={stats.kmDriven > 0 ? formatTnd(stats.costPerKm) : "—"} hint="Entretien" />
        <StatCard label="Utilisation 90 j" value={`${Math.round(stats.utilization90 * 100)} %`} />
        <StatCard label="TCO" value={formatTnd(stats.tco)} hint="Acquisition + entretien" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Identité & caractéristiques">
            <DescriptionList
              columns={3}
              items={[
                { label: "Immatriculation", value: v.plate },
                { label: "VIN", value: <span className="font-mono text-xs">{v.vin}</span> },
                { label: "Véhicule", value: `${v.make} ${v.model} ${v.trim}` },
                { label: "Année", value: v.year },
                { label: "Couleur", value: v.color },
                { label: "Catégorie", value: category ? `${category.code} — ${category.name}` : "—" },
                { label: "Carburant", value: FUEL_TYPE[v.fuel] },
                { label: "Boîte", value: TRANSMISSION[v.transmission] },
                { label: "Places", value: v.seats },
                { label: "Agence", value: branch ? `${branch.name} (${branch.city})` : "—" },
                { label: "Kilométrage", value: km(v.mileage) },
                { label: "Carburant (niveau)", value: fuelLabel(v.fuelLevel) },
                {
                  label: "Prochain entretien",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {km(v.nextServiceKm)}
                      {kmLeft <= 1000 && (
                        <Badge tone={kmLeft <= 0 ? "danger" : "warning"}>
                          {kmLeft <= 0 ? `Dépassé de ${km(-kmLeft)}` : `Dans ${km(kmLeft)}`}
                        </Badge>
                      )}
                    </span>
                  ),
                },
                { label: "Intervalle d'entretien", value: km(v.serviceIntervalKm) },
                { label: "Acquisition", value: `${formatDate(v.acquisitionDate)} · ${formatTnd(v.acquisitionCost)}` },
                { label: "Boîtier GPS", value: v.gpsDeviceId ?? "—" },
              ]}
            />
          </Card>

          <Card title="Historique des locations">
            {contracts.length === 0 ? (
              <p className="text-sm text-muted">Aucune location pour ce véhicule.</p>
            ) : (
              <div>
                <Table>
                  <THead columns={["Contrat", "Client", "Période", "Statut"]} />
                  <TBody>
                    {contracts.map(({ contract: c, customerName }) => (
                      <tr key={c.id}>
                        <Td className="whitespace-nowrap font-medium">
                          <Link href={`/reservations/${c.id}`} className="text-primary hover:underline">
                            {c.number}
                          </Link>
                        </Td>
                        <Td>
                          <Link href={`/customers/${c.customerId}`} className="hover:underline">
                            {customerName}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {formatDate(c.startAt)} → {formatDate(c.endAt)}
                        </Td>
                        <Td>
                          <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>

          <Card
            title="Historique d'entretien"
            actions={
              canManageMaintenance && (
                <Link href={`/maintenance/new?vehicleId=${v.id}`} className="text-sm text-primary hover:underline">
                  Nouvel ordre de travail
                </Link>
              )
            }
          >
            {workOrders.length === 0 ? (
              <p className="text-sm text-muted">Aucun ordre de travail pour ce véhicule.</p>
            ) : (
              <div>
                <Table>
                  <THead columns={["N°", "Type", "Description", "Ouvert le", { label: "Coût", className: "text-right" }, "Statut"]} />
                  <TBody>
                    {workOrders.map((w) => (
                      <tr key={w.id}>
                        <Td className="whitespace-nowrap font-medium">
                          {canViewMaintenance ? (
                            <Link href={`/maintenance/${w.id}`} className="text-primary hover:underline">
                              {w.number}
                            </Link>
                          ) : (
                            w.number
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">{WORK_ORDER_TYPE[w.type]}</Td>
                        <Td>{w.description}</Td>
                        <Td className="whitespace-nowrap">{formatDate(w.openedAt)}</Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(w.partsCost + w.laborCost)}</Td>
                        <Td>
                          <Badge tone={WORK_ORDER_STATUS[w.status].tone}>{WORK_ORDER_STATUS[w.status].label}</Badge>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>

          <Card title="Journal kilométrique">
            {logs.length === 0 ? (
              <EmptyState title="Aucun relevé" />
            ) : (
              <div>
                <Table>
                  <THead
                    columns={["Date", { label: "Kilométrage", className: "text-right" }, "Carburant", "Source", "Référence", "Note", "Par"]}
                  />
                  <TBody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <Td className="whitespace-nowrap">{formatDateTime(l.at)}</Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">{km(l.km)}</Td>
                        <Td className="whitespace-nowrap">{fuelLabel(l.fuelLevel)}</Td>
                        <Td className="whitespace-nowrap">{MILEAGE_SOURCE[l.source]}</Td>
                        <Td className="whitespace-nowrap">{l.reference ?? "—"}</Td>
                        <Td>{l.note ?? "—"}</Td>
                        <Td className="whitespace-nowrap text-muted">{l.recordedBy}</Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Historique en ajout seul : les relevés ne peuvent être ni modifiés ni supprimés.</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={`Alertes (${alerts.length})`}>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted">Aucune alerte : documents et entretien à jour.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.key} className="flex items-start gap-2 text-sm">
                    <Badge tone={a.severity}>{a.severity === "danger" ? "Urgent" : "À prévoir"}</Badge>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Documents & échéances">
            <p className="mb-3 text-sm">
              <span className="text-muted">Carte grise : </span>
              {v.documents.registrationNumber}
            </p>
            <ul className="divide-y divide-border">
              {documents.map((d) => {
                const s = expiryStatus(d.date);
                return (
                  <li key={d.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{d.label}</span>
                      {d.sub && <span className="block text-xs text-muted">{d.sub}</span>}
                    </span>
                    <span className="flex items-center gap-2 text-right">
                      <span className={s.tone === "danger" ? "text-danger" : s.tone === "warning" ? "text-warning" : ""}>
                        {formatDate(d.date)}
                      </span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          {canManage && (
            <Card title="Relever le kilométrage">
              <MileageForm action={recordMileageAction.bind(null, v.id)} currentKm={v.mileage} currentFuel={v.fuelLevel} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
