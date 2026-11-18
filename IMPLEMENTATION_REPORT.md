# Implementation Report: Career Application Tracker (Personal ATS)

**Repository:** `career-application-tracker` (Personal ATS), version `0.1.0` per `package.json`
**Report date:** 2026-11-18
**Scope:** consolidated, evidence-backed status of the delivered local-first MVP and the automated quality gates, plus the gaps that remain before cloud production operation.

---

## 1. Executive summary

This repository contains a working, local-first Personal Applicant Tracking System built on Next.js 16.4.6 (`package.json`, dependency `next: 16.4.6`). The original ATS feature set is intact, and Phases 1 through 11 added an application archive, a master career profile, a hybrid AI engine, AI career features and CV Studio, a credit economy, payment integration, local-cloud sync, REST API v1, en-US/id-ID localization, and security hardening. Phase 12 added an evidence-based roadmap, backlog, and release plan (`docs/DEVELOPMENT_ROADMAP.md`, `DEVELOPMENT_BACKLOG.md`, `docs/RELEASE_PLAN.md`).

**Evidence vocabulary used throughout this report:**

| Label | Meaning |
|---|---|
| **VERIFIED** | Code exists in `src/` and is covered by a named passing automated test in `tests/`, or is an executed quality gate with a recorded result. |
| **IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION** | Code and mocked or in-memory tests exist, but the live external dependency (cloud database, AI provider credentials, payment gateway, OAuth app) has not been exercised in the evidence available in this repository. |
| **NOT AVAILABLE** | No implementation exists, or the work is explicitly blocked or deferred by the project's own records. |

**Verified baseline (given and cross-checked against repository records):**

| Gate | Result | Evidence |
|---|---|---|
| Vitest unit and integration | 125/125 passing across 25 test files | `npm run test`; `tests/unit/**` (14 files) and `tests/integration/**` (11 files); per-file counts sum to 125 |
| Playwright E2E | 4/4 passing | `tests/e2e/core-journey.spec.ts` (1 test) and `tests/e2e/accessibility.spec.ts` (3 tests) |
| TypeScript strict | passing | `npm run typecheck` (`tsc --noEmit`) |
| ESLint | passing | `npm run lint` |
| Production build | passing | `npm run build` (`next build`, Turbopack) |
| GitHub Actions CI | successful run on commit `2a9540c` | `.github/workflows/ci.yml`; earlier green runs also recorded in `docs/RELEASE_PLAN.md` (commit `620f7d8`) and `docs/PHASE_PROGRESS_STATUS.md` |

The CI workflow runs `npm ci`, typecheck, lint, Vitest, production build, Playwright Chromium install, and E2E on pushes to `main` and on pull requests. It uses throwaway placeholder environment values and an in-memory PGlite data directory; no production secret is stored in the workflow (`.github/workflows/ci.yml`).

**Bottom line:** the local-first MVP and all automated gates are green. Live cloud sync, live AI providers, live payments, PostgreSQL row-level security, performance testing, and backup drills are untested or deferred. The chosen production readiness assessment is recorded in the final section.

---

## 2. Original features preserved

The baseline ATS functionality described in `README.md` remains present in the route tree under `src/app/(app)/` and in the corresponding components, services, and queries. Nothing in the Phase 1 to 12 work removed these features.

| Original feature | Evidence in source | Test evidence |
|---|---|---|
| Dashboard and command menu (`⌘K` / `Ctrl+K`) | `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/dashboard-client.tsx`, `src/components/layout/command-menu.tsx` | `tests/unit/phase5-analytics.test.ts`, `tests/e2e/core-journey.spec.ts` |
| Find Jobs with platform detection, duplicate warning, and 6-criteria suitability | `src/app/(app)/jobs/`, `src/components/jobs/`, `src/lib/domain/suitability.ts`, `src/lib/domain/duplicates.ts` | `tests/unit/domain.test.ts`, `tests/integration/services.test.ts` |
| Job Shortlist triage | `src/app/(app)/shortlist/page.tsx`, `src/components/jobs/shortlist-client.tsx` | `tests/integration/services.test.ts` |
| Applications Kanban and table with 13-stage pipeline and append-only history | `src/app/(app)/applications/`, `src/components/applications/`, `src/lib/domain/stages.ts`, `src/db/schema/applications.ts` | `tests/unit/domain.test.ts`, `tests/integration/services.test.ts`, `tests/e2e/core-journey.spec.ts` |
| Interviews, assessments, and offers | `src/app/(app)/interviews/page.tsx`, `src/db/schema/applications.ts` | `tests/integration/services.test.ts` |
| Email Center with deterministic classification and optional Gmail/Microsoft OAuth | `src/app/(app)/emails/page.tsx`, `src/lib/domain/email-classifier.ts`, `src/app/api/email/oauth/[provider]/` | `tests/unit/phase3-email.test.ts`, `tests/integration/security.test.ts` |
| Versioned document repository with per-user isolation | `src/app/(app)/documents/page.tsx`, `src/lib/storage.ts`, `src/app/api/documents/` | `tests/unit/phase4-storage.test.ts` |
| Analytics and reports with sample-data separation | `src/app/(app)/analytics/page.tsx`, `src/server/queries/analytics.ts`, `src/lib/domain/kpi.ts`, `src/app/api/export/analytics/route.ts` | `tests/unit/phase5-analytics.test.ts` |
| Settings, business-day follow-ups, pipeline customization, JSON/CSV export, and account deletion | `src/app/(app)/settings/page.tsx`, `src/server/actions/settings.ts`, `src/app/api/export/account/route.ts`, `src/app/api/export/applications/route.ts` | `tests/integration/security.test.ts`, `tests/integration/services.test.ts` |
| Authentication and sign-in/sign-up | `src/app/(auth)/`, `src/lib/auth.ts`, `src/app/api/auth/[...all]/route.ts` | `tests/e2e/core-journey.spec.ts` |

