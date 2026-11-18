# Deterministic Next Best Action Engine (Stage 3)

The engine recommends one primary action plus supporting actions from actual
user records and workflow state. It uses no AI/LLM, stores no state, and does
not reimplement Stage 1 progress or Stage 2 dependency logic.

## Modules

| File | Responsibility |
| --- | --- |
| `src/lib/domain/recommendations.ts` | Typed action model, rule definitions, deterministic comparator, pure engine |
| `src/server/queries/recommendations.ts` | Minimal user-scoped facts for time-sensitive and maintenance rules |
| `src/server/services/recommendations.ts` | Composes Stage 2 `getWorkflowPlan` with facts in one parallel read |
| `tests/unit/recommendations.test.ts` | Rules, priorities, tie-breaking, availability, determinism |
| `tests/integration/recommendations.test.ts` | Data-driven scenarios on in-memory PGlite |

## Recommendation rules

| Priority | Action ID | Trigger |
| --- | --- | --- |
| 1 | `P1-OVERDUE-FOLLOWUP` | Open follow-up due before today (existing `isFollowUpOverdue`) |
| 1 | `P1-DUE-FOLLOWUP` | Open follow-up due within 2 days (existing notification window) |
| 1 | `P1-UPCOMING-INTERVIEW` | Scheduled interview within 3 days (existing notification window) |
| 1 | `P1-PENDING-ASSESSMENT` | Assessment with `result = "pending"`; uses actual `dueAt` if present |
| 1 | `P1-OFFER-DECISION` | Offer with `decision = "pending"`; uses actual `responseDeadline` if present |
| 2 | `P2-COMPLETE-PROFILE` | Stage 2 recommends `career_profile` |
| 2 | `P2-UPLOAD-CV` | Stage 2 recommends `cv_upload` |
| 3 | `P3-DISCOVER-JOBS` | Stage 2 recommends `job_discovery` |
| 3 | `P3-EVALUATE-JOB` | Stage 2 recommends `suitability_evaluation` |
| 3 | `P3-BUILD-SHORTLIST` | Stage 2 recommends `shortlist` |
| 3 | `P3-CREATE-APPLICATION` | Stage 2 recommends `job_application` |
| 4 | `P4-UPDATE-STATUS` | `evaluateNoResponseSuggestion` returns `shouldSuggest` for an active application |
| 4 | `P4-UPDATE-DOCUMENTS` | Active application has no CV version/link while a CV exists |
| 4 | `P4-REVIEW-ARCHIVE` | Archived closure where `evaluateRetentionState` is `expiring_soon` or `expired` |

Time-sensitive and maintenance rules only emit when their corresponding Stage 2
action is available. If a Stage 2 rule genuinely blocks an action, the
recommendation is omitted rather than shown as non-actionable. Unknown or
unavailable target routes are also omitted; all emitted actions have
`isAvailable: true`.

Assessments and offers have no project-defined urgency window, so they use only
their stored dates (which may be `null`) and never invent a deadline.

## Deterministic ordering

Candidates are sorted by:

1. Priority (1 → 4)
2. Overdue before due/upcoming before no due date
3. Earliest `dueDate` (null last)
4. Existing domain urgency (retention `expired` before `expiring_soon`; higher no-response silent days first)
5. Stable `actionId` ascending

Sorting happens before deduplication, so the earliest/most urgent supporting
record wins for a given action ID. Identical input data produces identical
output when `evaluatedAt` is supplied. Timestamps produced internally by Stage
1 (`progressCalculatedAt`) are generation times, not recommendation logic.

## Data model

Each `NextBestAction` contains `actionId`, `title`, `description`, `priority`,
`category`, `reason`, `targetRoute`, `completionCondition`, `dueDate`,
`entityReference`, and `isAvailable`.

The result contains `primary`, `secondary`, `urgent`, `reasons`,
`progressContext`, `evaluatedAt`, and `emptyStateReason`. When no action is
valid, `primary` is `null`, all arrays are empty, and `emptyStateReason`
explains that no time-sensitive or maintenance action is due.

## Integrity and performance

- All fact queries are user-scoped and exclude sample data; soft statuses
  (`status`, `result`, `decision`, closure `status`) prevent completed, deleted,
  or restored records from appearing as active tasks.
- Stage 2's `getWorkflowPlan` is called once per request; facts are loaded in
  parallel with it via `Promise.all`. Only columns needed for rules are read.
- No caching layer is introduced: recommendations are recalculated on every
  call, consistent with the project's dynamic pages.

## Known limitations

- "Upcoming" windows are reused from `getNotificationsSummary` (2 days for
  follow-ups, 3 days for interviews); they are duplicated as constants in the
  domain module rather than exported from the query module.
- No dedicated vacancy-deadline recommendation was added; that remains covered
  by the existing notification system.
