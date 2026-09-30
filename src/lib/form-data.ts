import { parseTnd } from "@/domain/shared/money";

/** Helpers for reading FormData in Server Actions (use with zod for validation). */
export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

export const optStr = (fd: FormData, key: string) => str(fd, key) || null;

export const int = (fd: FormData, key: string) => {
  const v = str(fd, key).replace(/[\s  ]/g, "");
  return /^-?\d+$/.test(v) ? Number(v) : Number.NaN;
};

/** Money input in dinars ("85,500") → millimes, NaN if invalid. */
export const money = (fd: FormData, key: string) => parseTnd(str(fd, key)) ?? Number.NaN;

/** Percentage input ("10" or "12,5") → basis points, NaN if invalid. */
export const percentBp = (fd: FormData, key: string) => {
  const v = str(fd, key).replace(",", ".");
  if (v === "") return 0;
  return /^-?\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : Number.NaN;
};

export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";
