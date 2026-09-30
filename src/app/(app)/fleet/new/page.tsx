import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { listFleetReferenceData } from "@/server/fleet/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { createVehicleAction } from "../actions";
import { VehicleForm } from "../vehicle-form";

export const metadata: Metadata = { title: "Ajouter un véhicule" };

export default async function NewVehiclePage() {
  const ctx = await requirePagePermission("fleet.manage");
  const { categories, branches } = listFleetReferenceData(ctx);

  return (
    <div>
      <PageHeader
        title="Ajouter un véhicule"
        description="Le véhicule sera disponible à la location dès son enregistrement."
        back={{ href: "/fleet", label: "Flotte" }}
      />
      <VehicleForm
        mode="create"
        action={createVehicleAction}
        defaults={{ year: String(new Date().getFullYear()), mileage: "0" }}
        categories={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        branches={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.city})` }))}
        cancelHref="/fleet"
      />
    </div>
  );
}
