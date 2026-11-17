"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatSalaryRange,
} from "@/lib/format";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  getMessages,
  normalizeLocale,
  translate,
  type AppLocale,
  type TranslationMessages,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: AppLocale;
  timezone: string;
  currency: string;
  messages: TranslationMessages;
  t: (keyPath: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  timezone: DEFAULT_TIMEZONE,
  currency: DEFAULT_CURRENCY,
  messages: getMessages(DEFAULT_LOCALE),
  t: (keyPath: string, fallback?: string) =>
    translate(DEFAULT_LOCALE, keyPath, { fallback }),
});

export function LocaleProvider({
  locale,
  timezone,
  currency,
  children,
}: {
  locale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  children: React.ReactNode;
}) {
  const normalizedLocale = normalizeLocale(locale);
  const resolvedTz = timezone?.trim() || DEFAULT_TIMEZONE;
  const resolvedCurr = currency?.trim().toUpperCase() || DEFAULT_CURRENCY;

  const value = useMemo<LocaleContextValue>(() => {
    const messages = getMessages(normalizedLocale);
    return {
      locale: normalizedLocale,
      timezone: resolvedTz,
      currency: resolvedCurr,
      messages,
      t: (keyPath: string, fallback?: string) =>
        translate(normalizedLocale, keyPath, { fallback }),
    };
  }, [normalizedLocale, resolvedTz, resolvedCurr]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useTranslations() {
  const { messages, t, locale } = useContext(LocaleContext);
  return { messages, t, locale };
}

export function useLocalizedFormatters() {
  const { locale, timezone, currency } = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      timezone,
      currency,
      formatMoney: (
        amount: number | null | undefined,
        curr: string = currency,
        compact = false,
      ) => formatMoney(amount, curr, compact, locale),
      formatSalaryRange: (
        min: number | null | undefined,
        max: number | null | undefined,
        curr: string = currency,
        period = "month",
      ) => formatSalaryRange(min, max, curr, period, locale),
      formatNumber: (
        val: number | null | undefined,
        options?: Intl.NumberFormatOptions,
      ) => formatNumber(val, locale, options),
      formatDate: (dateStr: string | Date | null | undefined) =>
        formatDate(dateStr, timezone, locale),
      formatDateTime: (instant: string | Date | null | undefined) =>
        formatDateTime(instant, timezone, locale),
    }),
    [locale, timezone, currency],
  );
}
