// Unit tests for pure business rules. Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Invoice } from "./billing/types";
import { customerRisk } from "./customers/risk";
import type { Customer } from "./customers/types";
import { vehicleAlerts } from "./fleet/alerts";
import type { Vehicle, VehicleCategory } from "./fleet/types";
import type { WorkOrder } from "./maintenance/types";
import { checkAvailability } from "./rentals/availability";
import { billableDays, quote } from "./rentals/pricing";
import { returnCharges } from "./rentals/return-charges";
import type { Contract, RentalExtra, SeasonalRate } from "./rentals/types";
import { addDays, HOUR } from "./shared/dates";
import { applyRate, dt, formatTnd, parseTnd } from "./shared/money";

const category: VehicleCategory = {
  id: "cat",
  code: "CMP",
  name: "Compacte",
  dailyRate: dt(100),
  weeklyDailyRate: dt(85),
  deposit: dt(1000),
  kmPerDay: 250,
  extraKmRate: dt(0.35),
};
const summer: SeasonalRate = { id: "s", name: "Haute saison", startDate: "2026-07-01", endDate: "2026-08-31", adjustmentBp: 3000 };
const cdw: RentalExtra = { id: "cdw", name: "CDW", pricing: "par_jour", price: dt(25), active: true };
const delivery: RentalExtra = { id: "del", name: "Livraison", pricing: "forfait", price: dt(40), active: true };
const at = (s: string) => new Date(`${s}+01:00`);

test("money: parse and format Tunisian dinars with millimes", () => {
  assert.equal(parseTnd("1 234,500"), 1234500);
  assert.equal(parseTnd("85.5"), 85500);
  assert.equal(parseTnd("85,1234"), null);
  assert.equal(parseTnd("abc"), null);
  assert.equal(formatTnd(1234500).replace(/\s/g, " "), "1 234,500 DT");
  assert.equal(applyRate(dt(100), 1900), dt(19));
});

test("billable days: started 24h periods with a 59-minute grace, minimum one day", () => {
  assert.equal(billableDays(at("2026-05-01T10:00"), at("2026-05-01T12:00")), 1);
  assert.equal(billableDays(at("2026-05-01T10:00"), at("2026-05-04T10:00")), 3);
  assert.equal(billableDays(at("2026-05-01T10:00"), at("2026-05-04T10:59")), 3);
  assert.equal(billableDays(at("2026-05-01T10:00"), at("2026-05-04T11:01")), 4);
});

test("quote: TVA 19 % and 1 DT timbre fiscal on top of HT lines", () => {
  const q = quote({ category, start: at("2026-05-01T10:00"), end: at("2026-05-04T10:00"), seasons: [], extras: [], tvaBp: 1900, timbre: dt(1) });
  assert.equal(q.days, 3);
  assert.equal(q.subtotal, dt(300));
  assert.equal(q.tva, dt(57));
  assert.equal(q.total, dt(358));
});

test("quote: weekly rate from 7 days, seasonal surcharge only on days inside the season", () => {
  // 28 June → 5 July: 7 days, of which 1–4 July (4 days) fall in summer.
  const q = quote({ category, start: at("2026-06-28T10:00"), end: at("2026-07-05T10:00"), seasons: [summer], extras: [], tvaBp: 1900, timbre: dt(1) });
  assert.equal(q.dailyRate, dt(85));
  const season = q.lines.find((l) => l.kind === "saison")!;
  assert.equal(season.quantity, 5 - 1); // 1, 2, 3, 4 July
  assert.equal(season.unitPrice, dt(25.5)); // +30 % of 85
  assert.equal(q.subtotal, dt(85 * 7 + 25.5 * 4));
});

test("quote: per-day and flat extras, commercial discount", () => {
  const q = quote({
    category,
    start: at("2026-05-01T10:00"),
    end: at("2026-05-03T10:00"),
    seasons: [],
    extras: [{ extra: cdw, quantity: 1 }, { extra: delivery, quantity: 1 }],
    discountBp: 1000,
    tvaBp: 1900,
    timbre: dt(1),
  });
  // 2 × 100 + 2 × 25 + 40 = 290, −10 % = 261
  assert.equal(q.subtotal, dt(261));
});

test("return charges: extra km, late return, missing fuel and damages", () => {
  const rate = quote({ category, start: at("2026-05-01T10:00"), end: at("2026-05-03T10:00"), seasons: [], extras: [], tvaBp: 1900, timbre: dt(1) });
  const lines = returnCharges({
    rate,
    endAt: at("2026-05-03T10:00"),
    checkout: { km: 10000, fuelLevel: 8 },
    checkin: { at: at("2026-05-03T13:00"), km: 10600, fuelLevel: 6 },
    damages: [{ description: "Rayure", cost: dt(150) }],
    fuelChargePerEighth: dt(12),
    lateGraceMinutes: 60,
  });
  const byKind = Object.fromEntries(lines.map((l) => [l.kind, l]));
  assert.equal(byKind.km_sup.quantity, 100); // 600 driven − 500 included
  assert.equal(byKind.km_sup.total, dt(35));
  assert.equal(byKind.retard.quantity, 1);
  assert.equal(byKind.retard.total, dt(100));
  assert.equal(byKind.carburant.total, dt(24));
  assert.equal(byKind.dommage.total, dt(150));
});

