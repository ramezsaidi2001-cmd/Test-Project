import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { formatTndPlain } from "@/domain/shared/money";
import { toDateInput } from "@/domain/shared/dates";
import { getVehicleDetail, listFleetReferenceData } from "@/server/fleet/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { updateVehicleAction } from "../../actions";
import { VehicleForm } from "../../vehicle-form";

export const metadata: Metadata = { title: "Modifier le véhicule" };

export default async function EditVehiclePage({ params }: PageProps<"/fleet/[id]/edit">) {
  const { id } = await params;
  const ctx = await requirePagePermission("fleet.manage");
  const detail = getVehicleDetail(ctx, id);
  if (!detail) notFound();
  const { categories, branches } = listFleetReferenceData(ctx);
  const v = detail.vehicle;

  const defaults: Record<string, string> = {
    plate: v.plate,
    vin: v.vin,
    make: v.make,
    model: v.model,
    trim: v.trim,
    year: String(v.year),
    color: v.color,
    categoryId: v.categoryId,
    fuel: v.fuel,
    transmission: v.transmission,
    seats: String(v.seats),
    branchId: v.branchId,
    mileageLabel: `${v.mileage.toLocaleString("fr-FR")} km`,
    serviceIntervalKm: String(v.serviceIntervalKm),
    nextServiceKm: String(v.nextServiceKm),
    acquisitionDate: toDateInput(v.acquisitionDate),
    acquisitionCost: formatTndPlain(v.acquisitionCost),
    gpsDeviceId: v.gpsDeviceId ?? "",
    registrationNumber: v.documents.registrationNumber,
    insurer: v.documents.insurer,
    insuranceExpiry: toDateInput(v.documents.insuranceExpiry),
    technicalInspectionExpiry: toDateInput(v.documents.technicalInspectionExpiry),
    vignetteExpiry: toDateInput(v.documents.vignetteExpiry),
  };

  return (
    <div>
      <PageHeader
        title={`Modifier ${v.plate}`}
        description={`${v.make} ${v.model} ${v.trim} ${v.year}`}
        back={{ href: `/fleet/${v.id}`, label: "Fiche véhicule" }}
      />
      <VehicleForm
        mode="edit"
        action={updateVehicleAction.bind(null, v.id)}
        defaults={defaults}
        categories={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        branches={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.city})` }))}
        cancelHref={`/fleet/${v.id}`}
      />
    </div>
  );
}
