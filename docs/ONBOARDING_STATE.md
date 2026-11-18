# Onboarding State and Preference Service (Stage 4)

## Purpose

Stores UX-only onboarding preferences. **Actual workflow completion still comes
exclusively from Stage 1 Progress Detection**, which is derived from business
records. Nothing in this service can mark a business stage complete, and
restarting the tutorial never resets application data.

## Schema change (migration 0008)

One additive column on the existing 1:1 `user_settings` table:

```sql
ALTER TABLE "user_settings" ADD COLUMN "onboarding_state" jsonb
  DEFAULT '{"version":1,"mode":"self_paced","welcomeViewed":false,
             "guidedSetupStarted":false,"currentPosition":null,
             "completedSections":[],"skippedSections":[],
             "dismissedReminders":[],"lastActivityAt":null,"completedAt":null}'::jsonb
  NOT NULL;
```

No new table, no new enum, no destructive update, and no migration or reset of
existing user data. Existing rows receive the safe default above.

## Modules

| File | Responsibility |
| --- | --- |
| `src/lib/domain/onboarding.ts` | Version, modes, sections, Zod schemas, default state, pure transitions |
| `src/server/queries/onboarding.ts` | User-scoped read of `user_settings.onboarding_state` |
| `src/server/services/onboarding.ts` | All operations, validation, audit, user-scoped writes |
| `src/server/actions/onboarding.ts` | Authenticated server actions (`requireUser`) |
| `tests/unit/onboarding.test.ts`, `tests/integration/onboarding.test.ts` | Domain and persistence tests |

## Persisted fields

`version`, `mode` (`guided` / `self_paced`), `welcomeViewed`,
`guidedSetupStarted`, `currentPosition`, `completedSections`,
`skippedSections`, `dismissedReminders`, `lastActivityAt`, `completedAt`.

## Operations

`initializeOnboarding`, `getOnboardingPreferences`, `markWelcomeViewed`,
`startGuidedSetup`, `updateTutorialPosition`, `completeTutorialSection`,
`skipTutorialSection`, `resumeGuidedSetup`, `dismissOnboardingReminder`,
`completeTutorial`, `restartTutorial`, `setOnboardingVersion`.

Every service operation takes `userId` as its first argument, validates inputs
with Zod, scopes reads/writes with `eq(userSettings.userId, userId)`, writes an
audit entry (`entityType: "user_onboarding"`, `action: create|update`), and is
exposed through a server action that obtains identity from `requireUser()`.
Clients never supply a `userId`.

## Persistence modes

| Mode | Support |
| --- | --- |
| Local embedded PGlite (`DATABASE_URL` empty) | Fully supported and tested. Data persists to `PGLITE_DATA_DIR` (default `./.data/pglite`); `memory://` / `NODE_ENV=test` is ephemeral. |
| Cloud PostgreSQL / Supabase (`DATABASE_URL` set) | Same schema and migration apply via `postgres-js`; not exercised in this repository (no cloud environment). |
| Hybrid sync | **Not supported for onboarding state.** `user_settings` is not in `SYNC_ENTITY_TYPES`, so it is never queued in the sync outbox. Preferences do not follow a user to another device automatically. Enabling that would require a sync enum change, a migration, and live cloud validation. |

There is no local `localStorage` onboarding flag; the theme is the only existing
client-side preference and was left unchanged.

## Edge cases

- Malformed stored JSON falls back to the documented default rather than failing.
- Re-running `ensureUserInitialized` (sign-in / session refresh) does not
  overwrite saved preferences.
- Skipping a section records it as skipped, never as completed.
- Completing or restarting the tutorial only changes onboarding fields.
- Outdated versions are reported via `isOutdated`; version updates are explicit
  service operations.

## Known limitations

- Stage 4 originally delivered service/action layers only. Stages 5-8 wired
  these operations into the dashboard guidance widget, guided setup wizard,
  product tour, contextual help, and onboarding settings.
- Cross-device onboarding state is intentionally absent until hybrid sync is
  proven for `user_settings`.
- The JSONB state is read-modify-written; simultaneous writes from multiple
  tabs are last-write-wins (acceptable for UX preferences).