The 13-stage pipeline, `APP-0001` style application codes, business-day follow-up rules, duplicate URL detection, "No Response" confirmation, and UU PDP export/erasure behavior are documented in `README.md` and `docs/01-requirements-analysis.md` and are backed by `src/lib/domain/stages.ts`, `src/lib/domain/business-days.ts`, `src/lib/domain/duplicates.ts`, and `src/lib/domain/follow-ups.ts`.

---

## 3. New features implemented

All items in this section are **VERIFIED** unless a tier label says otherwise.

| Feature | Source of truth | Automated proof |
|---|---|---|
| Application archive (closure records, immutable snapshots with SHA-256 hash, retention, restore) | `src/server/services/archive.ts`, `src/db/schema/applications.ts`, `src/app/(app)/archive/` | `tests/unit/phase1-archive.test.ts` (3 tests), `tests/integration/archive.test.ts` (7 tests) |
| Master career profile (skills, experience, education, certifications, projects, protected verified fields) | `src/server/services/career-profile.ts`, `src/db/schema/career.ts` (6 tables) | `tests/unit/phase2-career-profile.test.ts` (2 tests), `tests/integration/career-profile.test.ts` (5 tests) |
| Hybrid AI engine (provider registry, task router, structured Zod output, consent gate, usage metadata) | `src/server/ai/providers/`, `src/server/ai/router/`, `src/server/ai/schemas/` | `tests/unit/phase3-ai.test.ts` (5 tests), `tests/integration/ai-engine.test.ts` (3 tests) |
| AI career features (CV parse/evaluate/correct/generate, job match, skill gap, roadmap; archive analysis backend and API are complete but the UI entry point is a disabled placeholder) | `src/server/ai/services/`, `src/server/actions/ai-career.ts`, `src/app/api/v1/archive/[id]/analyze/route.ts` | `tests/unit/phase4-ai-career.test.ts` (3 tests), `tests/integration/ai-career-features.test.ts` (4 tests) |
| CV Studio with native PDF and OOXML DOCX export and approval gate | `src/app/(app)/cv-studio/page.tsx`, `src/server/ai/exporters/cv-exporter.ts` | `tests/unit/phase4-ai-career.test.ts`, `tests/integration/ai-career-features.test.ts` |
| Credit wallet, ledger, reservations, pricing, idempotency | `src/server/services/credits.ts`, `src/db/schema/credits.ts` | `tests/unit/phase5-credits.test.ts` (2 tests), `tests/integration/credits.test.ts` (3 tests) |
| Payments (Midtrans and Stripe, checkout, webhooks, reconciliation, refund) | `src/server/services/payments.ts`, `src/server/payments/providers/`, `src/db/schema/payments.ts` | `tests/unit/phase6-payments.test.ts` (2 tests), `tests/integration/payments.test.ts` (3 tests) |
| Hybrid local-cloud sync (outbox, push, pull, resolve, status, conflict handling) | `src/server/services/sync.ts`, `src/app/api/v1/sync/`, `src/db/schema/sync.ts` | `tests/unit/phase7-sync.test.ts` (6 tests), `tests/integration/sync.test.ts` (8 tests) |
| REST API v1 with envelope, auth, Zod validation, rate limits, idempotency | `src/lib/api/v1.ts`, `src/server/api/v1-handler.ts`, `src/app/api/v1/` | `tests/unit/phase8-api.test.ts` (4 tests), `tests/integration/api-v1.test.ts` (7 tests) |
| Localization (en-US, id-ID, IDR, USD, Asia/Jakarta, localized AI prompts) | `src/lib/i18n/`, `src/components/i18n/locale-provider.tsx`, `src/server/ai/prompts/en/`, `src/server/ai/prompts/id/` | `tests/unit/phase9-localization.test.ts` (7 tests), `tests/integration/localization.test.ts` (3 tests) |
| Security hardening (CSP, HSTS, OAuth state TTL and constant-time compare, signed downloads, prompt guard, upload safeguards) | `next.config.ts`, `src/lib/crypto.ts`, `src/lib/storage.ts`, `src/server/ai/security/` | `tests/unit/phase10-security.test.ts` (14 tests), `tests/integration/security.test.ts` (9 tests) |
| Cross-cutting domain logic (KPI, stages, business days, duplicates, credits, payments, sync enums) | `src/lib/domain/`, `src/db/schema/enums.ts` | `tests/unit/domain.test.ts` (8 tests), `tests/integration/services.test.ts` (7 tests) |

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION:** the interview coach exists only as `src/server/ai/services/interview-coach.service.ts` with no action or UI wiring and no automated test (`DEVELOPMENT_BACKLOG.md`, item S4-06 and E-06). Credit package administration has schema, seed, read API, and a pricing update service, but no admin CRUD UI (`DEVELOPMENT_BACKLOG.md`, item S6-05). These are classified as PARTIAL or NOT TESTED by the project's own records, so they are not counted as completed features here.

---

## 4. Architecture changes

