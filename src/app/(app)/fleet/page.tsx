import type { Metadata } from "next";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/client";
import { Badge, Button, ButtonLink, EmptyState, PageHeader, StatCard, TBody, THead, Table, Td } from "@/components/ui";
import type { VehicleStatus } from "@/domain/fleet/types";
import { VEHICLE_STATUS, fuelLabel } from "@/domain/labels";
import { can } from "@/domain/tenancy/permissions";
import { listFleetReferenceData, listVehicles } from "@/server/fleet/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export const metadata: Metadata = { title: "Flotte" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function FleetPage({ searchParams }: PageProps<"/fleet">) {
  const ctx = await requirePagePermission("fleet.view");
  const sp = await searchParams;
  const filters = { q: param(sp.q), status: param(sp.status), categoryId: param(sp.categoryId), branchId: param(sp.branchId) };

  const all = listVehicles(ctx);
  const rows = listVehicles(ctx, filters);
  const { categories, branches } = listFleetReferenceData(ctx);
  const canManage = can(ctx.role, "fleet.manage");
  const hasFilters = Boolean(filters.q || filters.status || filters.categoryId || filters.branchId);

  const statuses = Object.keys(VEHICLE_STATUS) as VehicleStatus[];
  const counts = Object.fromEntries(statuses.map((s) => [s, all.filter((r) => r.vehicle.status === s).length]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flotte"
        description={`${all.length} ${all.length === 1 ? "véhicule" : "véhicules"} chez ${ctx.tenant.name}.`}
        actions={canManage && <ButtonLink href="/fleet/new">Ajouter un véhicule</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={all.length} href="/fleet" />
        {statuses.map((s) => (
          <StatCard
            key={s}
            label={VEHICLE_STATUS[s].label}
            value={counts[s]}
            tone={s === "hors_service" && counts[s] > 0 ? "danger" : s === "maintenance" && counts[s] > 0 ? "warning" : undefined}
            href={`/fleet?status=${s}`}
          />
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <label className="min-w-0 flex-1 basis-56">
          <span className="sr-only">Rechercher</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Immatriculation, marque, modèle, VIN…"
            className="block w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label>
          <span className="sr-only">Statut</span>
          <AutoSubmitSelect name="status" defaultValue={filters.status}>
            <option value="">Tous les statuts</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS[s].label}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label>
          <span className="sr-only">Catégorie</span>
          <AutoSubmitSelect name="categoryId" defaultValue={filters.categoryId}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label>
          <span className="sr-only">Agence</span>
          <AutoSubmitSelect name="branchId" defaultValue={filters.branchId}>
            <option value="">Toutes les agences</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <Button type="submit" variant="secondary" className="!py-1.5">
          Filtrer
        </Button>
        {hasFilters && (
          <Link href="/fleet" className="px-2 py-1.5 text-sm text-muted hover:text-foreground">
            Réinitialiser
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Aucun véhicule ne correspond à ces filtres" : "Aucun véhicule dans la flotte"}
          description={hasFilters ? "Modifiez ou réinitialisez les filtres." : "Ajoutez votre premier véhicule pour commencer à louer."}
          action={
            hasFilters ? (
              <ButtonLink href="/fleet" variant="secondary">
                Réinitialiser les filtres
              </ButtonLink>
            ) : (
              canManage && <ButtonLink href="/fleet/new">Ajouter un véhicule</ButtonLink>
            )
          }
        />
      ) : (
        <Table>
          <THead
            columns={[
              "Immatriculation",
              "Véhicule",
              "Catégorie",
              "Agence",
              { label: "Kilométrage", className: "text-right" },
              "Carburant",
              "Statut",
              "Alertes",
            ]}
          />
          <TBody>
            {rows.map(({ vehicle: v, category, branch, alerts }) => {
              const status = VEHICLE_STATUS[v.status];
              const danger = alerts.some((a) => a.severity === "danger");
              return (
                <tr key={v.id} className="hover:bg-border/20">
                  <Td className="whitespace-nowrap font-medium">
                    <Link href={`/fleet/${v.id}`} className="text-primary hover:underline">
                      {v.plate}
                    </Link>
                  </Td>
                  <Td>
                    {v.make} {v.model} <span className="text-muted">{v.trim} · {v.year}</span>
                  </Td>
                  <Td>{category?.name ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{branch?.name ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{v.mileage.toLocaleString("fr-FR")} km</Td>
                  <Td className="whitespace-nowrap">{fuelLabel(v.fuelLevel)}</Td>
                  <Td>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Td>
                  <Td>
                    {alerts.length > 0 ? (
                      <span title={alerts.map((a) => a.message).join("\n")}>
                        <Badge tone={danger ? "danger" : "warning"}>
                          {alerts.length} {alerts.length === 1 ? "alerte" : "alertes"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      )}
      {hasFilters && rows.length > 0 && (
        <p className="text-xs text-muted">
          {rows.length} {rows.length === 1 ? "véhicule affiché" : "véhicules affichés"} sur {all.length}.
        </p>
      )}
    </div>
  );
}
