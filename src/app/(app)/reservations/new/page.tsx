import type { Metadata } from "next";
import { Alert, Button, Card, EmptyState, Field, PageHeader, SelectField } from "@/components/ui";
import { addDays, parseLocalDateTime, toLocalInput, tunisDay } from "@/domain/shared/dates";
import { customerOptions } from "@/server/customers/service";
import { availableVehicles, bookingReferenceData, MAX_DISCOUNT_BP } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Nouvelle réservation" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewReservationPage({ searchParams }: PageProps<"/reservations/new">) {
  const ctx = await requirePagePermission("contracts.manage");
  const sp = await searchParams;
  const ref = bookingReferenceData(ctx);

  const tomorrow = tunisDay(addDays(new Date(), 1));
  const defaultStart = `${tomorrow}T10:00`;
  const defaultEnd = toLocalInput(addDays(parseLocalDateTime(defaultStart)!, 3));

  const startRaw = one(sp.start);
  const endRaw = one(sp.end);
  const categoryId = ref.categories.some((c) => c.id === one(sp.categoryId)) ? one(sp.categoryId) : "";
  const pickupBranchId = ref.branches.some((b) => b.id === one(sp.pickupBranchId)) ? one(sp.pickupBranchId) : ref.branches[0]?.id ?? "";
  const returnBranchId = ref.branches.some((b) => b.id === one(sp.returnBranchId)) ? one(sp.returnBranchId) : pickupBranchId;
  const customerId = one(sp.customerId);
  const vehicleId = one(sp.vehicleId);

  const searched = Boolean(startRaw && endRaw);
  const start = parseLocalDateTime(startRaw);
  const end = parseLocalDateTime(endRaw);
  let windowError: string | null = null;
  if (searched) {
    if (!start || !end) windowError = "Dates invalides.";
    else if (end <= start) windowError = "La date de retour doit être postérieure à la date de départ.";
  }
  const vehicles = searched && !windowError && start && end ? availableVehicles(ctx, { start, end, categoryId: categoryId || undefined }) : [];
  const branchOptions = ref.branches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Nouvelle réservation"
        description="1. Choisissez la période et l'agence · 2. Sélectionnez le véhicule, le client et les options."
        back={{ href: "/reservations", label: "Réservations" }}
      />

      <Card title="1. Période et agences">
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          {customerId && <input type="hidden" name="customerId" value={customerId} />}
          {vehicleId && <input type="hidden" name="vehicleId" value={vehicleId} />}
          <Field label="Départ" name="start" type="datetime-local" required defaultValue={startRaw || defaultStart} wrapperClassName="lg:col-span-1" />
          <Field label="Retour" name="end" type="datetime-local" required defaultValue={endRaw || defaultEnd} wrapperClassName="lg:col-span-1" />
          <SelectField
            label="Catégorie"
            name="categoryId"
            defaultValue={categoryId}
            placeholder="Toutes"
            options={ref.categories.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
          />
          <SelectField label="Agence de départ" name="pickupBranchId" defaultValue={pickupBranchId} options={branchOptions} />
          <SelectField label="Agence de retour" name="returnBranchId" defaultValue={returnBranchId} options={branchOptions} />
          <Button type="submit">{searched ? "Mettre à jour" : "Voir les disponibilités"}</Button>
        </form>
      </Card>

      {windowError && <Alert tone="error">{windowError}</Alert>}

      {searched && !windowError && start && end && (
        vehicles.length === 0 ? (
          <EmptyState
            title="Aucun véhicule disponible"
            description="Aucun véhicule n'est libre sur cette période. Essayez d'autres dates ou une autre catégorie."
          />
        ) : (
          <BookingForm
            key={`${startRaw}|${endRaw}|${categoryId}`}
            start={startRaw}
            end={endRaw}
            pickupBranchId={pickupBranchId}
            returnBranchId={returnBranchId}
            vehicles={vehicles.map(({ vehicle, category }) => ({
              id: vehicle.id,
              plate: vehicle.plate,
              label: `${vehicle.make} ${vehicle.model}`,
              details: `${vehicle.year} · ${vehicle.transmission === "automatique" ? "Automatique" : "Manuelle"} · ${vehicle.seats} places`,
              category: `${category.code} · ${category.name}`,
              dailyRate: category.dailyRate,
            }))}
            customers={customerOptions(ctx)}
            initialCustomerId={customerId}
            initialVehicleId={vehicleId}
            extras={ref.extras.map((e) => ({ id: e.id, name: e.name, price: e.price, pricing: e.pricing }))}
            maxDiscountPercent={(ctx.role === "admin" ? MAX_DISCOUNT_BP.admin : MAX_DISCOUNT_BP.other) / 100}
          />
        )
      )}
    </div>
  );
}