test("return charges: on-time, full tank, within km → nothing to add; km going backwards is rejected", () => {
  const rate = quote({ category, start: at("2026-05-01T10:00"), end: at("2026-05-03T10:00"), seasons: [], extras: [], tvaBp: 1900, timbre: dt(1) });
  const base = { rate, endAt: at("2026-05-03T10:00"), checkout: { km: 1000, fuelLevel: 8 as const }, damages: [], fuelChargePerEighth: dt(12), lateGraceMinutes: 60 };
  assert.deepEqual(returnCharges({ ...base, checkin: { at: at("2026-05-03T10:45"), km: 1400, fuelLevel: 8 } }), []);
  assert.throws(() => returnCharges({ ...base, checkin: { at: at("2026-05-03T10:00"), km: 900, fuelLevel: 8 } }));
});

const vehicle = { id: "v1", status: "disponible" } as Vehicle;
const contract = (over: Partial<Contract>): Contract =>
  ({ id: "c1", number: "CT-1", vehicleId: "v1", status: "reservee", startAt: at("2026-05-10T10:00").toISOString(), endAt: at("2026-05-15T10:00").toISOString(), ...over }) as Contract;

test("availability: overlapping bookings conflict, back-to-back bookings do not", () => {
  const now = at("2026-05-01T10:00");
  const contracts = [contract({})];
  const check = (s: string, e: string) => checkAvailability({ vehicle, start: at(s), end: at(e), contracts, workOrders: [], now });
  assert.equal(check("2026-05-12T10:00", "2026-05-13T10:00").ok, false);
  assert.equal(check("2026-05-05T10:00", "2026-05-10T10:00").ok, true);
  assert.equal(check("2026-05-15T10:00", "2026-05-18T10:00").ok, true);
  const cancelled = checkAvailability({ vehicle, start: at("2026-05-12T10:00"), end: at("2026-05-13T10:00"), contracts: [contract({ status: "annulee" })], workOrders: [], now });
  assert.equal(cancelled.ok, true);
});

test("availability: an overdue active rental keeps blocking the car until it is returned", () => {
  const now = at("2026-05-20T10:00");
  const res = checkAvailability({ vehicle, start: at("2026-05-20T12:00"), end: at("2026-05-22T12:00"), contracts: [contract({ status: "en_cours" })], workOrders: [], now });
  assert.equal(res.ok, false);
});

test("availability: out-of-service and immobilized vehicles cannot be booked", () => {
  const now = at("2026-05-01T10:00");
  const window = { start: at("2026-06-01T10:00"), end: at("2026-06-02T10:00"), contracts: [], now };
  assert.equal(checkAvailability({ ...window, vehicle: { ...vehicle, status: "hors_service" }, workOrders: [] }).ok, false);
  const wo = { vehicleId: "v1", immobilizing: true, status: "en_cours" } as WorkOrder;
  assert.equal(checkAvailability({ ...window, vehicle, workOrders: [wo] }).ok, false);
});

test("customer risk: blacklist, late returns, overdue invoices, young license", () => {
  const now = at("2026-06-01T10:00");
  const customer = { id: "cu", blacklisted: false, licenseIssueDate: addDays(now, -300).toISOString(), licenseExpiry: null } as unknown as Customer;
  const late = contract({
    customerId: "cu",
    status: "cloturee",
    endAt: at("2026-05-15T10:00").toISOString(),
    checkin: { at: at("2026-05-15T15:00").toISOString(), km: 0, fuelLevel: 8, notes: null, recordedBy: "", damages: [] },
  });
  const unpaid = { customerId: "cu", status: "emise", total: dt(300), payments: [], dueAt: addDays(now, -3).toISOString() } as unknown as Invoice;

  const r1 = customerRisk(customer, [late], [], now);
  assert.equal(r1.level, "moyen");
  assert.equal(r1.lateReturns, 1);
  assert.ok(r1.flags.some((f) => f.includes("moins de 2 ans")));

  assert.equal(customerRisk(customer, [late], [unpaid], now).level, "eleve");
  assert.equal(customerRisk({ ...customer, blacklisted: true }, [], [], now).level, "bloque");
});

test("fleet alerts: expired documents are danger, soon-to-expire are warning, service due by km", () => {
  const now = at("2026-06-01T10:00");
  const v = {
    id: "v",
    status: "disponible",
    mileage: 19500,
    nextServiceKm: 20000,
    documents: {
      insuranceExpiry: addDays(now, -2).toISOString(),
      technicalInspectionExpiry: addDays(now, 10).toISOString(),
      vignetteExpiry: addDays(now, 200).toISOString(),
    },
  } as unknown as Vehicle;
  const alerts = vehicleAlerts(v, now);
  assert.equal(alerts.find((a) => a.kind === "assurance")?.severity, "danger");
  assert.equal(alerts.find((a) => a.kind === "visite_technique")?.severity, "warning");
  assert.equal(alerts.find((a) => a.kind === "vignette"), undefined);
  assert.equal(alerts.find((a) => a.kind === "entretien")?.severity, "warning");
  void HOUR;
});