1. **Framework and runtime:** Next.js 16.4.6 App Router with React 19.3.0, Server Components, Server Actions, and Turbopack (`package.json`, `README.md`). TypeScript is strict (`npm run typecheck`).
2. **Database and ORM:** Drizzle ORM 0.45 with a dual mode embedded PGlite (default, `./.data/pglite`) or PostgreSQL via `DATABASE_URL` (`src/db/index.ts`, `src/lib/env.ts`, `README.md`). Eight SQL migrations live in `src/db/migrations/0000` through `0007` with matching snapshots in `src/db/migrations/meta/`.
3. **Layering:** the codebase separates UI (`src/components/`), route handlers (`src/app/api/`), server actions (`src/server/actions/`), services (`src/server/services/`), queries (`src/server/queries/`), domain logic (`src/lib/domain/`), and schema (`src/db/schema/`). This structure is documented in `docs/CURRENT_ARCHITECTURE.md`.
4. **Authentication and routing gate:** Better Auth 1.7 with database sessions and scrypt hashing (`src/lib/auth.ts`), plus a route proxy that protects app prefixes and API prefixes and permits short-lived HMAC download tokens (`src/proxy.ts`).
5. **AI subsystem:** a provider-agnostic router selects Ollama, OpenAI, or Gemini based on privacy mode, preference, configuration, and availability, enforces consent, and returns Zod-validated output (`src/server/ai/router/`, `src/server/ai/providers/`, `src/server/ai/schemas/`).
6. **Subsystem adapters:** payments use a neutral provider interface (`src/server/payments/providers/payment-provider.types.ts`); sync uses an outbox and event log (`src/db/schema/sync.ts`); document storage uses a swappable module with a malware-scan hook (`src/lib/storage.ts`).
7. **Automation:** `.github/workflows/ci.yml` runs typecheck, ESLint, unit tests, integration tests, production build, and Playwright E2E on push and pull request. The app is designed so unconfigured AI, payments, and sync never block core ATS use (`docs/RELEASE_PLAN.md`, section 1).

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION:** the PostgreSQL deployment path, object storage adapter, and background AI worker. Object storage and the worker are **NOT AVAILABLE** (`DEVELOPMENT_BACKLOG.md`, E-02 and E-13).

---

## 5. Database schema changes

Schema is defined across `src/db/schema/{enums,auth,core,applications,career,ai,credits,payments,sync,index}.ts` and materialized by eight migrations.

| Migration | New tables | Other changes |
|---|---|---|
| `0000_messy_komodo.sql` | 24 baseline tables: `user`, `session`, `account`, `verification`, `user_settings`, `application_stages`, `companies`, `recruiter_contacts`, `job_sources`, `job_vacancies`, `suitability_evaluations`, `applications`, `application_status_history`, `application_documents`, `documents`, `document_versions`, `interviews`, `assessments`, `follow_up_tasks`, `job_offers`, `email_accounts`, `email_communications`, `notifications`, `audit_logs` | Baseline enums, composite `(entity_id, user_id)` foreign keys, unique codes, and indexes |
| `0001_parallel_omega_flight.sql` | `application_closure_records`, `application_archive_snapshots`, `application_archive_documents` | Added `auto_archive_on_terminal`, `archive_retention_days`, `archive_auto_delete_expired` to `user_settings` |
| `0002_pretty_cloak.sql` | `career_profiles`, `career_experiences`, `career_educations`, `career_skills`, `career_certifications`, `career_projects` | Verification and source columns for AI import staging |
| `0003_modern_the_fury.sql` | `ai_prompt_versions`, `ai_analysis_jobs`, `ai_career_analyses`, `ai_analysis_sources`, `ai_feedback` | Added AI privacy, provider, Ollama endpoint/model, and cloud document consent columns to `user_settings` |
| `0004_hesitant_goblin_queen.sql` | `credit_wallets`, `credit_reservations`, `credit_ledger`, `credit_packages`, `ai_credit_pricing` | Added `pricing_key`, `credit_cost`, `credit_reservation_id` to `ai_analysis_jobs` |
| `0005_tiresome_siren.sql` | `payment_orders`, `payment_transactions`, `payment_webhook_events` | Provider references, expected amount, credits to grant, webhook event audit |
| `0006_reflective_venus.sql` | `sync_devices`, `sync_outbox`, `sync_checkpoints`, `sync_conflicts`, `sync_events` | Outbox idempotency, version tracking, monotonic event sequence, conflict queue |
| `0007_ordinary_lord_tyger.sql` | none | Added `user_settings.preferred_locale` (default `id-ID`) plus a length check constraint |

**VERIFIED:** tenant isolation is expressed in the schema through explicit `user_id` columns plus composite foreign keys such as `job_vacancies_company_fk` on `(company_id, user_id)` and `credit_ledger_wallet_fk` on `(wallet_id, user_id)`, with cascade deletes anchored to `user.id` (`0000` through `0006` SQL, `src/db/schema/*.ts`). Migrations apply from zero on PGlite through `tests/helpers/db.ts` (backlog item S10-04).

**NOT AVAILABLE:** PostgreSQL Row-Level Security policies. `docs/PHASE_11_DEFECT_REGISTER.md` DEF-11-006 records this as an owner-accepted deferral to a cloud hardening phase; cloud isolation currently relies on application-layer filters and composite foreign keys only.

---

## 6. API endpoints

All `/api/v1/*` handlers share `src/server/api/v1-handler.ts` and `src/lib/api/v1.ts`: a consistent `{ ok, apiVersion, requestId, data }` success envelope and `{ ok, error }` error envelope, `X-API-Version` and `X-Request-Id` headers, `Cache-Control: no-store`, Zod validation, per-user and per-scope rate limiting, optional `idempotency-key`, and error classification that deliberately hides raw SQL, paths, and secrets behind a generic 500 (`v1Error`, `classifyKnownError`). Authentication is via Better Auth session using `getOptionalUser()` (`src/lib/session.ts`, `src/proxy.ts`).

