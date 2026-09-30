// Amounts are stored as integer millimes (1 DT = 1000 millimes) to avoid floating-point errors.
export type Millimes = number;

const currency = new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND" });
const plain = new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function formatTnd(amount: Millimes): string {
  return currency.format(amount / 1000);
}

/** "1 234,500" without the currency sign (for inputs and tables). */
export function formatTndPlain(amount: Millimes): string {
  return plain.format(amount / 1000);
}

/** Dinars (number) → millimes. */
export function dt(dinars: number): Millimes {
  return Math.round(dinars * 1000);
}

/** Parses user input like "85", "85,5", "1 234,500" or "85.500" into millimes. Returns null if invalid. */
export function parseTnd(input: unknown): Millimes | null {
  if (typeof input !== "string") return null;
  const normalized = input.replace(/[\s  ]/g, "").replace(/DT|TND/gi, "").replace(",", ".");
  if (normalized === "" || !/^-?\d+(\.\d{0,3})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 1000);
}

/** Applies a rate in basis points (1900 = 19 %) with half-up rounding to the millime. */
export function applyRate(amount: Millimes, basisPoints: number): Millimes {
  return Math.round((amount * basisPoints) / 10000);
}
