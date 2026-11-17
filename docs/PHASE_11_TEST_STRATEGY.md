# Phase 11: Test Strategy

**Date:** 2026-11-17 · **Status:** Approved plan, executed 2026-11-17

## 1. Objectives

1. Verify every Phase 0–10 feature claim against executable evidence.
2. Establish a repeatable, zero-baseline-failure quality gate.
3. Classify all defects with reproducible evidence; fix only with owner approval.
4. Report honestly: never report an unexecuted test as PASS.

## 2. Test Pyramid & Tools

| Layer | Tool | Command | Database | External services |
|---|---|---|---|---|
| Unit | Vitest 5.1.0 | `npm run test` (subset) | in-memory PGlite | mocked AI providers |
| Integration | Vitest 5.1.0 | `npm run test` | fresh in-memory PGlite + migrations + seeds per test | mocked AI/payment providers |
| E2E | Playwright 1.65.1 | `npm run test:e2e` | `PGLITE_DATA_DIR=memory://` on `next start -p 3105` | real browser, no network calls |
| Static | tsc / eslint | `npm run typecheck` / `npm run lint` | n/a | n/a |
| Build | Next.js (Turbopack) | `npm run build` | n/a | n/a |

No new dependencies are introduced. The existing isolated-DB helper (`tests/helpers/db.ts`) guarantees test runs cannot touch the live `.data/` PGlite database.

## 3. Test Data & Mock Policy

- All tests run against **ephemeral in-memory PGlite** with real Drizzle migrations and seed functions, closest-possible-to-production SQL semantics (composite FKs, transactions) without touching user data.
- Cloud AI providers are exercised through the provider abstraction with mock/recorded structured outputs; structured-output validation (Zod schemas) is tested regardless of provider.
- Payment providers: signature-verification logic tested against constructed payloads (Midtrans SHA-512, Stripe HMAC-SHA256). **No real gateways, no real money.**
- OAuth: PKCE/state/HMAC logic unit-tested; live provider flows BLOCKED without credentials.
- If a test requires unavailable credentials → status **BLOCKED**, never fabricated.

## 4. Execution Order (as executed)

1. Baseline: git state + full existing suite → **0 failures**
2. Unit + Integration (25 files / 125 tests)
3. API / database integrity, covered inside the integration layer (api-v1, services, migrations via per-test migrate)
4. Security regression (phase10-security: 14, security: 9)
5. E2E core journey (chromium)
6. Typecheck → Lint → Production build
7. Documentation update + defect classification

## 5. Environments

| Env | DB | Storage | Auth | AI | Sync | Notes |
|---|---|---|---|---|---|---|
| Local | PGlite (`PGLITE_DATA_DIR`, `DATABASE_URL` optional/empty) | local FS `storage/` | Better Auth cookies | local Ollama or mocked cloud | outbox + pull/push against v1 API | fully validated |
| Cloud | PostgreSQL via `postgres` driver; Drizzle migrations compatible | FS assumed, needs object storage review | same | cloud providers server-side keys | v1 sync endpoints | RLS absent (DEF-11-006); NOT TESTED live |
| Hybrid | local PGlite + cloud endpoints | both | device tokens | consent-gated cloud | conflict detection/resolution | logic validated (14 tests); live round-trip NOT TESTED |

Secrets policy: variable **names** only are documented (see `.env.example`); values are never read, printed, or modified.

## 6. Status Definitions

- **PASS**: executed and passed (with evidence)
- **FAIL**: executed and failed (with evidence)
- **BLOCKED**: cannot execute due to dependency/environment
- **NOT TESTED**: not executed in this phase
- **NOT APPLICABLE**: feature not implemented

## 7. Change Control

Fixes are applied one approved defect (or tightly-related group) at a time; after each fix: affected tests → regression tests → typecheck → lint. No unrelated refactoring. No commit/push/deploy without explicit approval.
