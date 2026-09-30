export const TIME_ZONE = "Africa/Tunis";
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: TIME_ZONE });
const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", timeZone: TIME_ZONE });

export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTimeFmt.format(new Date(iso));
export const formatShortDate = (iso: string | Date) => shortFmt.format(new Date(iso));
export const formatMonth = (iso: string | Date) => monthFmt.format(new Date(iso));
export const formatWeekday = (iso: string | Date) => weekdayFmt.format(new Date(iso));

/** Calendar date (YYYY-MM-DD) in Tunis time. */
export function tunisDay(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(date));
}

/** Parses a <input type="datetime-local"> value as Tunis local time (UTC+1, no DST). */
export function parseLocalDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses a <input type="date"> value (midnight Tunis time). */
export function parseLocalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Value for <input type="datetime-local"> in Tunis time. */
export function toLocalInput(date: Date | string): string {
  const d = new Date(new Date(date).getTime() + HOUR);
  return d.toISOString().slice(0, 16);
}

export function toDateInput(date: Date | string): string {
  return tunisDay(date);
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function addDays(date: Date | string, days: number): Date {
  return new Date(new Date(date).getTime() + days * DAY);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
