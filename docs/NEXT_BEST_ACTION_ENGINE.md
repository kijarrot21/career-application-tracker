# Next Best Action Engine

## Purpose

Deterministically select the most relevant user action from real records and
Stage 1/2 outputs. No AI or LLM is used for ranking.

## Inputs

- `WorkflowPlan` from Stage 2 (which contains Stage 1 `ProgressSnapshot`).
- Minimal `RecommendationFacts` from `src/server/queries/recommendations.ts`:
  open follow-ups, scheduled interviews, pending assessments, pending offers,
  no-response status reviews, applications without linked CV, and expiring
  archives.
- `today` from `todayInTimeZone(settings.timezone)`.

`src/server/queries/dashboard-insights.ts` fetches the plan and facts once per
request, then calls `buildNextBestActions`.

## Rules and priorities

| Priority | Action IDs | Trigger |
| --- | --- | --- |
| 1 | `P1-OVERDUE-FOLLOWUP`, `P1-DUE-FOLLOWUP`, `P1-UPCOMING-INTERVIEW`, `P1-PENDING-ASSESSMENT`, `P1-OFFER-DECISION` | Real follow-up due dates (overdue or within 2 days), scheduled interview within 3 days, pending assessment/offer |
| 2 | `P2-COMPLETE-PROFILE`, `P2-UPLOAD-CV` | Stage 2 recommends those stages |
| 3 | `P3-DISCOVER-JOBS`, `P3-EVALUATE-JOB`, `P3-BUILD-SHORTLIST`, `P3-CREATE-APPLICATION` | Stage 2 recommends those stages |
| 4 | `P4-UPDATE-STATUS`, `P4-UPDATE-DOCUMENTS`, `P4-REVIEW-ARCHIVE` | `evaluateNoResponseSuggestion`, missing CV link, `evaluateRetentionState` expiring/expired |

Setup/workflow recommendations come only from Stage 2; the engine does not
re-implement dependency rules. Sample records and non-actionable statuses are
excluded by the facts query.

## Ordering

Comparator tuple: priority ascending, overdue before due/upcoming, earliest
`dueDate` (null last), existing domain urgency, stable `actionId`. Candidates
are sorted before deduplication so the earliest/most urgent record wins per
action ID. Identical inputs with supplied `evaluatedAt` produce identical output.

Blocked Stage 2 actions and routes not in `DEFAULT_AVAILABLE_ROUTES` are filtered
out; emitted actions have `isAvailable: true`.

## Output

`NextBestAction` fields: `actionId`, `title`, `description`, `priority`,
`category`, `reason`, `targetRoute`, `completionCondition`, `dueDate`,
`entityReference`, `isAvailable`.

`NextBestActionResult`: `primary`, `secondary`, `urgent`, `reasons`,
`progressContext`, `evaluatedAt`, `emptyStateReason`.

## Verified routes

`/profile`, `/documents`, `/jobs/new`, `/jobs`, `/shortlist`, `/applications`,
`/applications/:id`, `/interviews`, `/archive/:id`, `/dashboard`.

## Tests

`tests/unit/recommendations.test.ts` and
`tests/integration/recommendations.test.ts` cover each rule, priority order,
all tie-break levels, missing deadlines, unavailable routes, blocked actions,
dedupe, determinism, archived/deleted records, empty state, and user isolation.
Full suite result: 298 passed, 9 skipped.

## Known limitations

- UTC instants are sliced before comparing to a timezone-aware `today`;
  boundary-day dates can be wrong for UTC+7/8 users.
- `domainUrgencyRank` parses generated prose (`expired`, `(\d+) days`) for
  P4 ordering; copy changes can alter ranking.
- No dedicated vacancy-deadline action; that remains in the existing
  notification system.
- `MODULE_AVAILABILITY` is all-true; unsupported-module behavior is verified
  only in unit fixtures.
