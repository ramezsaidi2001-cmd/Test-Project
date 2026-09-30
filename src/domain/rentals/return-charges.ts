import type { FuelLevel } from "../fleet/types";
import { DAY } from "../shared/dates";
import type { Millimes } from "../shared/money";
import type { Damage, PriceLine, RateSnapshot } from "./types";

export type ReturnInput = {
  rate: RateSnapshot;
  endAt: Date;
  checkout: { km: number; fuelLevel: FuelLevel };
  checkin: { at: Date; km: number; fuelLevel: FuelLevel };
  damages: Damage[];
  fuelChargePerEighth: Millimes;
  lateGraceMinutes: number;
};

/** Extra charges computed at vehicle return (all HT). */
export function returnCharges(input: ReturnInput): PriceLine[] {
  const { rate, checkout, checkin } = input;
  const lines: PriceLine[] = [];

  if (checkin.km < checkout.km) {
    throw new Error("Le kilométrage de retour ne peut pas être inférieur au kilométrage de départ.");
  }

  if (rate.kmPerDay !== null) {
    const allowed = rate.kmPerDay * rate.days;
    const extraKm = checkin.km - checkout.km - allowed;
    if (extraKm > 0) {
      lines.push({
        label: `Kilomètres supplémentaires (au-delà de ${allowed} km)`,
        quantity: extraKm,
        unitPrice: rate.extraKmRate,
        total: extraKm * rate.extraKmRate,
        kind: "km_sup",
      });
    }
  }

  const lateMs = checkin.at.getTime() - input.endAt.getTime() - input.lateGraceMinutes * 60_000;
  if (lateMs > 0) {
    const lateDays = Math.ceil(lateMs / DAY);
    lines.push({
      label: `Retard de restitution (${lateDays} j)`,
      quantity: lateDays,
      unitPrice: rate.dailyRate,
      total: lateDays * rate.dailyRate,
      kind: "retard",
    });
  }

  const missingEighths = checkout.fuelLevel - checkin.fuelLevel;
  if (missingEighths > 0) {
    lines.push({
      label: `Carburant manquant (${missingEighths}/8 de réservoir)`,
      quantity: missingEighths,
      unitPrice: input.fuelChargePerEighth,
      total: missingEighths * input.fuelChargePerEighth,
      kind: "carburant",
    });
  }

  for (const d of input.damages) {
    if (d.cost <= 0) continue;
    lines.push({ label: `Dommage : ${d.description}`, quantity: 1, unitPrice: d.cost, total: d.cost, kind: "dommage" });
  }

  return lines;
}
