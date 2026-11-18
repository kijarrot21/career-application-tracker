# User Onboarding Test Plan and Results

## Commands executed

- `npm run typecheck` — passed.
- `npm test` — 41 files passed, 1 skipped; 298 tests passed, 9 skipped.
- `npm run build` — passed; dashboard and settings remain dynamic.
- `npm run test:e2e` — 3 passed, 1 failed.
- `npm run lint` — fails on pre-existing `.ua/.trash-*/tmp/*.js` scratch files
  (`@typescript-eslint/no-require-imports`, 17 errors / 11 warnings). Stage 1-8
  files pass scoped ESLint.

## Coverage map

| Area | Tests |
| --- | --- |
| Progress stages, percentage, evidence | `tests/unit/progress.test.ts`, `tests/integration/progress.test.ts` |
| Workflow rules, dependencies, cycles | `tests/unit/workflow.test.ts`, `tests/integration/workflow.test.ts` |
| Recommendation rules, priorities, tie-break, routes | `tests/unit/recommendations.test.ts`, `tests/integration/recommendations.test.ts` |
| Onboarding state, skip/resume/restart/dismiss/version | `tests/unit/onboarding.test.ts`, `tests/integration/onboarding.test.ts`, `tests/integration/onboarding-settings.test.ts` |
| Dashboard composition and UI wiring | `tests/integration/dashboard-insights.test.ts`, `tests/unit/dashboard-guidance.test.ts` |
| Guided setup selection and persistence | `tests/unit/guided-setup.test.ts`, `tests/integration/guided-setup.test.ts` |
| Product tour steps, persistence, anchors | `tests/unit/product-tour.test.ts`, `tests/integration/product-tour.test.ts` |
| Contextual help and localization | `tests/unit/contextual-help.test.ts`, `tests/integration/localization.test.ts` |
| Existing regression suite | full `npm test`, `npm run test:e2e` |

Functional scenarios covered include empty account, populated account,
incomplete profile, CV present/deleted, vacancies, evaluations, shortlist,
applications, overdue follow-ups, interviews, assessments, offers, archives,
skipped/resumed/restarted onboarding, dismissal, multiple recommendations, user
isolation, and no-impact-on-progress checks.

## E2E result detail

- Passed: sign-in accessibility landmarks, authenticated shell labels, full core
  journey.
- Failed: `tests/e2e/accessibility.spec.ts:63` "sign-in form is keyboard
  operable (Enter submits)". Expected body text matching
  `/invalid|incorrect|error/i`; observed "Signing in..." after submit. Sign-in
  files are unmodified by Stages 1-9. Classified as pre-existing/unrelated.
- Existing `core-journey.spec.ts:130` hardcodes `APP-0005`; sample sequence
  changes could break it.

## Gaps

- UI behavior is largely verified by source-string assertions, not real DOM
  interaction. No E2E for stages 5-8 wizard/tour/help/dismiss flows.
- No axe/contrast/reduced-motion checks. Playwright is chromium desktop only;
  responsive checks assert one visible element plus screenshot.
- No measured coverage provider or thresholds.
- No negative action-layer authorization tests; isolation is asserted through
  `userId`-scoped service results.
- Date-window boundary tests (0/1/2/3 days, DST/month rollover) are limited.
- Corrupt `onboarding_state` fallback is implemented but untested.
- Timezone boundary defect in `getRecommendationFacts` is documented in design
  docs, not fixed in Stage 9.
