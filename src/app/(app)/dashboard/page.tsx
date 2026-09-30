import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Badge, ButtonLink, Card, PageHeader, StatCard } from "@/components/ui";
import { VEHICLE_STATUS } from "@/domain/labels";
import { formatPercent } from "@/domain/reports/metrics";
import { formatDateTime, formatMonth } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { ROLE_LABELS } from "@/domain/tenancy/roles";
import type { Contract } from "@/domain/rentals/types";
import type { Vehicle, VehicleStatus } from "@/domain/fleet/types";
import { dashboard } from "@/server/reports/service";
import { getTenantContext } from "@/server/tenancy/context";

export const metadata: Metadata = { title: "Tableau de bord" };

type ContractRow = { contract: Contract; customerName: string; vehicle: Vehicle };

const STATUS_COLORS: Record<VehicleStatus, string> = {
  disponible: "bg-success",
  loue: "bg-primary",
  maintenance: "bg-warning",
  hors_service: "bg-danger",
};

function ContractList({
  rows,
  empty,
  dateOf,
  tone,
}: {
  rows: ContractRow[];
  empty: string;
  dateOf: (c: Contract) => string;
  tone?: "danger";
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="-my-2 divide-y divide-border">
      {rows.map(({ contract, customerName, vehicle }) => (
        <li key={contract.id}>
          <Link
            href={`/reservations/${contract.id}`}
            className="flex items-start justify-between gap-3 py-2 text-sm hover:text-primary"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{customerName}</span>
              <span className="block truncate text-xs text-muted">
                {contract.number} · {vehicle.make} {vehicle.model} · {vehicle.plate}
              </span>
            </span>
            <span className={`shrink-0 text-xs tabular-nums ${tone === "danger" ? "font-medium text-danger" : "text-muted"}`}>
              {formatDateTime(dateOf(contract))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CountTitle({ children, count, tone }: { children: ReactNode; count: number; tone?: "danger" | "warning" }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <Badge tone={count > 0 && tone ? tone : "neutral"}>{count}</Badge>
    </span>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await getTenantContext();
  const { acces } = await searchParams;
  const data = dashboard(ctx);

  const canFleet = can(ctx.role, "fleet.view");
  const canContracts = can(ctx.role, "contracts.view");
  const canReports = can(ctx.role, "reports.view");
  const canFinanceView = can(ctx.role, "finance.view");
  const showFinance = canFinanceView || canReports;
  const showFleetKpis = canFleet || canReports;

  const quickActions = [
    { href: "/reservations/new", label: "Nouvelle réservation", show: can(ctx.role, "contracts.manage") },
    { href: "/customers/new", label: "Nouveau client", show: can(ctx.role, "customers.manage") },
    { href: "/fleet/new", label: "Ajouter un véhicule", show: can(ctx.role, "fleet.manage") },
    { href: "/maintenance/new", label: "Nouvel ordre de travail", show: can(ctx.role, "maintenance.manage") },
    { href: "/planning", label: "Planning", show: canContracts },
  ].filter((a) => a.show);

  const totalVehicles = Object.values(data.byStatus).reduce((s, n) => s + n, 0);
  const maxRevenue = Math.max(1, ...data.revenueByMonth.map((m) => m.total));
  const sortedAlerts = [...data.alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Tableau de bord"
        description={`${ctx.tenant.name} · ${ROLE_LABELS[ctx.role]}`}
        actions={quickActions.map((a, i) => (
          <ButtonLink key={a.href} href={a.href} variant={i === 0 ? "primary" : "secondary"}>
            {a.label}
          </ButtonLink>
        ))}
      />

      {acces === "refuse" && <Alert tone="warning">Vous n&apos;avez pas accès à cette page avec votre rôle.</Alert>}

      {(showFleetKpis || showFinance) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {showFleetKpis && (
            <>
              <StatCard
                label="Flotte active"
                value={data.activeFleet}
                hint={`${data.byStatus.hors_service} hors service`}
                href={canFleet ? "/fleet" : undefined}
              />
              <StatCard
                label="Utilisation actuelle"
                value={formatPercent(data.utilizationNow)}
                hint={`${data.byStatus.loue} véhicule${data.byStatus.loue > 1 ? "s" : ""} en location`}
              />
              <StatCard
                label="Utilisation du mois"
                value={formatPercent(data.monthMetrics.utilization)}
                hint={`${Math.round(data.monthMetrics.rentedDays)} jours loués`}
              />
            </>
          )}
          {showFinance && (
            <>
              <StatCard
                label="CA HT du mois"
                value={formatTnd(data.monthMetrics.revenue)}
                href={canReports ? "/reports" : undefined}
              />
              <StatCard label="RevPAV du mois" value={formatTnd(data.monthMetrics.revPav)} hint="Revenu par véhicule-jour disponible" />
              <StatCard
                label="Encours clients"
                value={formatTnd(data.outstanding)}
                tone={data.overdueInvoices > 0 ? "warning" : undefined}
                hint={
                  data.overdueInvoices > 0
                    ? `${data.overdueInvoices} facture${data.overdueInvoices > 1 ? "s" : ""} en retard`
                    : "Aucune facture en retard"
                }
                href={canFinanceView ? (data.overdueInvoices > 0 ? "/billing?status=en_retard" : "/billing") : undefined}
              />
            </>
          )}
        </div>
      )}

      {canFleet && (
        <Card title="État de la flotte" actions={<Link href="/fleet" className="text-sm text-primary hover:underline">Voir la flotte</Link>}>
          {totalVehicles === 0 ? (
            <p className="text-sm text-muted">Aucun véhicule enregistré.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-border" role="presentation">
                {(Object.keys(data.byStatus) as VehicleStatus[]).map((s) =>
                  data.byStatus[s] > 0 ? (
                    <div key={s} className={STATUS_COLORS[s]} style={{ width: `${(data.byStatus[s] / totalVehicles) * 100}%` }} />
                  ) : null,
                )}
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(data.byStatus) as VehicleStatus[]).map((s) => (
                  <li key={s}>
                    <Link href={`/fleet?status=${s}`} className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-border/40">
                      <span className={`size-2.5 shrink-0 rounded-full ${STATUS_COLORS[s]}`} aria-hidden />
                      <span className="text-muted">{VEHICLE_STATUS[s].label}</span>
                      <span className="ml-auto font-semibold tabular-nums">{data.byStatus[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {canContracts && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={<CountTitle count={data.departures.length} tone="warning">Départs du jour</CountTitle>}>
            <ContractList rows={data.departures} empty="Aucun départ prévu aujourd'hui." dateOf={(c) => c.startAt} />
          </Card>
          <Card title={<CountTitle count={data.returns.length} tone="warning">Retours du jour</CountTitle>}>
            <ContractList rows={data.returns} empty="Aucun retour prévu aujourd'hui." dateOf={(c) => c.endAt} />
          </Card>
          <Card title={<CountTitle count={data.overdue.length} tone="danger">Retours en retard</CountTitle>}>
            <ContractList rows={data.overdue} empty="Aucun retour en retard." dateOf={(c) => c.endAt} tone="danger" />
          </Card>
          <Card title={<CountTitle count={data.toClose.length} tone="warning">À clôturer</CountTitle>}>
            <ContractList
              rows={data.toClose}
              empty="Aucun contrat en attente de clôture."
              dateOf={(c) => c.checkin?.at ?? c.endAt}
            />
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {showFinance && (
          <Card title="Chiffre d'affaires HT (6 mois)">
            <div className="flex h-48 items-end gap-2 sm:gap-4">
              {data.revenueByMonth.map((m) => (
                <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="truncate text-[10px] tabular-nums text-muted sm:text-xs">{formatTnd(m.total)}</span>
                  <div
                    className="w-full max-w-12 rounded-t bg-primary"
                    style={{ height: `${Math.max(2, (m.total / maxRevenue) * 100)}%` }}
                    title={`${formatMonth(`${m.month}-15T12:00:00Z`)} : ${formatTnd(m.total)}`}
                  />
                  <span className="truncate text-xs text-muted">{formatMonth(`${m.month}-15T12:00:00Z`)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {canFleet && (
          <Card title={<CountTitle count={sortedAlerts.length} tone="warning">Alertes flotte</CountTitle>}>
            {sortedAlerts.length === 0 ? (
              <p className="text-sm text-muted">Aucune alerte : documents et entretiens à jour.</p>
            ) : (
              <ul className="-my-2 max-h-72 divide-y divide-border overflow-y-auto">
                {sortedAlerts.map((a) => (
                  <li key={a.key}>
                    <Link href={`/fleet/${a.vehicle.id}`} className="flex items-start justify-between gap-3 py-2 text-sm hover:text-primary">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {a.vehicle.make} {a.vehicle.model} · {a.vehicle.plate}
                        </span>
                        <span className="block text-xs text-muted">{a.message}</span>
                      </span>
                      <Badge tone={a.severity}>{a.kind === "entretien" ? "Entretien" : "Document"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {canContracts && (
          <Card
            title="Prochaines réservations (7 j)"
            actions={<Link href="/reservations" className="text-sm text-primary hover:underline">Toutes les réservations</Link>}
          >
            <ContractList rows={data.upcoming} empty="Aucune réservation dans les 7 prochains jours." dateOf={(c) => c.startAt} />
          </Card>
        )}
      </div>
    </div>
  );
}