| Group | Routes (`src/app/api/`) | Verified by |
|---|---|---|
| Sync | `v1/sync/push`, `v1/sync/pull`, `v1/sync/resolve`, `v1/sync/status` | `tests/integration/sync.test.ts`, `tests/unit/phase7-sync.test.ts`, `tests/integration/api-v1.test.ts` |
| AI | `v1/ai/cv/parse`, `v1/ai/cv/evaluate`, `v1/ai/cv/correct`, `v1/ai/cv/generate`, `v1/ai/job-match`, `v1/ai/career-roadmap`, `v1/ai/jobs/[id]`, `v1/archive/[id]/analyze` | `tests/integration/api-v1.test.ts`, `tests/integration/ai-career-features.test.ts` |
| Credits | `v1/credits/wallet`, `v1/credits/ledger`, `v1/credits/packages` | `tests/integration/api-v1.test.ts`, `tests/integration/credits.test.ts` |
| Payments | `v1/payments/checkout`, `v1/payments/webhooks/[provider]`, plus legacy `payments/webhook/[provider]` | `tests/integration/api-v1.test.ts`, `tests/integration/payments.test.ts` |
| Archive | `v1/archive`, `v1/archive/[id]` | `tests/integration/archive.test.ts`, `tests/integration/api-v1.test.ts` |
| Documents | `documents/upload`, `documents/download`, `documents/versions/[versionId]/file` | `tests/unit/phase4-storage.test.ts`, `tests/integration/security.test.ts` |
| Export | `export/account`, `export/applications`, `export/analytics` | `tests/integration/security.test.ts`, `tests/unit/phase5-analytics.test.ts` |
| Email OAuth | `email/oauth/[provider]/start`, `email/oauth/[provider]/callback` | `tests/unit/phase10-security.test.ts`, `tests/integration/security.test.ts` |
| Auth | `auth/[...all]` (Better Auth) | `tests/e2e/core-journey.spec.ts` |

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION:** live callers outside the test harness, live webhook delivery from Midtrans or Stripe, and live OAuth callbacks from Google or Microsoft. These depend on credentials that the repository's records say were not available during verification (`docs/PHASE_11_DEFECT_REGISTER.md`, blocked-test register BLK-02 and BLK-03).

---

## 7. AI providers and verified capabilities

**VERIFIED capabilities:**

| Provider | Locality | Default model source | Evidence |
|---|---|---|---|
| Ollama | local | `OLLAMA_MODEL`, default `qwen2.5:7b`; endpoint `OLLAMA_BASE_URL`, default `http://127.0.0.1:11434` | `src/server/ai/providers/ollama.provider.ts`, `src/server/ai/providers/index.ts` |
| OpenAI | cloud | `OPENAI_MODEL`, default `gpt-4o-mini`; base URL `OPENAI_BASE_URL` | `src/server/ai/providers/openai.provider.ts`, `src/server/ai/providers/index.ts` |
| Gemini | cloud | `GEMINI_MODEL`, default `gemini-2.5-flash`; base URL `GEMINI_BASE_URL` | `src/server/ai/providers/gemini.provider.ts`, `src/server/ai/providers/index.ts` |

The router (`src/server/ai/router/provider-selector.ts`) enforces a `local_only` privacy boundary, applies a deterministic priority order of Ollama, then OpenAI, then Gemini, validates custom local endpoints against SSRF rules (`src/server/ai/security/endpoint-validator.ts`), and computes consent requirements. Consent is required for every task in `ask_before_each` mode and additionally before sending private career documents to a cloud provider when `cloudDocumentConsent` is false. Prompt-injection signals are detected and untrusted text is neutralized and wrapped in a passive `<untrusted_data>` block, with NIK and API-token redaction (`src/server/ai/security/prompt-guard.ts`). Outputs are validated against Zod schemas in `src/server/ai/schemas/`. Jobs record provider, model, prompt version tag, consent, input hash, credit cost, and usage metadata in `ai_analysis_jobs` (`src/db/schema/ai.ts`).

Eight task types are declared in `src/db/schema/enums.ts` and `0003_modern_the_fury.sql`: `cv_parse`, `cv_evaluate`, `job_match`, `cv_correction`, `cv_generate`, `skill_gap`, `career_roadmap`, and `interview_coach`. Services live in `src/server/ai/services/`. Tests: `tests/integration/ai-engine.test.ts`, `tests/integration/ai-career-features.test.ts`, `tests/unit/phase3-ai.test.ts`, `tests/unit/phase4-ai-career.test.ts`.

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION / NOT AVAILABLE:** real OpenAI and Gemini calls are blocked without credentials and paid credits (blocked-test register BLK-01 in `docs/PHASE_11_DEFECT_REGISTER.md`). Provider behavior is proven only with mocked `fetchFn` test doubles. Local Ollama behavior is likewise proven at the adapter and router level, not against a running Ollama server in the recorded evidence. `interview_coach` is service only and untested, so it is **NOT AVAILABLE** as a user-facing feature.

---

## 8. Credit and payment implementation

**VERIFIED credit implementation:**

- `src/server/services/credits.ts` uses `SELECT ... FOR UPDATE` row locks, optimistic compare-and-set on `credit_wallets.version`, and `(user_id, idempotency_key)` uniqueness on reservations and ledger entries. Reserve moves credits from `available_balance` to `reserved_balance`, capture decrements reserved and increments `lifetime_spent`, and release and refund are idempotent and append to the immutable `credit_ledger`. Tests: `tests/integration/credits.test.ts`, `tests/unit/phase5-credits.test.ts`.
- Note from source (`src/server/services/credits.ts`, header comment): row locking relies on SQL `FOR UPDATE` plus CAS in PostgreSQL, with a PGlite-specific accommodation. This is a database-dialect caveat, not a production verification of PostgreSQL concurrency.
- Pricing is database-driven via `ai_credit_pricing` and packages via `credit_packages` (`src/db/schema/credits.ts`, `src/db/seed/credits.ts`).

**VERIFIED payment implementation:**

- Midtrans webhook verification uses SHA-512 with `constantTimeHexEqual` (`src/server/payments/providers/midtrans.provider.ts`, line 216). Stripe verification uses HMAC-SHA256 with a replay window (`src/server/payments/providers/stripe.provider.ts`, line 219 and `PAYMENT_WEBHOOK_MAX_AGE_SECONDS` in `src/lib/env.ts`).
- `src/server/services/payments.ts` provides checkout order creation with idempotency deduplication, signature verification, replay protection, amount/currency mismatch rejection, idempotent credit grant on `paid`, reconciliation that avoids double-crediting, and refund clawback through the ledger. Tests: `tests/integration/payments.test.ts`, `tests/unit/phase6-payments.test.ts`.
- `PAYMENT_MODE` defaults to `disabled`; configure-check helpers reject live-looking keys (`Mid-server-` and `sk_live_`) in `src/lib/env.ts`.

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION / NOT AVAILABLE:** real Midtrans and Stripe processing is blocked by policy because real-money transactions are prohibited in the verification environment (BLK-02 in `docs/PHASE_11_DEFECT_REGISTER.md`). Only simulated provider responses and signature tests were exercised. `docs/DEVELOPMENT_ROADMAP.md` keeps `PAYMENT_MODE=disabled` until item E-05 passes with sandbox credentials.

