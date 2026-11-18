# Phase 11: Test Coverage Matrix

**Date:** 2026-11-17 · **Official execution:** Vitest 125/125 PASS + Playwright 1/1 PASS + typecheck/lint/build PASS

Counts below are scenario definitions per file derived from source (`it(`/`test(` declarations); the official runner total was 125 at Phase 11 signing.

> **Stage 1-9 addendum (2026-11-18):** the current full Vitest run is 298 passed and 9 skipped across 42 files. New suites cover progress, workflow, recommendations, onboarding, dashboard insights, guided setup, product tour, contextual help, and onboarding settings. See `docs/USER_ONBOARDING_TEST_PLAN.md` for the current matrix. Playwright currently reports 3 passed and 1 pre-existing sign-in assertion failure; the Phase 11 numbers in this historical matrix are not the current gate.

## 1. File-Level Matrix

| Test ID | File | Module(s) | Type | Scenarios | Status | Evidence |
|---|---|---|---|---|---|---|
| QA-U-01 | `tests/unit/domain.test.ts` | Cross-cutting domain (KPI, stages, business days, duplicates) | Unit | 8 | PASS | Vitest run 2026-11-17 15:28 |
| QA-U-02 | `tests/unit/phase1-archive.test.ts` | A. Archive | Unit | 3 | PASS | idem |
| QA-U-03 | `tests/unit/phase2-career-profile.test.ts` | B. Career Profile | Unit | 2 | PASS | idem |
| QA-U-04 | `tests/unit/phase3-ai.test.ts` | C. AI Engine | Unit | 5 | PASS | idem |
| QA-U-05 | `tests/unit/phase3-email.test.ts` | Email classifier | Unit | 4 | PASS | idem |
| QA-U-06 | `tests/unit/phase4-ai-career.test.ts` | D. AI Career Features | Unit | 3 | PASS | idem |
| QA-U-07 | `tests/unit/phase4-storage.test.ts` | Storage validation | Unit | 3 | PASS | idem |
| QA-U-08 | `tests/unit/phase5-analytics.test.ts` | Analytics KPI | Unit | 3 | PASS | idem |
| QA-U-09 | `tests/unit/phase5-credits.test.ts` | E. Credits | Unit | 2 | PASS | idem |
| QA-U-10 | `tests/unit/phase6-payments.test.ts` | F. Payments | Unit | 2 | PASS | idem |
| QA-U-11 | `tests/unit/phase7-sync.test.ts` | G. Sync | Unit | 6 | PASS | idem |
| QA-U-12 | `tests/unit/phase8-api.test.ts` | H. API | Unit | 4 | PASS | idem |
| QA-U-13 | `tests/unit/phase9-localization.test.ts` | I. Localization | Unit | 7 | PASS | idem |
| QA-U-14 | `tests/unit/phase10-security.test.ts` | K. Security | Unit | 14 | PASS | idem |
| QA-I-01 | `tests/integration/ai-career-features.test.ts` | D | Integration | 4 | PASS | idem |
| QA-I-02 | `tests/integration/ai-engine.test.ts` | C | Integration | 3 | PASS | idem |
| QA-I-03 | `tests/integration/api-v1.test.ts` | H | Integration/API | 7 | PASS | idem |
| QA-I-04 | `tests/integration/archive.test.ts` | A | Integration/DB | 7 | PASS | idem |
| QA-I-05 | `tests/integration/career-profile.test.ts` | B | Integration/DB | 5 | PASS | idem |
| QA-I-06 | `tests/integration/credits.test.ts` | E | Integration/DB | 3 | PASS | idem |
| QA-I-07 | `tests/integration/localization.test.ts` | I | Integration | 3 | PASS | idem |
| QA-I-08 | `tests/integration/payments.test.ts` | F | Integration | 3 | PASS | idem |
| QA-I-09 | `tests/integration/security.test.ts` | K | Integration/Security | 9 | PASS | idem |
| QA-I-10 | `tests/integration/services.test.ts` | Cross-cutting + isolation | Integration/DB | 7 | PASS | idem |
| QA-I-11 | `tests/integration/sync.test.ts` | G | Integration | 8 | PASS | idem |
| QA-E-01 | `tests/e2e/core-journey.spec.ts` | J (+ A to I traversal) | E2E | 1 | PASS | Playwright chromium, 6.1s, 2026-11-17 |

## 2. Security Regression Detail (Module K): all PASS

| ID | Scenario | Level | Status |
|---|---|---|---|
| SEC-01 | Creates and verifies a valid signed download token | Unit | PASS |
| SEC-02 | Rejects a tampered signed download token | Unit | PASS |
| SEC-03 | Rejects an expired signed download token | Unit | PASS |
| SEC-04 | Rejects malformed tokens | Unit | PASS |
| SEC-05 | Blocks EICAR antivirus test signature | Unit | PASS |
| SEC-06 | Blocks executable binary signatures disguised as documents | Unit | PASS |
| SEC-07 | Allows clean document buffers to pass | Unit | PASS |
| SEC-08 | Supports pluggable custom malware scanner hook | Unit | PASS |
| SEC-09 | Rejects active HTML/script tags in text uploads | Unit | PASS |
| SEC-10 | Enforces 10 MB document size limit | Unit | PASS |
| SEC-11 | Detects AI instruction-override attempts in untrusted text | Unit | PASS |
| SEC-12 | Neutralizes delimiter breakout attempts and control characters | Unit | PASS |
| SEC-13 | Redacts Indonesian NIK (KTP) and raw cloud API keys before external transmission | Unit | PASS |
| SEC-14 | Wraps untrusted data inside explicit passive XML delimiters | Unit | PASS |
| SEC-15 | User B cannot read, download, or delete User A's documents | Integration | PASS |
| SEC-16 | User B cannot access User A's applications or archive records | Integration | PASS |
| SEC-17 | Signed download URL authorizes document-version access | Integration | PASS |
| SEC-18 | Forged/tampered download tokens blocked | Integration | PASS |
| SEC-19 | EICAR upload rejected with no orphaned DB records | Integration | PASS |
| SEC-20 | Binary executable headers masquerading as PDF rejected | Integration | PASS |
| SEC-21 | Account deletion purges all DB records **and** disk storage (UU PDP Art. 8 / GDPR Art. 17) | Integration | PASS |
| SEC-22 | Complete JSON data export without leaking secrets (UU PDP Art. 7) | Integration | PASS |
| SEC-23 | Expired archive records purged per retention policy | Integration | PASS |

## 3. E2E Journey Detail

| ID | Scenario | Status | Evidence |
|---|---|---|---|
| E2E-01 | Sign-up → save vacancy → record submission → move stages (kanban) → classify emails → manage interviews & documents → responsive layout checks (desktop/tablet/mobile) | PASS | `playwright test`, 6.1s, 1 worker, chromium-1255 |

## 4. Coverage Gaps (feed the backlog)

| Gap | Module | Priority | Reference |
|---|---|---|---|
| Accessibility (WCAG), keyboard-only navigation | J | Medium | DEF-11-008 |
| Provider failure/retry/timeout paths beyond mocks | C | Medium | strategy §3 |
| Live cloud sync round-trip | G | Low (no env) | env matrix |
| Load/performance baselines | cross-cutting | Low | NOT TESTED |
