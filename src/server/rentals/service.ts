import "server-only";
import { customerRisk } from "@/domain/customers/risk";
import type { FuelLevel } from "@/domain/fleet/types";
import { checkAvailability, BLOCKING_STATUSES } from "@/domain/rentals/availability";
import { quote, totals } from "@/domain/rentals/pricing";
import { returnCharges } from "@/domain/rentals/return-charges";
import type { Contract, Damage, DepositMethod, PriceLine } from "@/domain/rentals/types";
import { addDays, DAY, tunisDay } from "@/domain/shared/dates";
import { customerName, fail, scope, scopeAny, type Result } from "@/server/core";
import { newId, nextNumber } from "@/server/store";
import type { TenantData } from "@/server/store/types";
import type { TenantContext } from "@/server/tenancy/context";

export type ContractFilters = { status?: string; q?: string; period?: "aujourdhui" | "a_venir" | "en_retard" };

export function listContracts(ctx: TenantContext, filters: ContractFilters = {}) {
  const data = scope(ctx, "contracts.view");
  const now = new Date();
  const today = tunisDay(now);
  const q = filters.q?.trim().toLowerCase();

  return data.contracts
    .map((contract) => {
      const customer = data.customers.find((c) => c.id === contract.customerId)!;
      const vehicle = data.vehicles.find((v) => v.id === contract.vehicleId)!;
      return {
        contract,
        customer,
        customerName: customerName(customer),
        vehicle,
        pickupBranch: data.branches.find((b) => b.id === contract.pickupBranchId)!,
        returnBranch: data.branches.find((b) => b.id === contract.returnBranchId)!,
        overdue: contract.status === "en_cours" && new Date(contract.endAt) < now,
      };
    })
    .filter((r) => !filters.status || r.contract.status === filters.status)
    .filter((r) => {
      if (filters.period === "aujourdhui") {
        return tunisDay(r.contract.startAt) === today || tunisDay(r.contract.endAt) === today;
      }
      if (filters.period === "a_venir") return r.contract.status === "reservee" && new Date(r.contract.startAt) > now;
      if (filters.period === "en_retard") return r.overdue;
      return true;
    })
    .filter(
      (r) =>
        !q || `${r.contract.number} ${r.customerName} ${r.vehicle.plate} ${r.vehicle.make} ${r.vehicle.model}`.toLowerCase().includes(q),
    )
    .sort((a, b) => b.contract.startAt.localeCompare(a.contract.startAt));
}

/** Extra charges for a returned contract (km, lateness, fuel, damages), computed with current settings. */
export function contractReturnLines(data: TenantData, contract: Contract): PriceLine[] {
  if (!contract.checkout || !contract.checkin) return [];
  return returnCharges({
    rate: contract.rate,
    endAt: new Date(contract.endAt),
    checkout: contract.checkout,
    checkin: { ...contract.checkin, at: new Date(contract.checkin.at) },
    damages: contract.checkin.damages,
    fuelChargePerEighth: data.settings.fuelChargePerEighth,
    lateGraceMinutes: data.settings.lateGraceMinutes,
  });
}

export function getContractDetail(ctx: TenantContext, id: string) {
  const data = scope(ctx, "contracts.view");
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract) return null;
  const customer = data.customers.find((c) => c.id === contract.customerId)!;
  const vehicle = data.vehicles.find((v) => v.id === contract.vehicleId)!;
  const returnLines = contractReturnLines(data, contract);

  return {
    contract,
    customer,
    customerName: customerName(customer),
    risk: customerRisk(customer, data.contracts, data.invoices, new Date()),
    vehicle,
    category: data.categories.find((c) => c.id === vehicle.categoryId)!,
    pickupBranch: data.branches.find((b) => b.id === contract.pickupBranchId)!,
    returnBranch: data.branches.find((b) => b.id === contract.returnBranchId)!,
    extras: contract.extras.map((x) => ({ ...x, extra: data.extras.find((e) => e.id === x.extraId)! })),
    invoice: contract.invoiceId ? (data.invoices.find((i) => i.id === contract.invoiceId) ?? null) : null,
    returnLines,
    /** Final amounts if the contract were closed now (HT lines + TVA + timbre). */
    finalTotals: totals([...contract.rate.lines, ...returnLines], contract.rate.tvaBp, contract.rate.timbre),
    settings: data.settings,
    branches: data.branches,
  };
}

/** Everything the booking form needs. */
export function bookingReferenceData(ctx: TenantContext) {
  const data = scope(ctx, "contracts.manage");
  return {
    categories: data.categories,
    branches: data.branches,
    extras: data.extras.filter((e) => e.active),
    settings: data.settings,
  };
}