---

## 9. Synchronization implementation

**VERIFIED:**

- Schema (`0006_reflective_venus.sql`, `src/db/schema/sync.ts`): `sync_devices` with per-user device keys and operation modes (`local_only`, `cloud_only`, `hybrid`), `sync_outbox` for queued local changes with base and target versions, hash, idempotency key, retry count, and status, `sync_checkpoints` for incremental cursors, `sync_conflicts` for explicit version conflicts, and append-only `sync_events` with a monotonic `seq`.
- `src/server/services/sync.ts` implements device registration, mode updates, revocation, change enqueueing, `processSyncPushBatchService`, pull, and conflict resolution. The push path checks idempotency before applying events, marks outbox entries as synced or conflict, rejects document-version overwrites, and detects version conflicts when `baseVersion` lags the authoritative cloud version.
- `src/lib/domain/sync.ts` and `src/db/schema/enums.ts` define entity types, operations, directions, and resolution statuses. Resolution supports keep-local, keep-cloud, and merged outcomes.
- API routes `src/app/api/v1/sync/{push,pull,resolve,status}/route.ts` are covered by `tests/integration/sync.test.ts` (8 tests) and `tests/unit/phase7-sync.test.ts` (6 tests), with additional API checks in `tests/integration/api-v1.test.ts`.
- Cloud exchange is gated by `isSyncCloudExchangeAllowed` and `SYNC_MODE`, which defaults to `disabled` (`src/lib/env.ts`, `src/server/services/sync.ts`).

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION / NOT AVAILABLE:** the live two-device cloud round trip is not tested. `docs/PHASE_PROGRESS_STATUS.md` states explicitly that live cloud round-trip was NOT TESTED, and `docs/PHASE_11_QA_AUDIT.md` section 6 records sync logic as validated only against in-memory PGlite. Blocked-test register BLK-04 cites the absence of a cloud environment. Object storage for document files does not exist (backlog E-02), so documents cannot follow users to the cloud.

---

## 10. Security controls

**VERIFIED in source with named tests:**

| Control | Evidence | Tests |
|---|---|---|
| Per-user tenant isolation in queries and services, with composite foreign keys | `src/lib/session.ts` (`requireUser`/`getOptionalUser`), `src/db/schema/*.ts`, `src/proxy.ts` | `tests/integration/security.test.ts`, `tests/integration/services.test.ts` |
| AES-256-GCM encryption for Gmail/Microsoft OAuth tokens with random 96-bit IV | `src/lib/crypto.ts` | `tests/unit/phase10-security.test.ts` |
| OAuth state with PKCE (S256), HMAC-signed state, timing-safe comparison, 10-minute TTL replay protection, and timing-safe signed download tokens | `src/lib/crypto.ts` (`verifyOAuthState`, `verifySignedDownloadToken`, `OAUTH_STATE_TTL_MS = 600_000`), `src/app/api/email/oauth/` | `tests/unit/phase10-security.test.ts`, `tests/integration/security.test.ts` |
| Global environment-aware Content-Security-Policy and HSTS | `next.config.ts` (`securityHeaders`) | `tests/unit/phase10-security.test.ts`; production header check recorded in `docs/PHASE_11_DEFECT_REGISTER.md` DEF-11-003 |
| CSP sandbox on inline document file responses | `src/app/api/documents/versions/[versionId]/file/route.ts` | `tests/integration/security.test.ts`, defect register DEF-11-002 |
| Magic-byte validation, 10 MB limit with a 413 pre-check, filename sanitization, and malware-scan hook | `src/lib/storage.ts`, `src/app/api/documents/upload/route.ts` | `tests/unit/phase4-storage.test.ts`, `tests/integration/security.test.ts`, defect register DEF-11-008 |
| Signed, expiring document download tokens | `src/lib/crypto.ts`, `src/app/api/documents/download/route.ts` | `tests/unit/phase10-security.test.ts` |
| Rate limiting on API v1 and webhooks | `src/lib/rate-limit.ts`, `src/server/api/v1-handler.ts` | `tests/integration/api-v1.test.ts`, `tests/integration/security.test.ts` |
| Prompt-injection defense, delimiter neutralization, PII redaction, and untrusted-input provenance | `src/server/ai/security/prompt-guard.ts`, `src/server/ai/security/endpoint-validator.ts`, `src/db/schema/ai.ts` | `tests/unit/phase3-ai.test.ts`, `tests/unit/phase10-security.test.ts`, `tests/integration/ai-engine.test.ts` |
| UU PDP data rights: full JSON export, CSV export safe from formula injection, and permanent account deletion including storage purge | `src/app/api/export/`, `src/server/actions/settings.ts`, `src/lib/storage.ts` (`deleteUserStorageDir`) | `tests/integration/security.test.ts`, `tests/integration/services.test.ts` |

The three High findings from Phase 10 were fixed on 2026-11-17 and regression-tested: DEF-11-001 (OAuth state), DEF-11-002 (document CSP sandbox), and DEF-11-003 (global CSP). DEF-11-004 (CI), DEF-11-005 (handover docs), DEF-11-007 (accessibility E2E), DEF-11-008 (upload hardening), and DEF-11-009 (PGlite corruption incident, operational) are also closed in `docs/PHASE_11_DEFECT_REGISTER.md`.

**NOT AVAILABLE:** PostgreSQL RLS (DEF-11-006, owner-accepted deferral). **IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION:** live OAuth callbacks from Google and Microsoft (BLK-03). The global CSP still retains `'unsafe-inline'` for Next.js hydration and theme initialization; nonce-based tightening is backlog item E-09 and is **NOT AVAILABLE** (`next.config.ts`, `DEVELOPMENT_BACKLOG.md`).

