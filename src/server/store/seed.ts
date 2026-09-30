import type { Invoice, PaymentMethod } from "@/domain/billing/types";
import type { Customer } from "@/domain/customers/types";
import type { Branch, FuelLevel, MileageLog, Vehicle, VehicleCategory } from "@/domain/fleet/types";
import type { WorkOrder } from "@/domain/maintenance/types";
import { quote, totals } from "@/domain/rentals/pricing";
import { returnCharges } from "@/domain/rentals/return-charges";
import type { Contract, Damage, RentalExtra, SeasonalRate } from "@/domain/rentals/types";
import type { AgencySettings } from "@/domain/settings/types";
import { addDays, DAY, HOUR, tunisDay } from "@/domain/shared/dates";
import { dt } from "@/domain/shared/money";
import type { DemoUser, TenantData } from "./types";

/** Deterministic PRNG so the demo data is stable between restarts. */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

const iso = (d: Date) => d.toISOString();
/** Snap to a round hour (Tunis time is UTC+1, business hours 8h–19h). */
function atHour(day: Date, hour: number) {
  const d = new Date(`${tunisDay(day)}T${String(hour).padStart(2, "0")}:00:00+01:00`);
  return d;
}

export function seedTenant(tenantId: string, now: Date, tenantName?: string): TenantData {
  const r = rng(20260928);
  const counters: Record<string, number> = {};
  const number = (prefix: string, at: Date) => {
    const key = `${prefix}-${at.getFullYear()}`;
    counters[key] = (counters[key] ?? 0) + 1;
    return `${key}-${String(counters[key]).padStart(4, "0")}`;
  };
  let idSeq = 0;
  const id = (prefix: string) => `${prefix}_${(++idSeq).toString(36).padStart(6, "0")}`;

  const tradeName = tenantName ?? "Carthage Rent Car";
  const settings: AgencySettings = {
    tenantId,
    tradeName,
    legalName: `${tradeName} SARL`,
    taxId: "1587423/B/A/M/000",
    rne: "B01234522021",
    address: "45, avenue Habib Bourguiba",
    city: "1000 Tunis",
    phone: "+216 71 234 567",
    email: "contact@carthage-rent.tn",
    tvaBp: 1900,
    timbre: dt(1),
    fuelChargePerEighth: dt(12),
    lateGraceMinutes: 60,
    paymentTermDays: 15,
    contractTerms: [
      "1. Le locataire doit être âgé d'au moins 21 ans et titulaire d'un permis de conduire valide depuis plus de 2 ans.",
      "2. Le véhicule est remis avec le plein et doit être restitué avec le même niveau de carburant ; à défaut, le carburant manquant est facturé.",
      "3. Tout retard de restitution au-delà de 60 minutes entraîne la facturation d'une journée supplémentaire.",
      "4. Le kilométrage inclus est indiqué au contrat ; les kilomètres supplémentaires sont facturés au tarif en vigueur.",
      "5. En cas d'accident, le locataire doit établir un constat amiable et prévenir l'agence sous 24 heures.",
      "6. La franchise reste à la charge du locataire sauf souscription du rachat de franchise (CDW).",
      "7. La sortie du territoire tunisien est strictement interdite sans accord écrit de l'agence.",
    ].join("\n"),
    invoiceFooter: "RIB : 08 006 0001234567890 12 — BIAT Agence Habib Bourguiba · Paiement à 15 jours",
  };

  const users: DemoUser[] = [
    { id: "demo-admin", name: "Sami Ben Amor", email: "admin@demo.fleetly.tn", role: "admin", joinedAt: iso(addDays(now, -400)) },
    { id: "demo-fleet_manager", name: "Nadia Jaziri", email: "flotte@demo.fleetly.tn", role: "fleet_manager", joinedAt: iso(addDays(now, -320)) },
    { id: "demo-desk_agent", name: "Omar Toumi", email: "comptoir@demo.fleetly.tn", role: "desk_agent", joinedAt: iso(addDays(now, -210)) },
    { id: "demo-accountant", name: "Hela Mabrouk", email: "compta@demo.fleetly.tn", role: "accountant", joinedAt: iso(addDays(now, -150)) },
  ];

  const branches: Branch[] = [
    { id: "br_tunis", name: "Tunis Centre", city: "Tunis", kind: "agence", address: "45, avenue Habib Bourguiba, 1000 Tunis", phone: "+216 71 234 567" },
    { id: "br_tun", name: "Aéroport Tunis-Carthage", city: "Tunis", kind: "aeroport", address: "Hall arrivées, Aéroport Tunis-Carthage, 1080", phone: "+216 71 754 000" },
    { id: "br_nbe", name: "Aéroport Enfidha-Hammamet", city: "Enfidha", kind: "aeroport", address: "Hall arrivées, Aéroport Enfidha-Hammamet, 4030", phone: "+216 73 103 000" },
    { id: "br_sousse", name: "Sousse", city: "Sousse", kind: "agence", address: "Boulevard du 14 Janvier, 4000 Sousse", phone: "+216 73 226 400" },
    { id: "br_djerba", name: "Djerba", city: "Djerba", kind: "agence", address: "Route de l'aéroport, Houmt Souk, 4180 Djerba", phone: "+216 75 650 300" },
  ];

  const categories: VehicleCategory[] = [
    { id: "cat_eco", code: "ECO", name: "Économique", dailyRate: dt(75), weeklyDailyRate: dt(65), deposit: dt(800), kmPerDay: 250, extraKmRate: dt(0.3) },
    { id: "cat_cmp", code: "CMP", name: "Compacte", dailyRate: dt(95), weeklyDailyRate: dt(84), deposit: dt(1000), kmPerDay: 250, extraKmRate: dt(0.35) },
    { id: "cat_ber", code: "BER", name: "Berline", dailyRate: dt(110), weeklyDailyRate: dt(96), deposit: dt(1200), kmPerDay: 300, extraKmRate: dt(0.4) },
    { id: "cat_suv", code: "SUV", name: "SUV", dailyRate: dt(170), weeklyDailyRate: dt(150), deposit: dt(2000), kmPerDay: 300, extraKmRate: dt(0.5) },
    { id: "cat_prm", code: "PRM", name: "Premium", dailyRate: dt(290), weeklyDailyRate: dt(260), deposit: dt(3500), kmPerDay: null, extraKmRate: dt(0) },
    { id: "cat_utl", code: "UTL", name: "Utilitaire", dailyRate: dt(125), weeklyDailyRate: dt(110), deposit: dt(1500), kmPerDay: 200, extraKmRate: dt(0.45) },
  ];

  const year = now.getFullYear();
  const seasons: SeasonalRate[] = [year - 1, year, year + 1].flatMap((y) => [
    { id: `ss_ete_${y}`, name: `Haute saison été ${y}`, startDate: `${y}-07-01`, endDate: `${y}-08-31`, adjustmentBp: 3500 },
    { id: `ss_fetes_${y}`, name: `Fêtes de fin d'année ${y}`, startDate: `${y}-12-20`, endDate: `${y + 1}-01-03`, adjustmentBp: 2000 },
    { id: `ss_basse_${y}`, name: `Basse saison ${y}`, startDate: `${y}-11-15`, endDate: `${y}-12-15`, adjustmentBp: -1000 },
  ]);

  const extras: RentalExtra[] = [
    { id: "ex_cdw", name: "Rachat de franchise (CDW)", pricing: "par_jour", price: dt(25), active: true },
    { id: "ex_driver", name: "Conducteur additionnel", pricing: "par_jour", price: dt(15), active: true },
    { id: "ex_baby", name: "Siège bébé", pricing: "par_jour", price: dt(8), active: true },
    { id: "ex_gps", name: "GPS", pricing: "par_jour", price: dt(10), active: true },
    { id: "ex_delivery", name: "Livraison aéroport / hôtel", pricing: "forfait", price: dt(40), active: true },
  ];

  // --- Vehicles -------------------------------------------------------------
  const models: Record<string, { make: string; model: string; fuel: Vehicle["fuel"]; transmission: Vehicle["transmission"]; seats: number; cost: number }[]> = {
    cat_eco: [
      { make: "Kia", model: "Picanto", fuel: "essence", transmission: "manuelle", seats: 4, cost: 42000 },
      { make: "Hyundai", model: "Grand i10", fuel: "essence", transmission: "manuelle", seats: 5, cost: 45000 },
      { make: "Suzuki", model: "Swift", fuel: "essence", transmission: "manuelle", seats: 5, cost: 49000 },
    ],
    cat_cmp: [
      { make: "Renault", model: "Clio 5", fuel: "essence", transmission: "manuelle", seats: 5, cost: 62000 },
      { make: "Peugeot", model: "208", fuel: "essence", transmission: "manuelle", seats: 5, cost: 65000 },
      { make: "Volkswagen", model: "Polo", fuel: "essence", transmission: "automatique", seats: 5, cost: 72000 },
      { make: "Seat", model: "Ibiza", fuel: "essence", transmission: "manuelle", seats: 5, cost: 64000 },
    ],
    cat_ber: [
      { make: "Peugeot", model: "301", fuel: "diesel", transmission: "manuelle", seats: 5, cost: 68000 },
      { make: "Citroën", model: "C-Elysée", fuel: "diesel", transmission: "manuelle", seats: 5, cost: 66000 },
      { make: "Dacia", model: "Logan", fuel: "essence", transmission: "manuelle", seats: 5, cost: 52000 },
    ],
    cat_suv: [
      { make: "Dacia", model: "Duster", fuel: "diesel", transmission: "manuelle", seats: 5, cost: 85000 },
      { make: "Hyundai", model: "Tucson", fuel: "diesel", transmission: "automatique", seats: 5, cost: 135000 },
      { make: "Kia", model: "Sportage", fuel: "hybride", transmission: "automatique", seats: 5, cost: 145000 },
    ],
    cat_prm: [
      { make: "Mercedes-Benz", model: "Classe C", fuel: "diesel", transmission: "automatique", seats: 5, cost: 240000 },
      { make: "Volkswagen", model: "Passat", fuel: "diesel", transmission: "automatique", seats: 5, cost: 165000 },
    ],
    cat_utl: [
      { make: "Renault", model: "Kangoo", fuel: "diesel", transmission: "manuelle", seats: 2, cost: 70000 },
      { make: "Peugeot", model: "Partner", fuel: "diesel", transmission: "manuelle", seats: 3, cost: 72000 },
    ],
  };
  const plan: [string, number][] = [["cat_eco", 7], ["cat_cmp", 8], ["cat_ber", 6], ["cat_suv", 5], ["cat_prm", 2], ["cat_utl", 2]];
  const colors = ["Blanc", "Gris argent", "Noir", "Bleu", "Rouge", "Gris foncé"];
  const insurers = ["STAR Assurances", "GAT Assurances", "COMAR", "Assurances BIAT", "Lloyd Tunisien"];
  const vinChars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

  const vehicles: Vehicle[] = [];
  let plateSeq = 0;
  for (const [categoryId, count] of plan) {
    for (let i = 0; i < count; i++) {
      const m = models[categoryId][i % models[categoryId].length];
      const vYear = r.int(year - 4, year);
      const acquired = addDays(now, -r.int(200, 1200));
      const serie = 215 + Math.floor(plateSeq / 3) + r.int(0, 2);
      plateSeq++;
      const startKm = r.int(4000, 60000);
      const vin = Array.from({ length: 17 }, () => r.pick(vinChars.split(""))).join("");
      vehicles.push({
        id: id("veh"),
        tenantId,
        plate: `${serie} TU ${String(r.int(1000, 9999))}`,
        vin,
        make: m.make,
        model: m.model,
        trim: r.pick(["Life", "Active", "Allure", "Confort", "Style", "Business"]),
        year: vYear,
        color: r.pick(colors),
        categoryId,
        fuel: m.fuel,
        transmission: m.transmission,
        seats: m.seats,
        status: "disponible",
        branchId: r.pick(branches).id,
        mileage: startKm,
        fuelLevel: 8,
        serviceIntervalKm: 10000,
        nextServiceKm: Math.ceil((startKm + 1) / 10000) * 10000,
        acquisitionDate: iso(acquired),
        acquisitionCost: dt(m.cost),
        gpsDeviceId: r.chance(0.6) ? `GPS-${r.int(100000, 999999)}` : null,
        documents: {
          registrationNumber: `CG-${serie}-${r.int(100000, 999999)}`,
          insurer: r.pick(insurers),
          insuranceExpiry: iso(addDays(now, r.int(-5, 330))),
          technicalInspectionExpiry: iso(addDays(now, r.int(-10, 360))),
          vignetteExpiry: iso(addDays(now, r.int(10, 200))),
        },
        createdAt: iso(acquired),
      });
    }
  }

  // --- Customers ------------------------------------------------------------
  const tn: [string, string, string][] = [
    ["Mohamed", "Ben Ali", "Tunis"], ["Amira", "Trabelsi", "La Marsa"], ["Youssef", "Jebali", "Ariana"],
    ["Sarra", "Gharbi", "Sfax"], ["Ahmed", "Mejri", "Bizerte"], ["Ines", "Bouazizi", "Sousse"],
    ["Karim", "Hammami", "Nabeul"], ["Rim", "Chaabane", "Monastir"], ["Mehdi", "Sassi", "Ben Arous"],
    ["Nour", "Khelifi", "Hammamet"], ["Walid", "Ayari", "Kairouan"], ["Salma", "Dridi", "Tunis"],
    ["Hichem", "Zouari", "Sfax"], ["Fatma", "Belhadj", "Mahdia"], ["Aymen", "Karoui", "Gabès"],
    ["Olfa", "Mansouri", "Djerba"], ["Bilel", "Riahi", "Le Kram"], ["Yasmine", "Oueslati", "Manouba"],
    ["Anis", "Ferchichi", "Tozeur"], ["Mariem", "Baccouche", "Carthage"],
  ];
  const foreign: [string, string, string, string][] = [
    ["Pierre", "Martin", "Française", "Lyon"], ["Sofia", "Rossi", "Italienne", "Milan"],
    ["Thomas", "Müller", "Allemande", "Munich"], ["Leila", "Haddad", "Canadienne", "Montréal"],
    ["Emma", "Dubois", "Française", "Paris"], ["Luca", "Bianchi", "Italienne", "Palerme"],
  ];
  const diaspora: [string, string, string][] = [
    ["Samir", "Ben Salah", "Marseille"], ["Nadia", "Jlassi", "Paris"], ["Riadh", "Guesmi", "Bruxelles"],
  ];
  const companies: [string, string, string][] = [
    ["Sfax Logistique SARL", "1234567/A/M/000", "Sfax"],
    ["Medina Tours SA", "0876543/B/P/000", "Tunis"],
    ["Cap Bon Agro SUARL", "1456789/C/M/000", "Nabeul"],
    ["Carthage Consulting SARL", "1678901/D/A/000", "Les Berges du Lac"],
  ];

  const customers: Customer[] = [];
  const phone = () => `+216 ${r.pick(["20", "22", "24", "25", "27", "50", "52", "55", "58", "92", "95", "98"])} ${r.int(100, 999)} ${r.int(100, 999)}`;
  const base = (): Pick<Customer, "id" | "tenantId" | "blacklisted" | "blacklistReason" | "notes" | "createdAt"> => ({
    id: id("cus"),
    tenantId,
    blacklisted: false,
    blacklistReason: null,
    notes: null,
    createdAt: iso(addDays(now, -r.int(30, 500))),
  });
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

  for (const [first, last, city] of tn) {
    customers.push({
      ...base(),
      kind: "particulier",
      firstName: first,
      lastName: last,
      companyName: null,
      taxId: null,
      idType: "cin",
      idNumber: `${r.pick(["0", "1"])}${r.int(1000000, 9999999)}`,
      nationality: "Tunisienne",
      birthDate: iso(addDays(now, -r.int(22 * 365, 60 * 365))),
      phone: phone(),
      email: r.chance(0.8) ? `${slug(first)}.${slug(last)}@${r.pick(["gmail.com", "yahoo.fr", "topnet.tn", "outlook.com"])}` : null,
      address: `${r.int(1, 120)}, rue ${r.pick(["de Marseille", "Ibn Khaldoun", "de la Liberté", "Farhat Hached", "Habib Thameur", "de Palestine"])}`,
      city,
      licenseNumber: `${r.int(10, 99)}/${r.int(100000, 999999)}`,
      licenseIssueDate: iso(addDays(now, -r.int(300, 20 * 365))),
      licenseExpiry: iso(addDays(now, r.int(-20, 8 * 365))),
    });
  }
  for (const [first, last, nationality, city] of foreign) {
    customers.push({
      ...base(),
      kind: "particulier",
      firstName: first,
      lastName: last,
      companyName: null,
      taxId: null,
      idType: "passeport",
      idNumber: `${r.pick(["FR", "IT", "DE", "CA"])}${r.int(1000000, 9999999)}`,
      nationality,
      birthDate: iso(addDays(now, -r.int(25 * 365, 65 * 365))),
      phone: `+${r.pick(["33", "39", "49", "1"])} ${r.int(600, 799)} ${r.int(100, 999)} ${r.int(100, 999)}`,
      email: `${slug(first)}.${slug(last)}@mail.com`,
      address: `Hôtel ${r.pick(["Mövenpick", "Royal", "Radisson", "El Mouradi"])} (séjour)`,
      city,
      licenseNumber: `${r.int(100000000, 999999999)}`,
      licenseIssueDate: iso(addDays(now, -r.int(4 * 365, 30 * 365))),
      licenseExpiry: iso(addDays(now, r.int(365, 10 * 365))),
    });
  }
  for (const [first, last, city] of diaspora) {
    customers.push({
      ...base(),
      kind: "particulier",
      firstName: first,
      lastName: last,
      companyName: null,
      taxId: null,
      idType: "cin",
      idNumber: `${r.pick(["0", "1"])}${r.int(1000000, 9999999)}`,
      nationality: "Tunisienne (TRE)",
      birthDate: iso(addDays(now, -r.int(28 * 365, 55 * 365))),
      phone: `+33 6 ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)}`,
      email: `${slug(first)}.${slug(last)}@free.fr`,
      address: `${r.int(1, 90)}, rue de la République`,
      city,
      licenseNumber: `${r.int(10, 99)}/${r.int(100000, 999999)}`,
      licenseIssueDate: iso(addDays(now, -r.int(5 * 365, 25 * 365))),
      licenseExpiry: iso(addDays(now, r.int(365, 9 * 365))),
      notes: "Tunisien résidant à l'étranger — loue chaque été.",
    });
  }
  for (const [name, taxId, city] of companies) {
    const [first, last] = r.pick(tn);
    customers.push({
      ...base(),
      kind: "entreprise",
      firstName: first,
      lastName: last,
      companyName: name,
      taxId,
      idType: "cin",
      idNumber: `${r.pick(["0", "1"])}${r.int(1000000, 9999999)}`,
      nationality: "Tunisienne",
      birthDate: null,
      phone: `+216 7${r.int(1, 5)} ${r.int(100, 999)} ${r.int(100, 999)}`,
      email: `flotte@${slug(name.split(" ")[0])}.tn`,
      address: `Zone industrielle, lot ${r.int(1, 80)}`,
      city,
      licenseNumber: `${r.int(10, 99)}/${r.int(100000, 999999)}`,
      licenseIssueDate: iso(addDays(now, -r.int(5 * 365, 20 * 365))),
      licenseExpiry: iso(addDays(now, r.int(365, 8 * 365))),
      notes: "Compte entreprise — facturation mensuelle par virement.",
    });
  }
  // One blacklisted customer for testing risk flows.
  const blacklisted = customers[16];
  blacklisted.blacklisted = true;
  blacklisted.blacklistReason = "Véhicule restitué endommagé et facture impayée";

  // --- Rental history ---------------------------------------------------------
  const contracts: Contract[] = [];
  const invoices: Invoice[] = [];
  const workOrders: WorkOrder[] = [];
  const mileageLogs: MileageLog[] = [];
  const staff = users.map((u) => u.name);
  const log = (v: Vehicle, at: Date, km: number, fuelLevel: FuelLevel, source: MileageLog["source"], reference: string | null) => {
    mileageLogs.push({ id: id("mil"), tenantId, vehicleId: v.id, at: iso(at), km, fuelLevel, source, reference, note: null, recordedBy: r.pick(staff) });
  };

  const historyStart = addDays(now, -180);
  const catById = new Map(categories.map((c) => [c.id, c]));

  vehicles.forEach((v, index) => {
    const category = catById.get(v.categoryId)!;
    log(v, historyStart, v.mileage, 8, "manuel", "Relevé initial");
    let cursor = addDays(historyStart, r.int(0, 6));
    // Earliest time the car can go out again (after return, garage work, preparation).
    let availableFrom = historyStart.getTime() + HOUR;
    let futureCount = 0;
    // A few vehicles stay in the garage or out of service at the end.
    const endsInMaintenance = index === 3 || index === 17;
    const outOfService = index === 26;

    while (cursor < addDays(now, 35)) {
      const days = r.int(2, 9);
      let start = atHour(cursor, r.int(8, 17));
      if (start.getTime() < availableFrom) start = new Date(Math.ceil(availableFrom / HOUR) * HOUR);
      const end = new Date(start.getTime() + days * DAY);
      const isPast = end.getTime() < now.getTime() - 2 * HOUR;
      const isCurrent = start <= now && !isPast;
      const isFuture = start > now;
      if ((isFuture || isCurrent) && (endsInMaintenance || outOfService)) break;
      if (isFuture && ++futureCount > 2) break;

      const customer = r.chance(0.7) ? r.pick(customers.slice(0, 20)) : r.pick(customers);
      if (customer.blacklisted && !isPast) {
        cursor = addDays(end, 1);
        continue;
      }
      const pickup = r.chance(0.5) ? v.branchId : r.pick(branches).id;
      const chosenExtras = extras.filter(() => r.chance(0.25)).map((e) => ({ extraId: e.id, quantity: 1 }));
      const rate = quote({
        category,
        start,
        end,
        seasons,
        extras: chosenExtras.map((x) => ({ extra: extras.find((e) => e.id === x.extraId)!, quantity: x.quantity })),
        tvaBp: settings.tvaBp,
        timbre: settings.timbre,
      });
      const createdAt = addDays(start, -r.int(1, 20));
      const contract: Contract = {
        id: id("ctr"),
        tenantId,
        number: number("CT", createdAt),
        customerId: customer.id,
        vehicleId: v.id,
        pickupBranchId: pickup,
        returnBranchId: r.chance(0.8) ? pickup : r.pick(branches).id,
        startAt: iso(start),
        endAt: iso(end),
        status: "reservee",
        extras: chosenExtras,
        additionalDriver: chosenExtras.some((e) => e.extraId === "ex_driver") ? `${r.pick(tn)[0]} ${customer.lastName}` : null,
        rate,
        depositMethod: r.pick(["especes", "carte", "cheque"] as const),
        depositStatus: "en_attente",
        checkout: null,
        checkin: null,
        signature: null,
        invoiceId: null,
        notes: null,
        cancelledReason: null,
        createdBy: r.pick(staff),
        createdAt: iso(createdAt),
      };

      if (isFuture && r.chance(0.08)) {
        contract.status = "annulee";
        contract.cancelledReason = "Annulation client";
      }

      if (isPast || isCurrent) {
        const outKm = v.mileage;
        contract.status = "en_cours";
        contract.depositStatus = "bloquee";
        contract.checkout = { at: iso(start), km: outKm, fuelLevel: 8, notes: null, recordedBy: r.pick(staff) };
        contract.signature = { name: `${customer.firstName} ${customer.lastName}`, image: "", at: iso(start) };
        log(v, start, outKm, 8, "depart", contract.number);

        // Overdue rentals for alert testing (only when the rental started over a day ago).
        const overdue = isCurrent && (index === 5 || index === 12) && start.getTime() < now.getTime() - 2 * DAY;
        if (overdue) {
          contract.endAt = iso(new Date(now.getTime() - 5 * HOUR));
        }

        if (isPast) {
          const late = r.chance(0.08);
          const backAt = new Date(end.getTime() + (late ? r.int(3, 30) * HOUR : -r.int(0, 3) * HOUR));
          const driven = days * r.int(60, category.kmPerDay ? category.kmPerDay + 40 : 260);
          const inKm = outKm + driven;
          const fuelLevel = (r.chance(0.8) ? 8 : r.int(4, 7)) as FuelLevel;
          const damages: Damage[] = r.chance(0.06)
            ? [{ description: r.pick(["Rayure pare-choc arrière", "Rétroviseur cassé", "Jante rayée", "Impact pare-brise"]), cost: dt(r.pick([150, 220, 350, 480])) }]
            : [];
          contract.checkin = { at: iso(backAt), km: inKm, fuelLevel, notes: null, recordedBy: r.pick(staff), damages };
          v.mileage = inKm;
          log(v, backAt, inKm, fuelLevel, "retour", contract.number);

          const extraLines = returnCharges({
            rate,
            endAt: end,
            checkout: { km: outKm, fuelLevel: 8 },
            checkin: { at: backAt, km: inKm, fuelLevel },
            damages,
            fuelChargePerEighth: settings.fuelChargePerEighth,
            lateGraceMinutes: settings.lateGraceMinutes,
          });

          const justReturned = backAt.getTime() > now.getTime() - 20 * HOUR;
          if (justReturned) {
            contract.status = "retournee";
          } else {
            contract.status = "cloturee";
            contract.depositStatus = damages.length ? "retenue" : "restituee";
            const lines = [...rate.lines, ...extraLines];
            const t = totals(lines, settings.tvaBp, settings.timbre);
            const invoice: Invoice = {
              id: id("inv"),
              tenantId,
              number: number("FA", backAt),
              customerId: customer.id,
              contractId: contract.id,
              issuedAt: iso(backAt),
              dueAt: iso(addDays(backAt, settings.paymentTermDays)),
              lines,
              tvaBp: settings.tvaBp,
              timbre: settings.timbre,
              ...t,
              payments: [],
              status: "emise",
            };
            const roll = r.next();
            const method: PaymentMethod =
              customer.kind === "entreprise" ? "virement" : r.pick(["especes", "especes", "carte", "carte", "cheque", "d17"] as const);
            if (customer.blacklisted) {
              invoice.payments = [];
            } else if (roll < 0.86) {
              invoice.payments = [{ id: id("pay"), at: iso(backAt), amount: t.total, method, reference: method === "cheque" ? `CHQ ${r.int(1000000, 9999999)}` : null, recordedBy: r.pick(staff) }];
            } else if (roll < 0.94) {
              invoice.payments = [{ id: id("pay"), at: iso(backAt), amount: Math.round(t.total / 2 / 1000) * 1000, method, reference: null, recordedBy: r.pick(staff) }];
            }
            const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
            invoice.status = paid >= invoice.total ? "payee" : paid > 0 ? "partiellement_payee" : "emise";
            invoices.push(invoice);
            contract.invoiceId = invoice.id;
          }

          availableFrom = backAt.getTime() + 2 * HOUR;

          if (damages.length) {
            const opened = new Date(availableFrom);
            const closed = addDays(opened, r.int(1, 3));
            availableFrom = closed.getTime();
            workOrders.push({
              id: id("wo"),
              tenantId,
              number: number("OT", opened),
              vehicleId: v.id,
              type: "carrosserie",
              description: damages[0].description,
              status: "termine",
              immobilizing: true,
              vendor: r.pick(["Carrosserie El Amen", "Garage Ben Youssef", "Auto Service Sfax"]),
              openedAt: iso(opened),
              closedAt: iso(closed),
              kmAtOpen: inKm,
              partsCost: Math.round(damages[0].cost * 0.6),
              laborCost: Math.round(damages[0].cost * 0.4),
              contractId: contract.id,
              notes: null,
            });
          }

          // Preventive service when the mileage threshold is crossed.
          if (v.mileage >= v.nextServiceKm) {
            const opened = new Date(availableFrom);
            const closed = new Date(opened.getTime() + r.int(3, 8) * HOUR);
            availableFrom = closed.getTime() + HOUR;
            workOrders.push({
              id: id("wo"),
              tenantId,
              number: number("OT", opened),
              vehicleId: v.id,
              type: "entretien_preventif",
              description: `Vidange + filtres (révision ${v.nextServiceKm.toLocaleString("fr-FR")} km)`,
              status: "termine",
              immobilizing: true,
              vendor: r.pick(["Garage Ben Youssef", "Speedy Tunis", "Norauto La Marsa", "Garage Central Sousse"]),
              openedAt: iso(opened),
              closedAt: iso(closed),
              kmAtOpen: v.mileage,
              partsCost: dt(r.int(120, 260)),
              laborCost: dt(r.int(60, 120)),
              contractId: null,
              notes: null,
            });
            log(v, closed, v.mileage, 8, "entretien", null);
            while (v.nextServiceKm <= v.mileage) v.nextServiceKm += v.serviceIntervalKm;
          }
        } else {
          v.status = "loue";
          v.fuelLevel = 8;
        }
      }

      contracts.push(contract);
      if (isCurrent) {
        // Future bookings only after the car is expected back (plus the overdue buffer).
        availableFrom = Math.max(end.getTime(), now.getTime() + DAY) + 2 * HOUR;
      } else if (!isPast) {
        availableFrom = end.getTime() + 2 * HOUR;
      }
      cursor = addDays(new Date(availableFrom), r.int(0, 4));
    }

    if (endsInMaintenance) {
      v.status = "maintenance";
      workOrders.push({
        id: id("wo"),
        tenantId,
        number: number("OT", addDays(now, -2)),
        vehicleId: v.id,
        type: index === 3 ? "reparation" : "pneumatiques",
        description: index === 3 ? "Bruit embrayage — diagnostic et remplacement kit embrayage" : "Remplacement des 4 pneus + parallélisme",
        status: index === 3 ? "en_cours" : "ouvert",
        immobilizing: true,
        vendor: index === 3 ? "Garage Ben Youssef" : "Pneus Kheireddine",
        openedAt: iso(addDays(now, index === 3 ? -2 : -1)),
        closedAt: null,
        kmAtOpen: v.mileage,
        partsCost: index === 3 ? dt(780) : dt(640),
        laborCost: index === 3 ? dt(250) : dt(60),
        contractId: null,
        notes: null,
      });
    }
    if (outOfService) {
      v.status = "hors_service";
    }
  });

  // Last known fuel level per vehicle.
  for (const v of vehicles) {
    const last = mileageLogs.filter((l) => l.vehicleId === v.id).at(-1);
    if (last) v.fuelLevel = last.fuelLevel;
  }

  contracts.sort((a, b) => a.startAt.localeCompare(b.startAt));
  invoices.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

  return {
    settings,
    users,
    branches,
    categories,
    seasons,
    extras,
    vehicles,
    mileageLogs,
    customers,
    contracts,
    invoices,
    workOrders,
    counters,
  };
}
