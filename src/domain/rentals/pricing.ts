import type { VehicleCategory } from "../fleet/types";
import { DAY, tunisDay } from "../shared/dates";
import { applyRate, type Millimes } from "../shared/money";
import type { PriceLine, RateSnapshot, RentalExtra, SeasonalRate } from "./types";

export const WEEKLY_THRESHOLD_DAYS = 7;
/** Returns up to this many minutes after a full day are not billed as an extra day. */
export const DAY_GRACE_MINUTES = 59;

/** Billable rental days: started 24h periods (after a short grace), minimum 1. */
export function billableDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime() - DAY_GRACE_MINUTES * 60_000;
  return Math.max(1, Math.ceil(ms / DAY));
}

export function seasonFor(day: string, seasons: SeasonalRate[]): SeasonalRate | null {
  // If several seasons overlap, the largest adjustment wins.
  let best: SeasonalRate | null = null;
  for (const s of seasons) {
    if (day >= s.startDate && day <= s.endDate && (!best || s.adjustmentBp > best.adjustmentBp)) best = s;
  }
  return best;
}

export function totals(lines: PriceLine[], tvaBp: number, timbre: Millimes) {
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const tva = applyRate(subtotal, tvaBp);
  return { subtotal, tva, total: subtotal + tva + timbre };
}

export type QuoteInput = {
  category: VehicleCategory;
  start: Date;
  end: Date;
  seasons: SeasonalRate[];
  extras: { extra: RentalExtra; quantity: number }[];
  /** Commercial discount in basis points (1000 = 10 %). */
  discountBp?: number;
  tvaBp: number;
  timbre: Millimes;
};

export function quote(input: QuoteInput): RateSnapshot {
  const { category, start, end } = input;
  if (end <= start) throw new Error("La date de retour doit être postérieure à la date de départ.");

  const days = billableDays(start, end);
  const dailyRate = days >= WEEKLY_THRESHOLD_DAYS ? category.weeklyDailyRate : category.dailyRate;

  const lines: PriceLine[] = [
    {
      label: `Location ${category.name} (${days} j${days >= WEEKLY_THRESHOLD_DAYS ? ", tarif semaine" : ""})`,
      quantity: days,
      unitPrice: dailyRate,
      total: dailyRate * days,
      kind: "location",
    },
  ];

  // Seasonal adjustments, grouped per season.
  const perSeason = new Map<string, { season: SeasonalRate; days: number }>();
  for (let i = 0; i < days; i++) {
    const season = seasonFor(tunisDay(new Date(start.getTime() + i * DAY)), input.seasons);
    if (!season || season.adjustmentBp === 0) continue;
    const entry = perSeason.get(season.id) ?? { season, days: 0 };
    entry.days++;
    perSeason.set(season.id, entry);
  }
  for (const { season, days: n } of perSeason.values()) {
    const unit = applyRate(dailyRate, season.adjustmentBp);
    const pct = season.adjustmentBp / 100;
    lines.push({
      label: `${season.name} (${pct > 0 ? "+" : ""}${pct} %)`,
      quantity: n,
      unitPrice: unit,
      total: unit * n,
      kind: "saison",
    });
  }

  for (const { extra, quantity } of input.extras) {
    if (quantity <= 0) continue;
    const qty = extra.pricing === "par_jour" ? quantity * days : quantity;
    lines.push({
      label: extra.pricing === "par_jour" ? `${extra.name} (${quantity} × ${days} j)` : extra.name,
      quantity: qty,
      unitPrice: extra.price,
      total: extra.price * qty,
      kind: "option",
    });
  }

  if (input.discountBp && input.discountBp > 0) {
    const base = lines.reduce((s, l) => s + l.total, 0);
    const discount = applyRate(base, input.discountBp);
    lines.push({
      label: `Remise commerciale (${input.discountBp / 100} %)`,
      quantity: 1,
      unitPrice: -discount,
      total: -discount,
      kind: "remise",
    });
  }

  return {
    categoryName: category.name,
    days,
    dailyRate,
    kmPerDay: category.kmPerDay,
    extraKmRate: category.extraKmRate,
    deposit: category.deposit,
    tvaBp: input.tvaBp,
    timbre: input.timbre,
    lines,
    ...totals(lines, input.tvaBp, input.timbre),
  };
}
