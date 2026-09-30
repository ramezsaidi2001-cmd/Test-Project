import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CONTRACT_STATUS } from "@/domain/labels";
import type { ContractStatus } from "@/domain/rentals/types";
import { addDays, DAY, formatDate, formatDateTime, formatWeekday, HOUR, parseLocalDate, tunisDay } from "@/domain/shared/dates";
import { can } from "@/domain/tenancy/permissions";
import { planning, type PlanningRow } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Planning" };

const DAYS = 14;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const STATUS_CELL: Record<ContractStatus, string> = {
  reservee: "bg-primary/20 text-primary hover:bg-primary/30",
  en_cours: "bg-warning-surface text-warning hover:brightness-95",
  retournee: "bg-border text-muted hover:bg-border/80",
  cloturee: "bg-border text-muted hover:bg-border/80",
  annulee: "",
};

const MAINTENANCE_CELL =
  "bg-danger-surface text-danger [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.08)_4px_8px)]";

type Booking = PlanningRow["bookings"][number];

/** Prefer active bookings when several touch the same day. */
const PRIORITY: Record<ContractStatus, number> = { en_cours: 0, reservee: 1, retournee: 2, cloturee: 3, annulee: 4 };

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const ctx = await requirePagePermission("contracts.view");
  const sp = await searchParams;
  const today = tunisDay(new Date());
  const from = parseLocalDate(one(sp.from)) ?? parseLocalDate(today)!;
  const fromDay = tunisDay(from);
  const rows = planning(ctx, from, DAYS);
  const canManage = can(ctx.role, "contracts.manage");

  const days = Array.from({ length: DAYS }, (_, i) => {
    const start = addDays(from, i);
    const key = tunisDay(new Date(start.getTime() + 12 * HOUR));
    return { start, end: new Date(start.getTime() + DAY), key };
  });
  const nav = (offset: number) => `/planning?from=${tunisDay(addDays(from, offset))}`;
  const lastDay = days[days.length - 1];

  return (
    <div className="max-w-full">
      <PageHeader
        title="Planning"
        description={`Disponibilité de la flotte du ${formatDate(from)} au ${formatDate(lastDay.start)}.`}
        actions={
          <>
            <ButtonLink href={nav(-DAYS)} variant="secondary">
              ← 2 semaines
            </ButtonLink>
            <ButtonLink href="/planning" variant={fromDay === today ? "primary" : "secondary"}>
              Aujourd&apos;hui
            </ButtonLink>
            <ButtonLink href={nav(DAYS)} variant="secondary">
              2 semaines →
            </ButtonLink>
          </>
        }
      />

      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Légende">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary/20" /> {CONTRACT_STATUS.reservee.label}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warning-surface ring-1 ring-warning/40" /> {CONTRACT_STATUS.en_cours.label}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-border" /> Retournée / clôturée
        </li>
        <li className="flex items-center gap-1.5">
          <span className={`size-3 rounded-sm ${MAINTENANCE_CELL}`} /> Immobilisé (entretien)
        </li>
        {canManage && <li className="text-muted">Cliquez sur une case libre pour réserver.</li>}
      </ul>

      {rows.length === 0 ? (
        <EmptyState title="Aucun véhicule" description="Ajoutez des véhicules à la flotte pour afficher le planning." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky left-0 z-10 min-w-36 bg-surface px-3 py-2 text-left font-medium text-muted">
                  Véhicule
                </th>
                {days.map((d) => (
                  <th
                    key={d.key}
                    scope="col"
                    className={`min-w-14 whitespace-nowrap border-l border-border px-1 py-2 text-center font-medium capitalize ${
                      d.key === today ? "bg-primary/10 text-primary" : "text-muted"
                    }`}
                  >
                    {formatWeekday(d.start)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.vehicle.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-normal">
                    {can(ctx.role, "fleet.view") ? (
                      <Link href={`/fleet/${row.vehicle.id}`} className="block whitespace-nowrap font-medium hover:text-primary">
                        {row.vehicle.plate}
                      </Link>
                    ) : (
                      <span className="block whitespace-nowrap font-medium">{row.vehicle.plate}</span>
                    )}
                    <span className="text-muted">
                      {row.categoryCode} · {row.vehicle.make} {row.vehicle.model}
                    </span>
                  </th>
                  {days.map((d) => {
                    const booking = row.bookings
                      .filter((b) => new Date(b.startAt) < d.end && new Date(b.endAt) > d.start)
                      .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])[0] as Booking | undefined;
                    const maintenance = row.maintenance.find((m) => new Date(m.openedAt) < d.end);
                    return (
                      <td key={d.key} className={`h-11 border-l border-border p-0 ${d.key === today ? "bg-primary/5" : ""}`}>
                        {booking ? (
                          <Link
                            href={`/reservations/${booking.id}`}
                            title={`${booking.number} · ${booking.customerName}\n${formatDateTime(booking.startAt)} → ${formatDateTime(booking.endAt)}\n${CONTRACT_STATUS[booking.status].label}`}
                            className={`flex h-full w-full items-center justify-center truncate px-1 font-medium ${STATUS_CELL[booking.status]}`}
                          >
                            <span className="truncate">{booking.customerName.split(" ")[0]}</span>
                          </Link>
                        ) : maintenance ? (
                          <span
                            title={`Immobilisé : ordre de travail ${maintenance.number} (depuis le ${formatDate(maintenance.openedAt)})`}
                            className={`flex h-full w-full items-center justify-center ${MAINTENANCE_CELL}`}
                          >
                            <span className="sr-only">Entretien {maintenance.number}</span>
                          </span>
                        ) : canManage && d.key >= today ? (
                          <Link
                            href={`/reservations/new?start=${d.key}T10:00&end=${tunisDay(addDays(d.start, 3.5))}T10:00&vehicleId=${row.vehicle.id}`}
                            title={`Réserver ${row.vehicle.plate} à partir du ${formatDate(d.start)}`}
                            aria-label={`Réserver à partir du ${formatDate(d.start)}`}
                            className="block h-full w-full hover:bg-primary/10"
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