export type BookingWindow = { start: Date; end: Date; categoryId?: string; excludeContractId?: string };

export function availableVehicles(ctx: TenantContext, window: BookingWindow) {
  const data = scopeAny(ctx, ["contracts.manage", "fleet.view"]);
  const now = new Date();
  return data.vehicles
    .filter((v) => !window.categoryId || v.categoryId === window.categoryId)
    .filter(
      (vehicle) =>
        checkAvailability({
          vehicle,
          start: window.start,
          end: window.end,
          contracts: data.contracts,
          workOrders: data.workOrders,
          now,
          excludeContractId: window.excludeContractId,
        }).ok,
    )
    .map((vehicle) => ({ vehicle, category: data.categories.find((c) => c.id === vehicle.categoryId)! }))
    .sort((a, b) => a.category.dailyRate - b.category.dailyRate || a.vehicle.plate.localeCompare(b.vehicle.plate));
}

export type QuoteRequest = {
  vehicleId: string;
  start: Date;
  end: Date;
  extras: { extraId: string; quantity: number }[];
  discountBp: number;
};

export function quoteBooking(ctx: TenantContext, req: QuoteRequest) {
  const data = scope(ctx, "contracts.manage");
  const vehicle = data.vehicles.find((v) => v.id === req.vehicleId);
  if (!vehicle) return null;
  const category = data.categories.find((c) => c.id === vehicle.categoryId)!;
  return quote({
    category,
    start: req.start,
    end: req.end,
    seasons: data.seasons,
    extras: req.extras
      .map((x) => ({ extra: data.extras.find((e) => e.id === x.extraId && e.active)!, quantity: x.quantity }))
      .filter((x) => x.extra),
    discountBp: req.discountBp,
    tvaBp: data.settings.tvaBp,
    timbre: data.settings.timbre,
  });
}

export type ReservationInput = QuoteRequest & {
  customerId: string;
  pickupBranchId: string;
  returnBranchId: string;
  additionalDriver: string | null;
  depositMethod: DepositMethod;
  notes: string | null;
};

export const MAX_DISCOUNT_BP = { admin: 3000, other: 1000 };

/**
 * Creates a reservation. Availability check and insert run synchronously with no await in
 * between, so two concurrent bookings of the same car cannot both succeed.
 * (Supabase version: exclusion constraint on (vehicle_id, tstzrange) with btree_gist.)
 */
export function createReservation(ctx: TenantContext, input: ReservationInput): Result<{ id: string }> {
  const data = scope(ctx, "contracts.manage");
  const now = new Date();

  if (input.end <= input.start) return fail("La date de retour doit être postérieure à la date de départ.", "end");
  if (input.start.getTime() < now.getTime() - DAY) return fail("La date de départ est dans le passé.", "start");

  const maxDiscount = ctx.role === "admin" ? MAX_DISCOUNT_BP.admin : MAX_DISCOUNT_BP.other;
  if (input.discountBp < 0 || input.discountBp > maxDiscount) {
    return fail(`Remise maximale autorisée pour votre rôle : ${maxDiscount / 100} %.`, "discount");
  }

  const customer = data.customers.find((c) => c.id === input.customerId);
  if (!customer) return fail("Sélectionnez un client.", "customerId");
  if (customer.blacklisted) return fail(`Client sur liste noire : ${customer.blacklistReason ?? "réservation refusée"}.`, "customerId");
  if (customer.licenseExpiry && new Date(customer.licenseExpiry) < input.end) {
    return fail("Le permis de conduire du client expire avant la fin de la location.", "customerId");
  }
  if (!data.branches.some((b) => b.id === input.pickupBranchId)) return fail("Agence de départ inconnue.", "pickupBranchId");
  if (!data.branches.some((b) => b.id === input.returnBranchId)) return fail("Agence de retour inconnue.", "returnBranchId");

  const vehicle = data.vehicles.find((v) => v.id === input.vehicleId);
  if (!vehicle) return fail("Sélectionnez un véhicule.", "vehicleId");

  const availability = checkAvailability({
    vehicle,
    start: input.start,
    end: input.end,
    contracts: data.contracts,
    workOrders: data.workOrders,
    now,
  });
  if (!availability.ok) return fail(availability.message, "vehicleId");

  const rate = quoteBooking(ctx, input)!;
  const contract: Contract = {
    id: newId("ctr"),
    tenantId: ctx.tenant.id,
    number: nextNumber(data, "CT", now),
    customerId: customer.id,
    vehicleId: vehicle.id,
    pickupBranchId: input.pickupBranchId,
    returnBranchId: input.returnBranchId,
    startAt: input.start.toISOString(),
    endAt: input.end.toISOString(),
    status: "reservee",
    extras: input.extras.filter((x) => x.quantity > 0),
    additionalDriver: input.additionalDriver,
    rate,
    depositMethod: input.depositMethod,
    depositStatus: "en_attente",
    checkout: null,
    checkin: null,
    signature: null,
    invoiceId: null,
    notes: input.notes,
    cancelledReason: null,
    createdBy: ctx.user.name,
    createdAt: now.toISOString(),
  };
  data.contracts.push(contract);
  return { ok: true, id: contract.id };
}

