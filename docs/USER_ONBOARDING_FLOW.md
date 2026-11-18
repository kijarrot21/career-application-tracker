# User Onboarding Flow

## New user

1. `requireUser()` creates `user_settings` and 13 default stages.
2. `getDashboardInsights()` returns 0% progress, stage 2 plan recommending
   `career_profile`, and primary action `P2-COMPLETE-PROFILE`.
3. Getting Started widget shows the empty checklist; Next Best Action card
   links to `/profile`.
4. Contextual help on each module explains purpose, fields, outcome, stage, and
   next action.
5. Resume Guided Setup opens the wizard at the first unfinished stage.

## Populated user

Progress is recalculated from business records. Completed stages are omitted
from recommendations. If all applicable stages are complete and no P1/P4 action
exists, the dashboard shows the empty state.

## Guided Setup Wizard

- Step source: onboarding `currentPosition`, then workflow
  `recommendedNextStages`, then the registry fallback.
- Completed business stages are never shown again as pending tutorial steps.
- Tutorial completion and skipped sections are separate from business
  completion; both are persisted through onboarding services.
- Controls: Continue (marks tutorial section done), Skip, Resume later, Exit,
  Restart. Navigation CTA goes to the module's verified route.
- If a destination is unavailable, the wizard shows a fallback message and
  still allows Continue/Skip.

## Product Tour

- Start/restart entry point is Settings; header buttons were removed at user
  request to reduce visual clutter.
- Steps: workspace navigation, global search, Getting Started, Next Best
  Action, add vacancy. Route transition to `/jobs` is handled by `router.push`.
- Spotlight uses a non-blocking overlay; tooltip is a non-modal dialog.
- Keyboard: Escape exits, ArrowRight advances, ArrowLeft goes back. Focus
  returns to the prior element on close.
- Missing targets retry, then show a fallback message; the page is never
  blocked.

## Dismissal and restart

- Dismissing Getting Started adds `dashboard:getting_started` to dismissed
  reminders. Recommendations remain active.
- Restarting guided setup resets tutorial fields only. Business records and
  Stage 1 progress are unchanged.
- Restarting the product tour clears tour keys and starts at `navigation`; it
  opens the tour through `product-tour:start`.

## Contextual help

Available on profile, CV studio, documents, job discovery, shortlist,
applications, interviews/assessments, and archive. Suitability and offers are
covered inside jobs/applications help text. Content is localized through the
existing `TranslationMessages` catalogs.
