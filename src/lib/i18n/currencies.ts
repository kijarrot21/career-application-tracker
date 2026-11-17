import { CURRENCIES } from "@/lib/constants";
import type { AppLocale, CurrencyDefinition } from "./types";

/**
 * Extensible currency registry. Adding a new display currency requires adding
 * a config entry here (or passing any valid ISO 4217 code), without rewriting
 * core business rules or payment settlement logic.
 */
export const CURRENCY_CATALOG: Record<string, CurrencyDefinition> = {
  IDR: {
    code: "IDR",
    symbol: "Rp",
    nameId: "Rupiah Indonesia",
    nameEn: "Indonesian Rupiah",
    minorUnits: 0,
    defaultFormattingLocale: "id-ID",
    isDefaultSettlement: true,
  },
  USD: {
    code: "USD",
    symbol: "$",
    nameId: "Dolar Amerika Serikat",
    nameEn: "US Dollar",
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  },
  SGD: {
    code: "SGD",
    symbol: "S$",
    nameId: "Dolar Singapura",
    nameEn: "Singapore Dollar",
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  },
  MYR: {
    code: "MYR",
    symbol: "RM",
    nameId: "Ringgit Malaysia",
    nameEn: "Malaysian Ringgit",
    minorUnits: 2,
    defaultFormattingLocale: "id-ID",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    nameId: "Euro",
    nameEn: "Euro",
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    nameId: "Pound Sterling Inggris",
    nameEn: "British Pound",
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    nameId: "Dolar Australia",
    nameEn: "Australian Dollar",
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    nameId: "Yen Jepang",
    nameEn: "Japanese Yen",
    minorUnits: 0,
    defaultFormattingLocale: "en-US",
  },
};

const ISO_CURRENCY_RE = /^[A-Z]{3}$/;

export function isValidIsoCurrencyCode(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (!ISO_CURRENCY_RE.test(upper)) return false;
  if (CURRENCY_CATALOG[upper]) return true;
  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upper,
    }).format(1);
    return true;
  } catch {
    return false;
  }
}

export function resolveCurrencyDefinition(
  code: string,
  extraCatalog?: Record<string, CurrencyDefinition>,
): CurrencyDefinition {
  const upper = code.trim().toUpperCase() || "IDR";
  if (extraCatalog?.[upper]) return extraCatalog[upper];
  if (CURRENCY_CATALOG[upper]) return CURRENCY_CATALOG[upper];
  return {
    code: upper,
    symbol: upper,
    nameId: upper,
    nameEn: upper,
    minorUnits: 2,
    defaultFormattingLocale: "en-US",
  };
}

export function getSupportedCurrencyOptions(
  locale: AppLocale,
  extraCurrencies: CurrencyDefinition[] = [],
): Array<{ code: string; label: string }> {
  const seen = new Set<string>();
  const list: CurrencyDefinition[] = [];

  for (const code of CURRENCIES) {
    const def = CURRENCY_CATALOG[code];
    if (def && !seen.has(def.code)) {
      seen.add(def.code);
      list.push(def);
    }
  }
  for (const extra of extraCurrencies) {
    if (!seen.has(extra.code)) {
      seen.add(extra.code);
      list.push(extra);
    }
  }

  return list.map((c) => ({
    code: c.code,
    label: `${c.code} — ${locale === "id-ID" ? c.nameId : c.nameEn}`,
  }));
}