---

## 11. Localization

**VERIFIED:**

- Two supported locales, `id-ID` and `en-US`, with two message catalogs in `src/lib/i18n/messages/en-us.ts` and `src/lib/i18n/messages/id-id.ts`. `src/lib/i18n/index.ts` exposes `MESSAGE_CATALOGS`, `MARKET_CONFIGS`, `normalizeLocale`, `toAiLocale`, `getMessages`, `translate`, missing-key detection, and localized label helpers.
- Currency catalog supports IDR and USD (`src/lib/i18n/currencies.ts`). Defaults are `preferredLocale = id-ID`, `currency = IDR`, and `timezone = Asia/Jakarta` in `src/db/schema/core.ts`.
- The document `lang` attribute is derived from the resolved locale cookie in `src/app/layout.tsx` (`htmlLang = MARKET_CONFIGS[resolvedLocale].htmlLang`, applied to `<html lang=...>`).
- Locale-aware date, time, number, and money formatting is exposed by `src/components/i18n/locale-provider.tsx`.
- AI prompts are selected by locale from `src/server/ai/prompts/en/` and `src/server/ai/prompts/id/` when no explicit locale override is passed (`docs/16-global-localization.md`, `src/server/ai/router/ai-task-router.ts`).
- CV export supports two formats (`indonesian_cv`, `international_resume`) and five styles (`docs/DEVELOPMENT_ROADMAP.md`, section 2.1).
- Tests: `tests/unit/phase9-localization.test.ts` (7 tests) and `tests/integration/localization.test.ts` (3 tests).

**IMPLEMENTED BUT NOT VERIFIED IN PRODUCTION:** native-speaker translation review and locale behavior in a deployed environment are not evidenced in the repository; verification is automated string and formatting tests only.

---

## 12. Test coverage and results

**VERIFIED baseline:**

| Gate | Result | Evidence in repository |
|---|---|---|
| Vitest unit and integration | 125/125 passing across 25 files | `npm run test`; `tests/unit/**` 14 files summing to 66 tests, `tests/integration/**` 11 files summing to 59 tests |
| Playwright E2E | 4/4 passing | `tests/e2e/core-journey.spec.ts` (1), `tests/e2e/accessibility.spec.ts` (3) |
| Typecheck | passing | `npm run typecheck` |
| Lint | passing | `npm run lint` |
| Production build | passing | `npm run build` |
| GitHub Actions CI | successful on commit `2a9540c` | `.github/workflows/ci.yml`; the workflow runs all five gates plus Playwright Chromium install |

Per-file Vitest counts: `domain` 8, `phase1-archive` 3, `phase10-security` 14, `phase2-career-profile` 2, `phase3-ai` 5, `phase3-email` 4, `phase4-ai-career` 3, `phase4-storage` 3, `phase5-analytics` 3, `phase5-credits` 2, `phase6-payments` 2, `phase7-sync` 6, `phase8-api` 4, `phase9-localization` 7 (unit); `ai-career-features` 4, `ai-engine` 3, `api-v1` 7, `archive` 7, `career-profile` 5, `credits` 3, `localization` 3, `payments` 3, `security` 9, `services` 7, `sync` 8 (integration).

Isolation model: `tests/helpers/db.ts` creates a fresh in-memory PGlite database, applies migrations, and seeds per test. E2E runs `next start` on port 3105 with `PGLITE_DATA_DIR=memory://` (`.github/workflows/ci.yml`, `docs/PHASE_11_QA_AUDIT.md` section 3).

**Blocked or not tested (from `docs/PHASE_11_QA_AUDIT.md` section 5 and `docs/PHASE_11_DEFECT_REGISTER.md`):**

| Item | Status |
|---|---|
| Real cloud AI provider calls | BLOCKED (BLK-01), mocked provider tests used instead |
| Real Midtrans/Stripe processing | BLOCKED (BLK-02), simulated responses only |
| Live Gmail/Microsoft OAuth flows | BLOCKED (BLK-03), PKCE/state logic unit-tested |
| Live cloud PostgreSQL and RLS | NOT TESTED (BLK-04), static assessment only |
| WCAG audit and keyboard-only navigation beyond the 3 accessibility E2E tests | PARTIAL; axe-core scans blocked pending dependency approval (E-08) |
| Performance and load testing | NOT TESTED (backlog S10-02) |
| Backup and restore drill | NOT TESTED (backlog S10-03) |
| AI, sync, and billing UI browser journeys | NOT TESTED (backlog E-12) |

---

## 13. Deployment requirements

**VERIFIED from `src/lib/env.ts`, `README.md`, `package.json`, and `.github/workflows/ci.yml`:**

