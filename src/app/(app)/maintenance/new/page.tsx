import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { VEHICLE_STATUS, WORK_ORDER_TYPE } from "@/domain/labels";
import { listVehicles } from "@/server/fleet/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { WorkOrderForm } from "./work-order-form";

export const metadata: Metadata = { title: "Nouvel ordre de travail" };

export default async function NewWorkOrderPage({ searchParams }: PageProps<"/maintenance/new">) {
  const ctx = await requirePagePermission("maintenance.manage");
  const sp = await searchParams;
  const vehicleId = typeof sp.vehicleId === "string" ? sp.vehicleId : "";
  const type = typeof sp.type === "string" && sp.type in WORK_ORDER_TYPE ? sp.type : "";

  const vehicles = listVehicles(ctx).map(({ vehicle: v }) => ({
    value: v.id,
    label: `${v.plate} — ${v.make} ${v.model}${v.status !== "disponible" ? ` (${VEHICLE_STATUS[v.status].label})` : ""}`,
  }));
  const known = vehicles.some((o) => o.value === vehicleId);

  return (
    <div>
      <PageHeader
        title="Nouvel ordre de travail"
        description="Entretien, réparation, carrosserie, pneumatiques ou visite technique."
        back={known ? { href: `/fleet/${vehicleId}`, label: "Fiche véhicule" } : { href: "/maintenance", label: "Entretien" }}
      />
      <WorkOrderForm
        vehicles={vehicles}
        defaultVehicleId={known ? vehicleId : ""}
        defaultType={type}
        cancelHref={known ? `/fleet/${vehicleId}` : "/maintenance"}
      />
    </div>
  );
}
