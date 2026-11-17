import type { JobPriority, SearchStatus, TriageStatus } from "@/lib/constants";
import type { ArchiveOutcome } from "@/lib/domain/archive";
import type { Outcome, StageType } from "@/lib/domain/stages";
import { EN_US_MESSAGES } from "./messages/en-us";
import { ID_ID_MESSAGES } from "./messages/id-id";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  SUPPORTED_LOCALES,
  type AppLocale,
  type MarketConfig,
  type TranslationMessages,
} from "./types";

export * from "./currencies";
export * from "./types";

export const MESSAGE_CATALOGS: Record<AppLocale, TranslationMessages> = {
  "id-ID": ID_ID_MESSAGES,
  "en-US": EN_US_MESSAGES,
};

/**
 * Declarative market registry so future regional markets can be enabled
 * through configuration without altering business logic.
 */
export const MARKET_CONFIGS: Record<AppLocale, MarketConfig> = {
  "id-ID": {
    locale: "id-ID",
    htmlLang: "id",
    label: "Indonesia - Bahasa Indonesia (id-ID)",
    nativeLabel: "Bahasa Indonesia",
    shortLabel: "ID",
    aiLocale: "id",
    defaultCurrency: DEFAULT_CURRENCY,
    defaultTimezone: DEFAULT_TIMEZONE,
    defaultCvFormat: "indonesian_cv",
  },
  "en-US": {
    locale: "en-US",
    htmlLang: "en",
    label: "Global - English (en-US)",
    nativeLabel: "English",
    shortLabel: "EN",
    aiLocale: "en",
    defaultCurrency: "USD",
    defaultTimezone: "UTC",
    defaultCvFormat: "international_resume",
  },
};

export function normalizeLocale(raw?: string | null): AppLocale {
  if (!raw) return DEFAULT_LOCALE;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === "id" || cleaned.startsWith("id-") || cleaned.startsWith("id_")) {
    return "id-ID";
  }
  if (cleaned === "en" || cleaned.startsWith("en-") || cleaned.startsWith("en_")) {
    return "en-US";
  }
  return SUPPORTED_LOCALES.includes(raw as AppLocale)
    ? (raw as AppLocale)
    : DEFAULT_LOCALE;
}

export function toAiLocale(locale?: string | null): "id" | "en" {
  return normalizeLocale(locale) === "id-ID" ? "id" : "en";
}

export function getDefaultCvFormatForLocale(
  locale?: string | null,
): "indonesian_cv" | "international_resume" {
  return MARKET_CONFIGS[normalizeLocale(locale)].defaultCvFormat;
}

export function getMessages(locale?: string | null): TranslationMessages {
  return MESSAGE_CATALOGS[normalizeLocale(locale)];
}

/**
 * Looks up a dotted translation key with safe fallback to `en-US` and optional
 * custom missing-key handler (used for runtime diagnostics and tests).
 */
export function translate(
  locale: string | null | undefined,
  keyPath: string,
  options?: {
    fallback?: string;
    onMissing?: (locale: AppLocale, keyPath: string) => void;
  },
): string {
  const normalized = normalizeLocale(locale);
  const parts = keyPath.split(".");

  const readPath = (root: unknown): string | undefined => {
    let cursor: unknown = root;
    for (const part of parts) {
      if (
        cursor === null ||
        typeof cursor !== "object" ||
        !(part in (cursor as Record<string, unknown>))
      ) {
        return undefined;
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    return typeof cursor === "string" && cursor.length > 0 ? cursor : undefined;
  };

  const localized = readPath(MESSAGE_CATALOGS[normalized]);
  if (localized) return localized;

  options?.onMissing?.(normalized, keyPath);

  const fallbackEn = readPath(EN_US_MESSAGES);
  if (fallbackEn) return fallbackEn;

  return options?.fallback ?? keyPath;
}

/**
 * Recursively verifies key completeness between two translation dictionaries.
 * Returns any keys present in `reference` that are missing or empty in `candidate`.
 */
export function findMissingTranslationKeys(
  reference: Record<string, unknown>,
  candidate: Record<string, unknown>,
  prefix = "",
): string[] {
  const missing: string[] = [];

  for (const [key, refValue] of Object.entries(reference)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const candValue = candidate[key];

    if (
      refValue !== null &&
      typeof refValue === "object" &&
      !Array.isArray(refValue)
    ) {
      if (
        candValue === null ||
        typeof candValue !== "object" ||
        Array.isArray(candValue)
      ) {
        missing.push(fullKey);
      } else {
        missing.push(
          ...findMissingTranslationKeys(
            refValue as Record<string, unknown>,
            candValue as Record<string, unknown>,
            fullKey,
          ),
        );
      }
    } else if (typeof candValue !== "string" || candValue.trim().length === 0) {
      missing.push(fullKey);
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Localized Domain Status & Error Helpers (Zero business logic coupling)
// ---------------------------------------------------------------------------

export function getLocalizedOutcomeLabel(
  outcome: Outcome,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.outcome[outcome] ?? outcome;
}

export function getLocalizedStageTypeLabel(
  stageType: StageType,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.stageType[stageType] ?? stageType;
}

export function getLocalizedArchiveOutcomeLabel(
  outcome: ArchiveOutcome,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.archiveOutcome[outcome] ?? outcome;
}

export function getLocalizedTriageLabel(
  status: TriageStatus,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.triage[status] ?? status;
}

export function getLocalizedPriorityLabel(
  priority: JobPriority,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.priority[priority] ?? priority;
}

export function getLocalizedWorkArrangementLabel(
  arrangement: "onsite" | "hybrid" | "remote",
  locale?: string | null,
): string {
  return getMessages(locale).statuses.workArrangement[arrangement] ?? arrangement;
}

export function getLocalizedSearchStatusLabel(
  status: SearchStatus,
  locale?: string | null,
): string {
  return getMessages(locale).statuses.searchStatus[status] ?? status;
}

export function getLocalizedErrorMessage(
  code: string,
  locale?: string | null,
  fallbackMessage?: string,
): string {
  const dict = getMessages(locale).errors as Record<string, string>;
  return dict[code] ?? fallbackMessage ?? dict.UNKNOWN_ERROR;
}