- Node.js 20+ recommended by `README.md`; CI uses Node 22 (`.github/workflows/ci.yml`). Install with `npm install` or `npm ci`.
- Local mode requires no external database: leave `DATABASE_URL` empty and PGlite writes to `./.data/pglite`.
- Cloud mode requires `DATABASE_URL=postgres://...` and an explicit migration run (`npm run db:migrate`).
- `BETTER_AUTH_SECRET` (at least 16 characters) is required in production and validated at startup; `BETTER_AUTH_URL` defaults to `http://localhost:3000` and CI overrides it.
- Optional integrations: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID`; `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`/`OLLAMA_MODEL`; `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`; `ENCRYPTION_KEY` for token encryption.
- `PAYMENT_MODE` and `SYNC_MODE` both default to `disabled` and must be explicitly set to `sandbox` to enable those subsystems. `AI_REQUEST_TIMEOUT_MS` defaults to 30000, `AI_ALLOW_PRIVATE_LOCAL_ENDPOINT` defaults to false, `PAYMENT_WEBHOOK_MAX_AGE_SECONDS` defaults to 300, and `SYNC_RATE_LIMIT_PER_MIN` defaults to 60.
- **Operational rule:** never run `npm run setup` or `npm run db:migrate` while `next dev` is running. Concurrent access can corrupt `./.data/pglite` (upstream PGlite issue 884). This is documented in `README.md` and captured as DEF-11-009 in `docs/PHASE_11_DEFECT_REGISTER.md`.
- Build and start with `npm run build` and `npm run start`. The production build requires `BETTER_AUTH_SECRET` to be set, which CI satisfies with a throwaway placeholder value.

**Deployment runbook:** `docs/17-deployment-guide.md` covers local development, the production style build and start sequence, feature flags, CI placeholder configuration, the untested PostgreSQL path, and backup/recovery cautions. It states explicitly that no production deployment is approved and that its scope is local and staging style runs only. Cloud PostgreSQL via `DATABASE_URL` is marked NOT TESTED there, consistent with BLK-04 in `docs/PHASE_11_DEFECT_REGISTER.md`.

**Deployment decisions still outstanding (from `docs/RELEASE_PLAN.md`):** the deployment target (local-first only, self-hosted PostgreSQL, or managed cloud) has not been chosen. That decision gates private beta and public beta scope. `docs/RELEASE_PLAN.md` records M0 as ACHIEVED, M1 as ACHIEVED with owner sign-off PENDING, and M2 through M4 as NOT STARTED.

---

## 14. Known limitations

1. **No PostgreSQL RLS.** Tenant isolation in cloud mode depends on application filters and composite foreign keys only. Owner-accepted deferral DEF-11-006 (`docs/PHASE_11_DEFECT_REGISTER.md`).
2. **Live integrations unverified.** No live cloud sync round trip, no live AI provider credentials, no live payment gateway calls, and no live OAuth callbacks (BLK-01 to BLK-04).
3. **Synchronous AI jobs.** `ai_analysis_jobs` are persisted and executed inside the request; there is no background worker (`docs/DEVELOPMENT_ROADMAP.md`, section 2.1; backlog E-13).
4. **No object storage adapter.** Document files remain on local storage; uploads and downloads cannot follow users to the cloud (backlog E-02).
5. **Partial features.** Credit package admin has no CRUD UI (S6-05/E-07); interview coach is service-only and untested (S4-06/E-06).
6. **CSP still uses `unsafe-inline`.** Tightening to per-request nonces is not implemented (E-09).
7. **No performance baseline or backup drill.** Both are recorded as NOT STARTED and NOT TESTED (S10-02, S10-03); automated backups are also not implemented (E-11).
8. **E2E gaps.** Browser coverage exists only for the core journey and accessibility. AI, sync, credits, archive, and billing UI flows have no E2E (E-12). Axe-core scans are pending dependency approval (E-08).
9. **No approved production deployment path.** `docs/17-deployment-guide.md` limits its scope to local and staging style runs and marks production deployment as blocked pending owner approval. Backups are not automated and not drilled; that guide also notes that erasure removes the user's document directory and database rows but backup copies retain data until they expire or are purged.
10. **PGlite concurrency hazard.** The data directory is unsafe under simultaneous setup/migration and dev-server access; recovery from the recorded incident was only possible from a backup zip (DEF-11-009).
11. **License.** The `LICENSE` file is a custom proprietary, source-available, non-commercial template (Version 1.0, 17 November 2026). It should be treated as pending owner legal review; no evidence of a legal counsel review exists in the repository. This report makes no claim about repository visibility or ownership changes.

---

## 15. Outstanding risks

The following are drawn from `DEVELOPMENT_BACKLOG.md` section 6 and `docs/DEVELOPMENT_ROADMAP.md` section 8:

| Risk | Mitigation currently in place | Residual concern |
|---|---|---|
| Cloud tenant isolation relies on application filters without RLS | Accepted deferral DEF-11-006; do not offer shared-cloud multi-tenancy before E-01 | High impact if a cloud deployment is enabled prematurely |
| Payment flows verified only with simulated providers | `PAYMENT_MODE=disabled` by default; E-05 required before enablement | Live money flow is unproven |
| AI quality and cost unverified against live providers | Local Ollama-first mode, consent gate, per-run cost metadata | Provider output quality and spend are unknown |
| No performance baseline | S10-02 scheduled before public beta | No capacity or regression signal exists |
| No backup or restore drill | S10-03 and E-11 required before private beta data is entrusted | No proven restore path for real user data |
| PGlite corruption under concurrent setup and dev server | Operational rule documented; backup zip retained | Upstream bug remains open; no in-place recovery |
| CSP still allows `unsafe-inline` scripts | E-09 scoped before public beta | Residual XSS surface |
| E2E gaps in AI, sync, and billing UI | E-12 scoped before public beta | Those workflows are browser-unverified |
| Single-maintainer capacity | Milestones are effort-based; scope is trimmed rather than quality | Roughly 9 to 13 engineer-weeks remain from M2 through M4 |
| Deployment target undecided | Ordered gates, no invented dates | Schedule cannot be committed until target and capacity are confirmed |
| License not legally reviewed | Proprietary template in `LICENSE` | Terms may need revision before external distribution |

---

## 16. Recommended next steps

Ordered by the critical path in `docs/DEVELOPMENT_ROADMAP.md` section 5 and the milestone gates in `docs/RELEASE_PLAN.md`:

1. **S10-03 backup and restore drill.** Execute a documented restore that reproduces the pre-drill dataset exactly, following the stop-server rule before touching `.data/pglite`. This is the first private-beta gate.
2. **S10-02 performance baseline.** Build a repeatable harness and record latency and throughput thresholds before any capacity claim.
3. **E-12 expanded E2E.** Add Playwright journeys for AI, sync, and credit/billing flows, and wire them into `.github/workflows/ci.yml`.
4. **Confirm the deployment target.** Local-first only, self-hosted PostgreSQL, or managed cloud. This gates the rest of the cloud work and the milestone schedule.
5. **E-04 PostgreSQL CI matrix.** Apply all eight migrations and run integration tests against PostgreSQL in CI.
6. **E-01 PostgreSQL RLS.** Add policies and prove cross-tenant denial on PostgreSQL without breaking local PGlite mode. Do not enable shared-cloud multi-tenancy before this passes.
7. **E-02 object storage adapter.** Put uploads and downloads behind an adapter and test signed URLs.
8. **E-03 live cloud sync round trip.** Verify two-device push, pull, and conflict resolution on staging.
9. **E-05 live payment verification.** With owner approval and sandbox credentials, verify checkout, webhook, exactly-once credit grant, reconciliation, and refund against real gateway APIs. Keep `PAYMENT_MODE=disabled` until then.
10. **Live AI verification.** Obtain credentials or approve Ollama-only verification, then exercise real provider calls within an agreed cost budget.
11. **E-09 CSP nonce tightening, E-08 axe-core scans, E-11 automated backups.** Complete these before public beta or production operation as specified in `docs/RELEASE_PLAN.md`.
12. **Post-MVP, non-blocking:** E-06 interview coach UI, E-07 credit package admin, E-10 retention reminders, E-13 background AI worker, and E-14 CI action upgrades.
13. **Owner sign-off.** `docs/RELEASE_PLAN.md` M1 lists owner sign-off as PENDING; record it and review the accepted RLS exception at each gate. Have the `LICENSE` reviewed before external distribution.

---

## Final quality gate

| Check | Result | Evidence |
|---|---|---|
| No unresolved critical defects | PASS | `docs/PHASE_11_DEFECT_REGISTER.md` reports zero Critical defects; all three High defects are FIXED; the only open item is DEF-11-006, an owner-accepted deferral for cloud RLS |
| No exposed credentials | PASS | `git grep` for key patterns found only guard clauses in `src/lib/env.ts`, `src/server/payments/providers/stripe.provider.ts`, and synthetic fixtures in `tests/`. `.env.local` is gitignored and untracked; `.env.example` contains variable names and non-secret defaults only |
| No unapproved destructive migrations | PASS | No `DROP TABLE`, `TRUNCATE`, or `DELETE FROM` statements in `src/db/migrations/*.sql` (0000 to 0007); all migrations are additive |
| No fabricated feature claims | PASS | Every implementation status is labelled COMPLETE, PARTIAL, BLOCKED, NOT TESTED, or NOT STARTED. Live AI, live payments, and live cloud sync are explicitly NOT TESTED. The archive post-mortem UI and interview coach UI are explicitly PARTIAL or unavailable |
| No untested production integrations | PASS with caveat | No production deployment was performed. Unverified integrations are disabled by configuration (`PAYMENT_MODE=disabled`, `SYNC_MODE=disabled`) or require consent and credentials; they are listed as limitations in section 14 and risks in section 15 |
| Documentation matches actual code | PASS | Docs `01` to `19` were audited against `src/` and `tests/`; all `docs/DEVELOPMENT_ROADMAP.md`, `docs/RELEASE_PLAN.md`, and README links resolve; no duplicate documents were created during renumbering |
| Existing user data remains intact | PASS | No setup or migration command was run while `next dev` was active; `.data/pglite` was not modified or deleted; the running dev server still returns 200 on `/sign-in` |

The checks above are local and repository checks. They do not substitute for the live cloud verification listed in section 15.

---

## Production readiness assessment

**Selected assessment: Ready with limitations.**

**Evidence supporting "Ready":**

- The local-first MVP is feature-complete for its stated scope, with core ATS, archive, career profile, AI foundation, CV Studio, credits, simulated payments, sync, API v1, localization, and security controls implemented (`README.md`, `docs/DEVELOPMENT_ROADMAP.md` section 7, `docs/RELEASE_PLAN.md` M0 and M1).
- All automated gates are green: 125/125 Vitest tests across 25 files, 4/4 Playwright E2E tests, typecheck, lint, production build, and a successful GitHub Actions CI run on commit `2a9540c` (`.github/workflows/ci.yml`, `tests/`).
- The three High-severity Phase 10 findings are fixed and regression-tested, and the single remaining defect, DEF-11-006, is a documented owner-accepted deferral (`docs/PHASE_11_DEFECT_REGISTER.md`).
- Fail-safe configuration keeps unverified subsystems off by default: `PAYMENT_MODE=disabled`, `SYNC_MODE=disabled`, `local_only`/`ask_before_each` AI privacy modes, and consent before cloud document processing (`src/lib/env.ts`, `src/db/schema/core.ts`, `src/server/ai/router/provider-selector.ts`).

**Evidence requiring the "with limitations" qualifier:**

- Live cloud sync is not tested; the project's own records state that sync is proven only against in-memory PGlite and BLK-04 cites the absence of a cloud environment (`docs/PHASE_PROGRESS_STATUS.md`, `docs/PHASE_11_QA_AUDIT.md` section 6, `DEVELOPMENT_BACKLOG.md` E-03).
- Live AI providers are unverified because credentials and paid credits were unavailable (BLK-01); all AI behavior is proven through mocked providers.
- Live payments are unverified because real-money calls were prohibited (BLK-02); signature verification and reconciliation are tested only with simulated responses.
- PostgreSQL RLS is not implemented (DEF-11-006), so shared-cloud multi-tenancy is explicitly out of scope until E-01 passes.
- Performance testing (S10-02), backup and restore drills (S10-03, E-11), axe-core scans (E-08), and AI/sync/billing E2E (E-12) are NOT STARTED or BLOCKED in `DEVELOPMENT_BACKLOG.md`.
- `docs/RELEASE_PLAN.md` places private beta (M2), public beta (M3), and production readiness (M4) at NOT STARTED, with roughly 9 to 13 engineer-weeks of hardening remaining.

**Conclusion:** the codebase is ready for continued local-first use and for an M1 MVP sign-off, provided the accepted exception and the unverified live integrations remain explicitly disabled and documented. It is not ready for shared-cloud multi-tenant operation, live payment processing, or a publicly hosted beta until the section 16 gates are completed and evidenced. The `LICENSE` remains a proprietary template pending owner legal review before external distribution.
