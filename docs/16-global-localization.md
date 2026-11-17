# Phase 9: Global Localization & Regional Readiness

## Supported Locales & Defaults

- **Bahasa Indonesia (`id-ID`)**: Default application locale (`DEFAULT_LOCALE = "id-ID"`).
- **English (`en-US`)**: Global / international English locale.
- Users may switch language dynamically from either the top header bar toggle (`ID` / `EN`) or **Settings → Workspace Locale & Search Status** (`preferredLocale`).
- Preferences are persisted per user in `user_settings.preferred_locale` and mirrored in the `app_locale` HTTP cookie for SSR `<html lang>` consistency.

---

## Translation Architecture (`src/lib/i18n/`)

Translations live strictly outside business rules and database state:

- `src/lib/i18n/types.ts`: Strong `TranslationMessages` schema defining UI navigation, actions, statuses, CV section headings, settings labels, and domain error messages.
- `src/lib/i18n/messages/id-id.ts`: Complete `id-ID` catalog.
- `src/lib/i18n/messages/en-us.ts`: Complete `en-US` catalog.
- `src/lib/i18n/index.ts`: Declarative `MARKET_CONFIGS`, `normalizeLocale`, `toAiLocale`, `getDefaultCvFormatForLocale`, runtime key lookup with missing-key detection (`translate`), recursive translation completeness validator (`findMissingTranslationKeys`), and localized domain label helpers.
- `src/components/i18n/locale-provider.tsx`: Client React context exposing `useLocale()`, `useTranslations()`, and `useLocalizedFormatters()`.

---

## Currency & Settlement Separation (`src/lib/i18n/currencies.ts`, `src/lib/format.ts`)

- **Defaults**: `IDR` for Indonesia, `USD` as initial global currency, plus configurable ISO-4217 currencies (`SGD`, `MYR`, `EUR`, `GBP`, `AUD`, `JPY`, or any valid 3-letter ISO currency code validated with `isValidIsoCurrencyCode`).
- **Display vs Financial Settlement**:
  - `formatMoney` renders locale-aware numbers and minor units (`Intl.NumberFormat`).
  - `formatDisplayCurrencyConversion` returns indicative display estimates (`isIndicativeDisplay: true`, `isFinancialSettlement: false`) and never mutates stored ledger balances, credit costs, or payment settlement currencies.

---

## Timezones & Localized Dates (`src/lib/format.ts`)

- **Default Timezone**: `Asia/Jakarta` (`DEFAULT_TIMEZONE`).
- Stored timestamps remain UTC instants; `formatDate`, `formatDateTime`, and `convertInstantToTimeZoneParts` (`@date-fns/tz` `TZDate` + `Intl.DateTimeFormat`) convert and render dates in the user's selected locale and timezone without hydration mismatch.

---

## Localized AI Prompts & CV Templates

- `executeAiTask` (`src/server/ai/router/ai-task-router.ts`) automatically selects Indonesian (`src/server/ai/prompts/id`) or English (`src/server/ai/prompts/en`) prompt templates from `userSettings.preferredLocale` whenever a task does not pass an explicit `locale` override.
- `generateTailoredCvWithAiService` defaults to `indonesian_cv` for `id-ID` and `international_resume` for `en-US`.
- `cv-exporter.ts` outputs localized section headings and metadata (`RINGKASAN PROFESIONAL` / `Teknologi:` vs `PROFESSIONAL SUMMARY` / `Technologies:`) cleanly across TXT, PDF, and DOCX exports.