export function cancelReservation(ctx: TenantContext, id: string, reason: string): Result {
  const data = scope(ctx, "contracts.manage");
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract) return fail("Contrat introuvable.");
  if (contract.status !== "reservee") return fail("Seule une réservation non démarrée peut être annulée.");
  contract.status = "annulee";
  contract.cancelledReason = reason.trim() || "Annulée";
  return { ok: true };
}

export type CheckoutInput = {
  km: number;
  fuelLevel: FuelLevel;
  notes: string | null;
  signatureName: string;
  signatureImage: string;
};

/** Hands the car over: records departure km/fuel (append-only log), signature, and blocks the deposit. */
export function checkoutContract(ctx: TenantContext, id: string, input: CheckoutInput): Result {
  const data = scope(ctx, "contracts.manage");
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract) return fail("Contrat introuvable.");
  if (contract.status !== "reservee") return fail("Ce contrat a déjà démarré ou est annulé.");
  const vehicle = data.vehicles.find((v) => v.id === contract.vehicleId)!;
  if (vehicle.status !== "disponible") {
    return fail(`Le véhicule n'est pas disponible (${vehicle.status === "loue" ? "encore en location" : "en entretien ou hors service"}).`);
  }
  if (new Date(contract.startAt).getTime() - Date.now() > DAY) {
    return fail("Le départ ne peut être enregistré plus de 24 h avant la date prévue.");
  }
  if (input.km < vehicle.mileage) {
    return fail(`Kilométrage inférieur au dernier relevé (${vehicle.mileage.toLocaleString("fr-FR")} km).`, "km");
  }
  if (!input.signatureImage.startsWith("data:image/")) return fail("La signature du client est requise.", "signature");

  const at = new Date().toISOString();
  contract.status = "en_cours";
  contract.depositStatus = "bloquee";
  contract.checkout = { at, km: input.km, fuelLevel: input.fuelLevel, notes: input.notes, recordedBy: ctx.user.name };
  contract.signature = { name: input.signatureName, image: input.signatureImage, at };
  vehicle.status = "loue";
  vehicle.mileage = input.km;
  vehicle.fuelLevel = input.fuelLevel;
  data.mileageLogs.push({
    id: newId("mil"),
    tenantId: ctx.tenant.id,
    vehicleId: vehicle.id,
    at,
    km: input.km,
    fuelLevel: input.fuelLevel,
    source: "depart",
    reference: contract.number,
    note: input.notes,
    recordedBy: ctx.user.name,
  });
  return { ok: true };
}

export type CheckinInput = {
  km: number;
  fuelLevel: FuelLevel;
  notes: string | null;
  damages: Damage[];
  returnBranchId: string;
};

