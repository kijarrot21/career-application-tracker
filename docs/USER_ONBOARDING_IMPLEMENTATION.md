# User Onboarding Implementation

## Files created (Stages 1-8)

- Domain: `src/lib/domain/progress.ts`, `workflow.ts`, `recommendations.ts`,
  `onboarding.ts`, `guided-setup.ts`, `product-tour.ts`, `contextual-help.ts`.
- Queries: `src/server/queries/progress.ts`, `recommendations.ts`,
  `onboarding.ts`, `dashboard-insights.ts`.
- Services: `src/server/services/progress.ts`, `workflow.ts`,
  `recommendations.ts`, `onboarding.ts`.
- Actions: `src/server/actions/onboarding.ts`.
- UI: `src/components/dashboard/dashboard-guidance.tsx`,
  `guided-setup-wizard.tsx`, `src/components/layout/product-tour.tsx`,
  `src/components/help/contextual-help.tsx`,
  `src/components/settings/onboarding-settings-card.tsx`.
- Localization: `src/lib/i18n/types.ts`, `messages/en-us.ts`, `messages/id-id.ts`.
- Tests: 8 unit files and 8 integration files under `tests/`.
- Docs: `PROGRESS_DETECTION.md`, `WORKFLOW_RULES.md`, `NEXT_BEST_ACTION.md`,
  `ONBOARDING_STATE.md`, plus Stage 9 docs.

## Modified existing files

Dashboard page and client, app layout and shell, sidebar, settings page and
client, eight module page clients, DB schema `core.ts`, migration journal, and
i18n catalogs. `src/server/services/credits.ts` and `payments.ts`, plus
`tests/integration/postgres-lock.test.ts` and `.ua/` are pre-existing user work
and were not touched.

## Database change

Migration `0008_dapper_newton_destine.sql` adds one JSONB column to
`user_settings` with a default matching `DEFAULT_ONBOARDING_STATE`. No data
destruction, no new progress table, no enum change.

## Service contracts

- `detectProgress(userId)` returns `ProgressSnapshot`.
- `getWorkflowPlan(userId)` returns `WorkflowPlan`.
- `getNextBestActions(userId)` returns `NextBestActionResult`.
- `getDashboardInsights(userId)` composes all three plus onboarding state once.
- `getOnboardingPreferencesService(userId)` returns state, version, outdated flag.
- Onboarding write operations are first-argument `userId`, Zod-validated,
  user-scoped, audited, and exposed only through `requireUser()` actions.

## UI wiring

Dashboard guidance consumes `getDashboardInsights`. Guided setup consumes the
same snapshot and Stage 4 actions. Product tour listens for
`product-tour:start`. Contextual help uses `HELP_MODULES` and localized strings.
Onboarding settings displays status and `detectProgress` output.

## Localization

All new user-facing help and onboarding strings use existing
`TranslationMessages` keys in both `id-ID` and `en-US`. No separate
localization mechanism was added.
