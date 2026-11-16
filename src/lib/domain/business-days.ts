/**
 * Date-only helpers. Dates are ISO strings "YYYY-MM-DD" so that business-day
 * arithmetic is never affected by server timezone or DST.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: string): Date {
  if (!isIsoDate(date)) throw new Error(`Invalid ISO date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const day = toUtc(date).getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: string, holidays: ReadonlySet<string> | readonly string[] = []): boolean {
  const set = holidays instanceof Set ? holidays : new Set(holidays);
  return !isWeekend(date) && !set.has(date);
}

/** Add `n` business days (Mon-Fri, excluding holidays). n must be >= 0. */
export function addBusinessDays(
  date: string,
  n: number,
  holidays: readonly string[] = [],
): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("n must be a non-negative integer");
  const set = new Set(holidays);
  const d = toUtc(date);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusinessDay(fromUtc(d), set)) added++;
  }
  return fromUtc(d);
}

export function addCalendarDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return dateInTimeZone(now, timeZone);
}

/** Calendar date of an instant in the given IANA timezone, as YYYY-MM-DD. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Standard Indonesian national holiday dates (2026-2027) for business-day follow-up scheduling. */
export const INDONESIAN_HOLIDAY_PRESETS = [
  "2026-01-01",
  "2026-02-17",
  "2026-03-19",
  "2026-03-20",
  "2026-03-21",
  "2026-04-03",
  "2026-05-01",
  "2026-05-14",
  "2026-05-27",
  "2026-06-01",
  "2026-06-16",
  "2026-08-17",
  "2026-08-25",
  "2026-12-25",
  "2027-01-01",
] as const;
