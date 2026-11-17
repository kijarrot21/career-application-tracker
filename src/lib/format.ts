/**
 * Locale-aware formatting helpers for currencies (IDR default), numbers, dates,
 * timezones (Asia/Jakarta default), and sequence codes.
 * All formatters use explicit locale, timeZone, and hour12 settings so SSR and
 * client hydration always produce identical strings.
 */

import { TZDate } from "@date-fns/tz";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  getMessages,
  normalizeLocale,
  resolveCurrencyDefinition,
  type AppLocale,
} from "@/lib/i18n";

export function formatCode(prefix: "JOB" | "APP", seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export function formatNumber(
  value: number | null | undefined,
  locale: string | AppLocale = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  const normalizedLocale = normalizeLocale(locale);
  if (value === null || value === undefined || Number.isNaN(value)) {
    return getMessages(normalizedLocale).common.notSpecified;
  }
  return new Intl.NumberFormat(normalizedLocale, options).format(value);
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  compact: boolean = false,
  locale: string | AppLocale = DEFAULT_LOCALE,
): string {
  const normalizedLocale = normalizeLocale(locale);
  const messages = getMessages(normalizedLocale);

  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return messages.common.notSpecified;
  }

  const def = resolveCurrencyDefinition(currency);
  const hasFraction = Math.abs(amount % 1) > Number.EPSILON;
  const minFrac =
    def.minorUnits === 0 || compact || !hasFraction ? 0 : def.minorUnits;
  const maxFrac =
    def.minorUnits === 0 ? 0 : compact ? 1 : hasFraction ? def.minorUnits : 0;

  try {
    return new Intl.NumberFormat(normalizedLocale, {
      style: "currency",
      currency: def.code,
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
      notation: compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${def.code} ${new Intl.NumberFormat(normalizedLocale).format(amount)}`;
  }
}

export interface IndicativeCurrencyDisplay {
  originalAmount: number;
  originalCurrency: string;
  formattedOriginal: string;
  displayAmount: number;
  displayCurrency: string;
  formattedDisplay: string;
  isIndicativeDisplay: true;
  isFinancialSettlement: false;
  disclaimer: string;
}

/**
 * Pure presentation helper for showing an indicative currency conversion.
 * Never performs financial settlement or alters stored ledger/payment amounts.
 */
export function formatDisplayCurrencyConversion(params: {
  amount: number;
  sourceCurrency: string;
  displayCurrency?: string;
  exchangeRate?: number;
  locale?: string | AppLocale;
  compact?: boolean;
}): IndicativeCurrencyDisplay {
  const normalizedLocale = normalizeLocale(params.locale);
  const messages = getMessages(normalizedLocale);
  const sourceCurrency = params.sourceCurrency.trim().toUpperCase() || DEFAULT_CURRENCY;
  const targetCurrency =
    params.displayCurrency?.trim().toUpperCase() || sourceCurrency;
  const rate =
    targetCurrency === sourceCurrency
      ? 1
      : typeof params.exchangeRate === "number" && params.exchangeRate > 0
        ? params.exchangeRate
        : 1;

  const displayAmount = params.amount * rate;

  return {
    originalAmount: params.amount,
    originalCurrency: sourceCurrency,
    formattedOriginal: formatMoney(
      params.amount,
      sourceCurrency,
      params.compact,
      normalizedLocale,
    ),
    displayAmount,
    displayCurrency: targetCurrency,
    formattedDisplay: formatMoney(
      displayAmount,
      targetCurrency,
      params.compact,
      normalizedLocale,
    ),
    isIndicativeDisplay: true,
    isFinancialSettlement: false,
    disclaimer: messages.common.indicativeDisplayNote,
  };
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  period: string = "month",
  locale: string | AppLocale = DEFAULT_LOCALE,
): string {
  const normalizedLocale = normalizeLocale(locale);
  const messages = getMessages(normalizedLocale);

  if (min == null && max == null) return messages.common.undisclosed;

  const suffix =
    messages.statuses.salaryPeriod[
      period as keyof typeof messages.statuses.salaryPeriod
    ] ?? `/${period}`;

  if (min != null && max != null) {
    if (min === max) {
      return `${formatMoney(min, currency, true, normalizedLocale)}${suffix}`;
    }
    return `${formatMoney(min, currency, true, normalizedLocale)} ${messages.common.to} ${formatMoney(max, currency, true, normalizedLocale)}${suffix}`;
  }
  if (min != null) {
    return `${messages.common.from} ${formatMoney(min, currency, true, normalizedLocale)}${suffix}`;
  }
  return `${messages.common.upTo} ${formatMoney(max, currency, true, normalizedLocale)}${suffix}`;
}

export function formatDate(
  dateStr: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  locale: string | AppLocale = DEFAULT_LOCALE,
): string {
  const normalizedLocale = normalizeLocale(locale);
  const messages = getMessages(normalizedLocale);
  if (!dateStr) return messages.common.notSet;

  const isDateOnlyString = typeof dateStr === "string" && dateStr.length === 10;
  const d =
    typeof dateStr === "string"
      ? new Date(isDateOnlyString ? `${dateStr}T00:00:00Z` : dateStr)
      : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);

  return new Intl.DateTimeFormat(normalizedLocale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: isDateOnlyString ? "UTC" : timeZone,
  }).format(d);
}

export function formatDateTime(
  instant: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  locale: string | AppLocale = DEFAULT_LOCALE,
): string {
  const normalizedLocale = normalizeLocale(locale);
  const messages = getMessages(normalizedLocale);
  if (!instant) return messages.common.notSet;

  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return String(instant);

  return new Intl.DateTimeFormat(normalizedLocale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

export function convertInstantToTimeZoneParts(
  instant: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
} {
  const baseDate = typeof instant === "string" ? new Date(instant) : instant;
  const zoned = new TZDate(baseDate.getTime(), timeZone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    timeZone,
  };
}
