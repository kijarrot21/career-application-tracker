# User Onboarding Design (Stages 1-9)

## Intent

Guide users through the existing Career Application Tracker workflow without
turning tutorial activity into business progress. Actual completion always comes
from recorded application data. Onboarding state stores UX preferences only.

## Architecture

Layers, from pure to stateful:

1. Domain (`src/lib/domain/`): `progress`, `workflow`, `recommendations`,
   `onboarding`, `guided-setup`, `product-tour`, `contextual-help`.
2. Queries (`src/server/queries/`): user-scoped reads in `progress.ts`,
   `recommendations.ts`, `onboarding.ts`, `dashboard-insights.ts`.
3. Services (`src/server/services/`): `detectProgress`, `getWorkflowPlan`,
   `getNextBestActions`, onboarding/tour operations.
4. Actions (`src/server/actions/onboarding.ts`): authenticated writes.
5. UI (`src/components/`): dashboard guidance, guided setup wizard, product
   tour, contextual help, onboarding settings.

No component recomputes progress, dependency, or recommendation rules. UI
consumes the typed outputs of the services.

## Verified routes

`/profile`, `/documents`, `/cv-studio`, `/jobs`, `/jobs/new`, `/jobs/:id`,
`/shortlist`, `/applications`, `/applications/:id`, `/interviews`, `/archive`,
`/archive/:id`, `/emails`, `/dashboard`, `/settings`. All help and tour links
resolve to existing route files.

## Completion rules

Stage 1 derives completion from real records: profile `isReadyForAi`, stored CV
version with file key, saved vacancy, scored evaluation, shortlisted vacancy,
submitted application, tracking activity, and offer/closure outcome. Sample data
is excluded. Archived closure records count only while `status = "archived"`.

Stage 2 classifies dependencies as required, recommended, optional,
independent, or unavailable. Only genuine FK/service prerequisites block
actions. Incomplete optional stages never block access.

Stage 3 ranks actions: P1 time-sensitive, P2 setup, P3 application workflow, P4
maintenance. Tie-break: priority, overdue before upcoming, earliest due date,
existing domain urgency, stable action ID.

## Persistence model

`user_settings.onboarding_state` JSONB (migration 0008) stores version, mode,
welcome viewed, guided setup started, current position, completed/skipped
sections, dismissed reminders, last activity, and completion timestamps. Tour
progress uses `product_tour:*` keys inside `dismissedReminders`; no extra table.

Local PGlite persistence is supported and tested. Cloud PostgreSQL uses the same
schema/migration but is untested here. `user_settings` is not a sync entity, so
onboarding state does not follow users across devices automatically.

## Non-goals

No new navigation, no AI recommendation calculation, no duplicate progress
table, no forced tutorial gates, and no reset of application data on restart.

## Known limitations

- Time-sensitive facts convert UTC instants with `.toISOString().slice(0, 10)`
  while `today` uses the user timezone; boundary-day dates can be off for UTC+7/8.
- Tour and wizard DOM behavior is covered mostly by static/unit tests; Playwright
  does not yet exercise stages 5-8 UI.
- `user_settings` is not in `SYNC_ENTITY_TYPES`; no cross-device sync assumed.
- JSONB state is read-modify-written (last-write-wins across tabs).