/** Takes the car back: records km/fuel/damages; damaged cars go to the garage automatically. */
export function checkinContract(ctx: TenantContext, id: string, input: CheckinInput): Result {
  const data = scope(ctx, "contracts.manage");
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract || !contract.checkout) return fail("Contrat introuvable.");
  if (contract.status !== "en_cours") return fail("Ce contrat n'est pas en cours.");
  if (input.km < contract.checkout.km) {
    return fail(`Kilométrage inférieur au départ (${contract.checkout.km.toLocaleString("fr-FR")} km).`, "km");
  }
  if (!data.branches.some((b) => b.id === input.returnBranchId)) return fail("Agence de retour inconnue.", "returnBranchId");

  const vehicle = data.vehicles.find((v) => v.id === contract.vehicleId)!;
  const at = new Date().toISOString();
  contract.status = "retournee";
  contract.returnBranchId = input.returnBranchId;
  contract.checkin = { at, km: input.km, fuelLevel: input.fuelLevel, notes: input.notes, recordedBy: ctx.user.name, damages: input.damages };

  vehicle.mileage = input.km;
  vehicle.fuelLevel = input.fuelLevel;
  vehicle.branchId = input.returnBranchId;
  vehicle.status = "disponible";
  data.mileageLogs.push({
    id: newId("mil"),
    tenantId: ctx.tenant.id,
    vehicleId: vehicle.id,
    at,
    km: input.km,
    fuelLevel: input.fuelLevel,
    source: "retour",
    reference: contract.number,
    note: input.notes,
    recordedBy: ctx.user.name,
  });

  if (input.damages.length > 0) {
    vehicle.status = "maintenance";
    data.workOrders.push({
      id: newId("wo"),
      tenantId: ctx.tenant.id,
      number: nextNumber(data, "OT"),
      vehicleId: vehicle.id,
      type: "carrosserie",
      description: input.damages.map((d) => d.description).join(" ; "),
      status: "ouvert",
      immobilizing: true,
      vendor: "À définir",
      openedAt: at,
      closedAt: null,
      kmAtOpen: input.km,
      partsCost: 0,
      laborCost: 0,
      contractId: contract.id,
      notes: `Dommages constatés au retour du contrat ${contract.number}.`,
    });
  }
  // A crossed service threshold surfaces as a fleet alert; the fleet manager opens the work order.
  return { ok: true };
}

/** Closes a returned contract: issues the invoice (frozen rate + return charges) and settles the deposit. */
export function closeContract(
  ctx: TenantContext,
  id: string,
  input: { depositStatus: "restituee" | "retenue" },
): Result<{ invoiceId: string }> {
  const data = scope(ctx, "contracts.manage");
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract) return fail("Contrat introuvable.");
  if (contract.status !== "retournee") return fail("Le véhicule doit être restitué avant la clôture.");
  if (contract.invoiceId) return fail("Ce contrat est déjà facturé.");

  const now = new Date();
  const lines = [...contract.rate.lines, ...contractReturnLines(data, contract)];
  const t = totals(lines, contract.rate.tvaBp, contract.rate.timbre);
  const invoice = {
    id: newId("inv"),
    tenantId: ctx.tenant.id,
    number: nextNumber(data, "FA", now),
    customerId: contract.customerId,
    contractId: contract.id,
    issuedAt: now.toISOString(),
    dueAt: addDays(now, data.settings.paymentTermDays).toISOString(),
    lines,
    tvaBp: contract.rate.tvaBp,
    timbre: contract.rate.timbre,
    ...t,
    payments: [],
    status: "emise" as const,
  };
  data.invoices.push(invoice);
  contract.invoiceId = invoice.id;
  contract.status = "cloturee";
  contract.depositStatus = input.depositStatus;
  return { ok: true, invoiceId: invoice.id };
}

export type PlanningRow = {
  vehicle: TenantData["vehicles"][number];
  categoryCode: string;
  bookings: {
    id: string;
    number: string;
    status: Contract["status"];
    customerName: string;
    startAt: string;
    endAt: string;
  }[];
  maintenance: { id: string; number: string; openedAt: string }[];
};

export function planning(ctx: TenantContext, from: Date, days: number): PlanningRow[] {
  const data = scope(ctx, "contracts.view");
  const to = addDays(from, days);
  return data.vehicles
    .filter((v) => v.status !== "hors_service")
    .map((vehicle) => ({
      vehicle,
      categoryCode: data.categories.find((c) => c.id === vehicle.categoryId)!.code,
      bookings: data.contracts
        .filter(
          (c) =>
            c.vehicleId === vehicle.id &&
            (BLOCKING_STATUSES.has(c.status) || c.status === "retournee" || c.status === "cloturee") &&
            new Date(c.startAt) < to &&
            new Date(c.checkin?.at ?? c.endAt) > from,
        )
        .map((c) => {
          const customer = data.customers.find((x) => x.id === c.customerId)!;
          return {
            id: c.id,
            number: c.number,
            status: c.status,
            customerName: customerName(customer),
            startAt: c.checkout?.at ?? c.startAt,
            endAt: c.checkin?.at ?? c.endAt,
          };
        }),
      maintenance: data.workOrders
        .filter((w) => w.vehicleId === vehicle.id && w.immobilizing && w.status !== "termine")
        .map((w) => ({ id: w.id, number: w.number, openedAt: w.openedAt })),
    }))
    .sort((a, b) => a.categoryCode.localeCompare(b.categoryCode) || a.vehicle.plate.localeCompare(b.vehicle.plate));
}
