import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bar, ButtonLink, Card, PageHeader, StatCard, Table, TBody, Td, THead } from "@/components/ui";
import type { PaymentMethod } from "@/domain/billing/types";
import { PAYMENT_METHOD } from "@/domain/labels";
import { formatPercent } from "@/domain/reports/metrics";
import { formatMonth } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { currentMonth, monthlyReport } from "@/server/reports/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Rapports" };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthLabel = (m: string) => formatMonth(`${m}-15T12:00:00Z`);
const pct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** Comparison with the previous month. `higherIsBetter` drives the color. */
function Delta({ current, previous, points, higherIsBetter = true }: { current: number; previous: number; points?: boolean; higherIsBetter?: boolean }) {
  let text: string;
  let diff: number;
  if (points) {
    diff = (current - previous) * 100;
    text = `${pct.format(diff)} pt${Math.abs(diff) >= 2 ? "s" : ""}`;
  } else {
    if (previous === 0) return <span>Mois précédent : aucune donnée</span>;
    diff = ((current - previous) / previous) * 100;
    text = `${pct.format(diff)} %`;
  }
  if (Math.abs(diff) < 0.05) return <span>= stable vs mois précédent</span>;
  const good = diff > 0 === higherIsBetter;
  return (
    <span>
      <span className={`font-medium ${good ? "text-success" : "text-danger"}`}>
        {diff > 0 ? "↑" : "↓"} {text}
      </span>{" "}
      vs mois précédent
    </span>
  );
}

function SectionTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = await requirePagePermission("reports.view");
  const { month: monthParam } = await searchParams;
  const month = typeof monthParam === "string" && MONTH_PATTERN.test(monthParam) ? monthParam : currentMonth();
  const report = monthlyReport(ctx, month);
  const { overall, previous } = report;
  const isCurrent = month >= currentMonth();

  const maxRevenue = Math.max(1, ...report.trend.map((t) => t.revenue));
  const totalPayments = Object.values(report.payments).reduce((s, n) => s + n, 0);

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Rapports"
        description={`Rapport mensuel · ${monthLabel(month)}`}
        actions={
          <>
            <ButtonLink href={`/reports?month=${report.prevMonth}`} variant="secondary" aria-label="Mois précédent">
              ← {monthLabel(report.prevMonth)}
            </ButtonLink>
            {!isCurrent && (
              <ButtonLink href={`/reports?month=${report.nextMonth}`} variant="secondary" aria-label="Mois suivant">
                {monthLabel(report.nextMonth)} →
              </ButtonLink>
            )}
            <a
              href={`/reports/export?month=${month}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              download
            >
              Exporter CSV
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="CA HT" value={formatTnd(overall.revenue)} hint={<Delta current={overall.revenue} previous={previous.revenue} />} />
        <StatCard
          label="Taux d'utilisation"
          value={formatPercent(overall.utilization)}
          hint={<Delta current={overall.utilization} previous={previous.utilization} points />}
        />
        <StatCard label="RevPAV" value={formatTnd(overall.revPav)} hint={<Delta current={overall.revPav} previous={previous.revPav} />} />
        <StatCard
          label="Taux d'immobilisation"
          value={formatPercent(overall.downtime)}
          hint={<Delta current={overall.downtime} previous={previous.downtime} points higherIsBetter={false} />}
        />
        <StatCard label="Coûts d'entretien" value={formatTnd(report.maintenanceCost)} hint="Ordres de travail clôturés dans le mois" />
      </div>

      <Card title="Tendance sur 12 mois">
        <div className="overflow-x-auto">
          <div className="flex h-56 min-w-[40rem] items-end gap-2">
            {report.trend.map((t) => (
              <Link
                key={t.month}
                href={`/reports?month=${t.month}`}
                className={`group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded ${t.month === month ? "bg-primary/5" : ""}`}
                title={`${monthLabel(t.month)} : ${formatTnd(t.revenue)} · utilisation ${formatPercent(t.utilization)}`}
              >
                <span className="truncate text-[10px] tabular-nums text-muted">{formatTnd(t.revenue)}</span>
                <div
                  className={`w-full max-w-10 rounded-t ${t.month === month ? "bg-primary" : "bg-primary/50 group-hover:bg-primary/80"}`}
                  style={{ height: `${Math.max(2, (t.revenue / maxRevenue) * 100)}%` }}
                />
                <span className="truncate text-xs text-muted">{monthLabel(t.month)}</span>
                <span className="w-full max-w-10">
                  <Bar value={t.utilization} tone="success" />
                </span>
                <span className="text-[10px] tabular-nums text-muted">{formatPercent(t.utilization)}</span>
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden /> CA HT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success" aria-hidden /> Taux d&apos;utilisation
          </span>
        </p>
      </Card>

      <SectionTable title="Par catégorie">
        <Table>
          <THead
            columns={[
              "Catégorie",
              { label: "Véhicules", className: "text-right" },
              { label: "Jours loués", className: "text-right" },
              "Utilisation",
              { label: "CA HT", className: "text-right" },
              { label: "RevPAV", className: "text-right" },
            ]}
          />
          <TBody>
            {report.byCategory.map(({ category, count, metrics }) => (
              <tr key={category.id}>
                <Td className="font-medium">
                  {category.name} <span className="text-xs text-muted">({category.code})</span>
                </Td>
                <Td className="text-right tabular-nums">{count}</Td>
                <Td className="text-right tabular-nums">{metrics.rentedDays.toFixed(1).replace(".", ",")}</Td>
                <Td className="min-w-40">
                  <div className="flex items-center gap-2">
                    <Bar value={metrics.utilization} />
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums">{formatPercent(metrics.utilization)}</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(metrics.revenue)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(metrics.revPav)}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </SectionTable>

      <SectionTable title="Par véhicule">
        <Table>
          <THead
            columns={[
              "Véhicule",
              { label: "Jours loués", className: "text-right" },
              "Utilisation",
              { label: "CA HT", className: "text-right" },
              { label: "Entretien", className: "text-right" },
              { label: "Marge", className: "text-right" },
            ]}
          />
          <TBody>
            {report.byVehicle.map(({ vehicle, metrics, maintenanceCost, margin }) => (
              <tr key={vehicle.id}>
                <Td>
                  <Link href={`/fleet/${vehicle.id}`} className="font-medium hover:text-primary hover:underline">
                    {vehicle.make} {vehicle.model}
                  </Link>
                  <span className="block text-xs text-muted">{vehicle.plate}</span>
                </Td>
                <Td className="text-right tabular-nums">{metrics.rentedDays.toFixed(1).replace(".", ",")}</Td>
                <Td className="min-w-40">
                  <div className="flex items-center gap-2">
                    <Bar value={metrics.utilization} />
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums">{formatPercent(metrics.utilization)}</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(metrics.revenue)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(maintenanceCost)}</Td>
                <Td className={`whitespace-nowrap text-right font-medium tabular-nums ${margin < 0 ? "text-danger" : ""}`}>
                  {formatTnd(margin)}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </SectionTable>

      <Card title="Encaissements par mode de paiement">
        {totalPayments === 0 ? (
          <p className="text-sm text-muted">Aucun encaissement ce mois-ci.</p>
        ) : (
          <ul className="space-y-3">
            {(Object.keys(report.payments) as PaymentMethod[]).map((m) => (
              <li key={m} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_8rem]">
                <span className="truncate">{PAYMENT_METHOD[m]}</span>
                <Bar value={report.payments[m] / totalPayments} />
                <span className="text-right tabular-nums">{formatTnd(report.payments[m])}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
              <span>Total encaissé</span>
              <span className="tabular-nums">{formatTnd(totalPayments)}</span>
            </li>
          </ul>
        )}
      </Card>
    </div>
  );
}
