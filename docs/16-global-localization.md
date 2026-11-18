# Phase 9: Global Localization and Regional Readiness

> **Audit status (2026-11-18):** Verified against `src/lib/i18n/` (including `messages/en-us.ts` and `messages/id-id.ts`), `src/lib/format.ts`, `src/lib/i18n/currencies.ts`, and `src/app/layout.tsx`. Status labels: **COMPLETE**, **PARTIAL**, **BLOCKED**, **NOT TESTED**. Locale dictionaries, currency handling, timezone handling, and the document `lang` attribute are implemented and covered by the passing test suite.

## Verification Summary

| Area | Status | Notes |
|---|---|---|
| Locale dictionaries (en-US, id-ID) | **COMPLETE** | `src/lib/i18n/messages/en-us.ts` and `id-id.ts` |
| Currency handling (IDR / USD) | **COMPLETE** | Display conversion is indicative only; ledger settlement untouched |
| Timezone (Asia/Jakarta default) | **COMPLETE** | Stored timestamps remain UTC |
| Document `lang` attribute | **COMPLETE** | Set from `MARKET_CONFIGS[locale].htmlLang` in `src/app/layout.tsx` |
| Localized AI prompts and CV templates | **COMPLETE** | Prompt and template selection by locale |
| Additional regional markets | **NOT IMPLEMENTED** | Registry is extensible, but only two locales are shipped |

---

## Supported Locales and Defaults

- **Bahasa Indonesia (`id-ID`)**: Default application locale (`DEFAULT_LOCALE = "id-ID"`).
- **English (`en-US`)**: Global and international English locale.
- Users may switch language dynamically from either the top header bar toggle (`ID` / `EN`) or **Settings to Workspace Locale and Search Status** (`preferredLocale`).
- Preferences are persisted per user in `user_settings.preferred_locale` and mirrored in the `app_locale` HTTP cookie for SSR `<html lang>` consistency.
- **Status: COMPLETE.** The default `lang` value is `id` for `id-ID` and `en` for `en-US` (from `src/lib/i18n/index.ts` `MARKET_CONFIGS`).

---

## Translation Architecture (`src/lib/i18n/`)

Translations live strictly outside business rules and database state:

- `src/lib/i18n/types.ts`: Strong `TranslationMessages` schema defining UI navigation, actions, statuses, CV section headings, settings labels, and domain error messages.
- `src/lib/i18n/messages/id-id.ts`: Complete `id-ID` catalog.
- `src/lib/i18n/messages/en-us.ts`: Complete `en-US` catalog.
- `src/lib/i18n/index.ts`: Declarative `MARKET_CONFIGS`, `normalizeLocale`, `toAiLocale`, `getDefaultCvFormatForLocale`, runtime key lookup with missing key detection (`translate`), recursive translation completeness validator (`findMissingTranslationKeys`), and localized domain label helpers.
- `src/components/i18n/locale-provider.tsx`: Client React context exposing `useLocale()`, `useTranslations()`, and `useLocalizedFormatters()`.

**Status: COMPLETE.**

---

## Currency and Settlement Separation (`src/lib/i18n/currencies.ts`, `src/lib/format.ts`)

- **Defaults:** `IDR` for Indonesia (`DEFAULT_CURRENCY = "IDR"`), `USD` for the `en-US` market, plus configurable ISO-4217 currencies (`SGD`, `MYR`, `EUR`, `GBP`, `AUD`, `JPY`, or any valid 3 letter ISO currency code validated with `isValidIsoCurrencyCode`).
- **Display vs Financial Settlement:**
  - `formatMoney` renders locale aware numbers and minor units (`Intl.NumberFormat`).
  - `formatDisplayCurrencyConversion` returns indicative display estimates (`isIndicativeDisplay: true`, `isFinancialSettlement: false`) and never mutates stored ledger balances, credit costs, or payment settlement currencies.
- **Status: COMPLETE.** No live payment settlement is performed in this environment.

---

## Timezones and Localized Dates (`src/lib/format.ts`)

- **Default Timezone:** `Asia/Jakarta` (`DEFAULT_TIMEZONE`). The `en-US` market config defaults to `UTC`.
- Stored timestamps remain UTC instants; `formatDate`, `formatDateTime`, and `convertInstantToTimeZoneParts` (`@date-fns/tz` `TZDate` plus `Intl.DateTimeFormat`) convert and render dates in the user's selected locale and timezone without hydration mismatch.
- **Status: COMPLETE.**

---

## Localized AI Prompts and CV Templates

- `executeAiTask` (`src/server/ai/router/ai-task-router.ts`) automatically selects Indonesian (`src/server/ai/prompts/id`) or English (`src/server/ai/prompts/en`) prompt templates from `userSettings.preferredLocale` whenever a task does not pass an explicit `locale` override.
- `generateTailoredCvWithAiService` defaults to `indonesian_cv` for `id-ID` and `international_resume` for `en-US`.
- `cv-exporter.ts` outputs localized section headings and metadata (`RINGKASAN PROFESIONAL` / `Teknologi:` vs `PROFESSIONAL SUMMARY` / `Technologies:`) cleanly across TXT, PDF, and DOCX exports.
- **Status: COMPLETE** for selection and export logic. Live AI provider calls are **NOT TESTED** in this environment.
