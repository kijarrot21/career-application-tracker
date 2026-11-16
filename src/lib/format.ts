/**
 * Formatting helpers for currency (IDR default), dates, and sequence codes.
 * No em-dashes are used anywhere.
 * All date/time formatters use explicit timeZone and hour12 settings so SSR
 * and client hydration always produce identical strings.
 */

export function formatCode(prefix: "JOB" | "APP", seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string = "IDR",
  compact: boolean = false,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "Not specified";
  }
  try {
    return new Intl.NumberFormat("en-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string = "IDR",
  period: string = "month",
): string {
  if (min == null && max == null) return "Undisclosed";
  const suffix = period === "month" ? "/mo" : period === "year" ? "/yr" : `/${period}`;
  if (min != null && max != null) {
    if (min === max) return `${formatMoney(min, currency, true)}${suffix}`;
    return `${formatMoney(min, currency, true)} to ${formatMoney(max, currency, true)}${suffix}`;
  }
  if (min != null) return `From ${formatMoney(min, currency, true)}${suffix}`;
  return `Up to ${formatMoney(max, currency, true)}${suffix}`;
}

export function formatDate(
  dateStr: string | Date | null | undefined,
  timeZone: string = "Asia/Jakarta",
): string {
  if (!dateStr) return "Not set";
  const isDateOnlyString = typeof dateStr === "string" && dateStr.length === 10;
  const d =
    typeof dateStr === "string"
      ? new Date(isDateOnlyString ? `${dateStr}T00:00:00Z` : dateStr)
      : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: isDateOnlyString ? "UTC" : timeZone,
  }).format(d);
}

export function formatDateTime(
  instant: string | Date | null | undefined,
  timeZone: string = "Asia/Jakarta",
): string {
  if (!instant) return "Not set";
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return String(instant);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}
