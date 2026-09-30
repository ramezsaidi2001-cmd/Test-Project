import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, EmptyState, PageHeader, StatCard, TBody, THead, Table, Td, Tabs } from "@/components/ui";
import type { WorkOrderStatus } from "@/domain/maintenance/types";
import { WORK_ORDER_STATUS, WORK_ORDER_TYPE } from "@/domain/labels";
import { formatDate } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { listWorkOrders, maintenanceSummary, serviceSchedule } from "@/server/maintenance/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Entretien" };

const STATUS_FILTERS: { value: "" | WorkOrderStatus; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "ouvert", label: "Ouverts" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminés" },
];

const km = (n: number) => `${n.toLocaleString("fr-FR")} km`;

export default async function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  const ctx = await requirePagePermission("maintenance.view");
  const sp = await searchParams;
  const tab = sp.tab === "calendrier" ? "calendrier" : "ordres";
  const status = STATUS_FILTERS.some((f) => f.value && f.value === sp.status) ? (sp.status as WorkOrderStatus) : "";

  const summary = maintenanceSummary(ctx);
  const canManage = can(ctx.role, "maintenance.manage");
  const canViewFleet = can(ctx.role, "fleet.view");
  const vehicleHref = (id: string) => (canViewFleet ? `/fleet/${id}` : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entretien"
        description="Ordres de travail, immobilisations et calendrier d'entretien préventif."
        actions={canManage && <ButtonLink href="/maintenance/new">Nouvel ordre de travail</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ordres ouverts" value={summary.open} href="/maintenance?status=ouvert" />
        <StatCard
          label="Véhicules immobilisés"
          value={summary.immobilized}
          tone={summary.immobilized > 0 ? "warning" : undefined}
          href={canViewFleet ? "/fleet?status=maintenance" : undefined}
        />
        <StatCard
          label="Entretiens à prévoir"
          value={summary.serviceDue}
          hint="≤ 1 000 km restants"
          tone={summary.serviceDue > 0 ? "warning" : undefined}
          href="/maintenance?tab=calendrier"
        />
        <StatCard label="Coût sur 12 mois" value={formatTnd(summary.costYear)} hint="Ordres clôturés" />
      </div>

      <Tabs
        current={tab}
        tabs={[
          { value: "ordres", label: "Ordres de travail", href: "/maintenance" },
          { value: "calendrier", label: "Calendrier d'entretien", href: "/maintenance?tab=calendrier" },
        ]}
      />

      {tab === "ordres" ? <WorkOrdersTab status={status} ctx={ctx} canManage={canManage} vehicleHref={vehicleHref} /> : null}
      {tab === "calendrier" ? <ScheduleTab ctx={ctx} canManage={canManage} vehicleHref={vehicleHref} /> : null}
    </div>
  );
}

type Ctx = Awaited<ReturnType<typeof requirePagePermission>>;

function VehicleLink({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? (
    <Link href={href} className="text-primary hover:underline">
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

function WorkOrdersTab({
  ctx,
  status,
  canManage,
  vehicleHref,
}: {
  ctx: Ctx;
  status: "" | WorkOrderStatus;
  canManage: boolean;
  vehicleHref: (id: string) => string | null;
}) {
  const all = listWorkOrders(ctx);
  const rows = status ? all.filter((r) => r.workOrder.status === status) : all;

  return (
    <div className="space-y-4">
      <nav aria-label="Statut" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = f.value === status;
          const count = f.value ? all.filter((r) => r.workOrder.status === f.value).length : all.length;
          return (
            <Link
              key={f.label}
              href={f.value ? `/maintenance?status=${f.value}` : "/maintenance"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {f.label} <span className="tabular-nums">({count})</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={status ? "Aucun ordre de travail avec ce statut" : "Aucun ordre de travail"}
          description="Les interventions sur la flotte apparaîtront ici."
          action={canManage && <ButtonLink href="/maintenance/new">Nouvel ordre de travail</ButtonLink>}
        />
      ) : (
        <Table>
          <THead
            columns={["N°", "Véhicule", "Type", "Description", "Garage", "Ouvert le", { label: "Coût total", className: "text-right" }, "Statut"]}
          />
          <TBody>
            {rows.map(({ workOrder: w, vehicle: v }) => (
              <tr key={w.id} className="hover:bg-border/20">
                <Td className="whitespace-nowrap font-medium">
                  <Link href={`/maintenance/${w.id}`} className="text-primary hover:underline">
                    {w.number}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">
                  <VehicleLink href={vehicleHref(v.id)}>{v.plate}</VehicleLink>
                  <span className="block text-xs text-muted">
                    {v.make} {v.model}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{WORK_ORDER_TYPE[w.type]}</Td>
                <Td className="min-w-48">{w.description}</Td>
                <Td>{w.vendor || "—"}</Td>
                <Td className="whitespace-nowrap">{formatDate(w.openedAt)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(w.partsCost + w.laborCost)}</Td>
                <Td>
                  <Badge tone={WORK_ORDER_STATUS[w.status].tone}>{WORK_ORDER_STATUS[w.status].label}</Badge>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function ScheduleTab({ ctx, canManage, vehicleHref }: { ctx: Ctx; canManage: boolean; vehicleHref: (id: string) => string | null }) {
  const rows = serviceSchedule(ctx);
  if (rows.length === 0) {
    return <EmptyState title="Aucun véhicule en service" description="Le calendrier d'entretien s'affichera ici." />;
  }

  return (
    <Table>
      <THead
        columns={[
          "Véhicule",
          { label: "Km actuel", className: "text-right" },
          { label: "Prochain entretien", className: "text-right" },
          "Km restants",
          "Échéances documents",
          "Ordre en cours",
          { label: "Actions", className: "sr-only" },
        ]}
      />
      <TBody>
        {rows.map(({ vehicle: v, kmLeft, alerts, openOrder }) => {
          const docAlerts = alerts.filter((a) => a.kind !== "entretien");
          return (
            <tr key={v.id} className="hover:bg-border/20">
              <Td className="whitespace-nowrap">
                <VehicleLink href={vehicleHref(v.id)}>{v.plate}</VehicleLink>
                <span className="block text-xs text-muted">
                  {v.make} {v.model}
                </span>
              </Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{km(v.mileage)}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{km(v.nextServiceKm)}</Td>
              <Td className="whitespace-nowrap">
                {kmLeft <= 1000 ? (
                  <Badge tone={kmLeft <= 0 ? "danger" : "warning"}>{kmLeft <= 0 ? `Dépassé de ${km(-kmLeft)}` : km(kmLeft)}</Badge>
                ) : (
                  <span className="tabular-nums">{km(kmLeft)}</span>
                )}
              </Td>
              <Td>
                {docAlerts.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <ul className="space-y-1">
                    {docAlerts.map((a) => (
                      <li key={a.key}>
                        <Badge tone={a.severity}>{a.message}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                {openOrder ? (
                  <Link href={`/maintenance/${openOrder.id}`} className="text-primary hover:underline">
                    {openOrder.number}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-right">
                {canManage && !openOrder && (
                  <ButtonLink
                    href={`/maintenance/new?vehicleId=${v.id}&type=entretien_preventif`}
                    variant="secondary"
                    className="!px-3 !py-1 text-xs"
                  >
                    Planifier
                  </ButtonLink>
                )}
              </Td>
            </tr>
          );
        })}
      </TBody>
    </Table>
  );
}
