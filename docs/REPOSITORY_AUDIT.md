# Repository Audit — Career Application Tracker (Baseline)

**Audit Date:** 2026-11-17  
**Repository:** `career-application-tracker` (`v0.1.0`)  
**Objective:** Establish a verified technical baseline before incrementally evolving the application into a Hybrid AI Career Management Platform.

---

## 1. Executive Summary

The repository contains a well-structured, functional **Personal Applicant Tracking System (ATS)** built on **Next.js 16.4.6 (App Router, Turbopack)**, **React 19.3**, **TypeScript (strict)**, **Tailwind CSS v4**, **Drizzle ORM**, **PGlite / PostgreSQL**, and **Better Auth**.

All 5 original Personal ATS phases plus the Phase 1–2 UI/UX primitive foundation (`src/components/ui/` + `DESIGN.md`) are implemented:
- **Verified Passing:** TypeScript (`npm run typecheck`), ESLint (`npm run lint`), Vitest unit & integration suite (`npm run test`: 5 files, 25 tests), and Next.js production build (`npm run build`, executed outside sandbox due to Turbopack worker IPC restriction inside sandbox).
- **Not Executed in Phase 0:** Playwright E2E (`npm run test:e2e`) was inspected (`tests/e2e/core-journey.spec.ts`) but not executed during this audit.
- **No CI/CD Pipeline:** No `.github/workflows` or deployment manifest exists in the repository.

---

## 2. Configuration & Tooling Inventory

| File | Key Findings |
|---|---|
| [package.json](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/package.json) | Next `16.4.6`, React `19.3.0`, Drizzle ORM `0.45.4`, `@electric-sql/pglite` `0.5.16`, `postgres` `4.1.1`, `better-auth` `1.7.25`, `zod` `4.6.7`, `radix-ui` `1.8.1`, `recharts` `3.10.1`, `@dnd-kit/*`, `cmdk` `1.1.1`, `vitest` `5.1.0`, `@playwright/test` `1.65.1`. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `setup`, `db:generate`, `db:migrate`, `test`, `test:e2e`. |
| [tsconfig.json](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/tsconfig.json) | `strict: true`, `noEmit: true`, `target: ES2017`, `moduleResolution: bundler`, `@/* -> ./src/*`, excludes `node_modules` and `design-references`. |
| [next.config.ts](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/next.config.ts) | `serverExternalPackages: ["@electric-sql/pglite"]`, Turbopack CSS loader (`@tailwindcss/turbopack`), security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`). Note: **No CSP or HSTS header configured.** |
| [drizzle.config.ts](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/drizzle.config.ts) | Schema `./src/db/schema/index.ts`, migrations `./src/db/migrations`, dialect `postgresql`. |
| [eslint.config.mjs](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/eslint.config.mjs) | Flat config using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. |
| [vitest.config.ts](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/vitest.config.ts) | `environment: "node"`, `fileParallelism: false`, `testTimeout: 30000`, includes `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`. |
| [playwright.config.ts](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/playwright.config.ts) | Single worker, `npx next start -p 3105` with `PGLITE_DATA_DIR=memory://`. |
| [.env.example](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/.env.example) | `DATABASE_URL` (optional; empty = PGlite), `PGLITE_DATA_DIR`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`. |
| [AGENTS.md](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20Tracking%20System/AGENTS.md) | Next.js 16 rule requiring inspection of `node_modules/next/dist/docs/` before modifying code. |

---

## 3. Existing Feature Inventory

### 3.1 Routes & UI Modules (`src/app/` & `src/components/`)
- **Auth (`src/app/(auth)/`):** `/sign-in`, `/sign-up` (email + password ≥ 10 chars, UU PDP privacy notice).
- **Root Entry (`src/app/page.tsx`):** Redirects to `/dashboard` if authenticated or `/sign-in` otherwise.
- **Authenticated App Shell (`src/app/(app)/layout.tsx`):** Calls `requireUser()`, renders `AppShell` (`AppSidebar`, top bar notifications popover, `CommandMenu`, `SampleDataBanner`), plus `loading.tsx`, `error.tsx`, and `not-found.tsx`.
- **Dashboard (`/dashboard`):** KPI summary, pipeline stage breakdown, activity over time, outcome chart, recent activity, upcoming interviews, pending follow-ups, search status selector, sample data loader.
- **Find Jobs (`/jobs`, `/jobs/new`, `/jobs/[id]`):** Manual vacancy entry with deterministic URL platform/ID detection (no scraping), duplicate URL warning, 6-criteria weighted suitability calculator (`SuitabilityPanel`), triage workflow (`new`, `interested`, `shortlisted`, `not_interested`, `archived`).
- **Job Shortlist (`/shortlist`):** Side-by-side comparison of shortlisted vacancies and quick submission action.
- **Applications (`/applications`, `/applications/[id]`):**
  - 13-stage default HR pipeline (`Sourced` → `Interested` → `Applied` → `CV Screening` → `HR Interview` → `User Interview` → `Assessment / Technical Test` → `Final Interview` → `Offer` → `Hired` / `Rejected` / `Withdrawn` / `No Response`).
  - Kanban board (`@dnd-kit`) and sortable/filterable Data Table (`applications-table.tsx`).
  - Record Submission dialog (`APP-0001` sequential code, intentional re-apply enforcement, automatic initial history & first follow-up task).
  - Application Detail (`application-detail-client.tsx`, 1,807 lines) covering overview, append-only status timeline, communications, interviews, assessments, follow-ups, linked documents, and job offer.
- **Interviews & Assessments (`/interviews`):** Calendar/list interview scheduling, interview outcomes, assessment/technical test tracking.
- **Email Center (`/emails`):** Manual correspondence logging, optional read-only Gmail & Microsoft Outlook OAuth2+PKCE integration, deterministic English/Indonesian email classifier & application matcher, user-confirmed stage transition suggestions, recruiter contact directory.
- **Documents (`/documents`):** Multi-version document repository (`master_cv`, `custom_cv`, `cover_letter`, `portfolio`, `certificate`, `transcript`, `supporting`, `interview_prep`, `offer`), magic-byte validated local file upload (up to 10 MB), version linking to applications, inline/download serving.
- **Analytics (`/analytics`):** Honest-metrics KPI engine, conversion funnel, monthly performance, platform/industry/company breakdowns, date-range & sample-mode filtering, CSV report export.
- **Settings (`/settings`):** Career profile & suitability weights, timezone (`Asia/Jakarta`), currency (`IDR`), follow-up cadence & Indonesian national holiday presets (`INDONESIAN_HOLIDAY_PRESETS`), custom pipeline stage management (add, rename, reorder, hide), sample data load/remove, JSON/CSV data export, password-verified account deletion.

### 3.2 API Route Handlers (`src/app/api/`)
- `GET/POST /api/auth/[...all]` — Better Auth catch-all handler (`ensureDbReady()` + `getAuth().handler`).
- `POST /api/documents/upload` — Multipart upload via `uploadOrVersionDocumentService`.
- `GET /api/documents/versions/[versionId]/file` — User-scoped file download/inline view.
- `GET /api/email/oauth/[provider]/start` & `callback` — PKCE OAuth flow for `gmail` and `outlook`.
- `GET /api/export/account` — Full JSON account export.
- `GET /api/export/applications` — CSV export with formula-injection protection (`src/lib/csv.ts`).
- `GET /api/export/analytics` — Analytics CSV export.

### 3.3 Domain Logic (`src/lib/domain/`)
Pure, deterministic business-rule modules (no AI/LLM dependencies):
- `stages.ts` — 11 `stageType` primitives, 13 `DEFAULT_STAGES`, transition classifier (`same`, `forward`, `skip`, `backward`, `terminal`, `reopen`, `invalid`), `deriveOutcome`, `progressRank`.
- `suitability.ts` — Deterministic 6-criterion scoring (`skills`, `experience`, `education`, `salary`, `location`, `growth`) with skill alias normalization.
- `email-classifier.ts` — Regex/heuristic bilingual (EN/ID) email classifier & application matcher.
- `follow-ups.ts` — Follow-up sequence generator and `No Response` suggestion evaluator.
- `business-days.ts` — Timezone-safe `YYYY-MM-DD` arithmetic with Indonesian holiday presets (2026–2027).
- `duplicates.ts` — URL normalization, platform detection (`SYSTEM_SOURCES`), external job ID extraction, company/title normalization.
- `kpi.ts` — Honest-metrics KPI, funnel, response rate, cycle duration, and breakdown calculations.

### 3.4 Existing Tests (`tests/`)
- **Unit (`tests/unit/`):** `domain.test.ts` (8 tests), `phase3-email.test.ts` (4 tests), `phase4-storage.test.ts` (3 tests), `phase5-analytics.test.ts` (3 tests).
- **Integration (`tests/integration/services.test.ts`):** 7 tests on isolated in-memory PGlite covering per-user isolation, duplicate blocking + intentional re-apply, append-only history + follow-up cancellation, sample exclusion, email classification/confirmation, document versioning + file isolation + offer sync, and analytics breakdowns.
- **E2E (`tests/e2e/core-journey.spec.ts`):** End-to-end journey test across sign-up, job creation, submission, email classification, interviews, documents, Kanban/Table, timeline, analytics, and responsive viewports (`375px`, `768px`, `1440px`).

---

## 4. Baseline Test Execution Results

| Script | Command | Outcome | Observed Output / Notes |
|---|---|---|---|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **PASS** | Exit code `0`, zero errors. |
| ESLint | `npm run lint` (`eslint`) | **PASS** | Exit code `0`, zero warnings/errors. |
| Unit & Integration | `npm run test` (`vitest run`) | **PASS** | Exit code `0`: **5 test files passed, 25 tests passed** (`13.10s`). Emits minor Vite warning about ESM syntax in `vitest.config.ts` without `"type": "module"`. |
| Production Build | `npm run build` (`next build`) | **PASS** (outside sandbox) | Inside sandbox failed with `TurbopackInternalError` spawning PostCSS worker (`node process exited before we could connect to it with exit status: 0`). Retried with `BypassSandbox: true`: exit code `0`, compiled in `2.5s`, TypeScript `2.9s`, all 23 app routes built cleanly. |
| E2E | `npm run test:e2e` (`playwright test`) | **NOT RUN** | Not executed during Phase 0 baseline audit. |

---

## 5. Existing vs. Missing Capabilities (Target: Hybrid AI Career Management Platform)

| Capability Area | Existing Status | Missing for Target Platform |
|---|---|---|
| **Local + Cloud DB** | Dual driver (`PGlite` when `DATABASE_URL` empty; `postgres-js` when set) with shared Drizzle PostgreSQL schema. | **Local ↔ Cloud Sync Engine** (sync state/cursors, tombstones/soft deletes, conflict resolution, device registry, offline queue, object storage abstraction for synced documents). |
| **Auth & Isolation** | Better Auth email/password, session cookies, app-layer `userId` checks, DB composite FKs. | **PostgreSQL RLS** migration/policies, cloud email verification/password reset flows, sync token/device authorization. |
| **Candidate Profile & CV Data** | Basic fields on `user_settings` (`headline`, `skills[]`, `yearsExperience`, `educationLevel`, salary, locations) + file upload in `documents`. | **Structured Career Profile** (work history, projects, achievements, certifications, languages), **CV text extraction** (PDF/DOCX), grounded career-evidence store (to prevent fabricated AI CV claims). |
| **AI Capabilities** | **None.** All scoring (`suitability.ts`) and email classification (`email-classifier.ts`) are 100% deterministic regex/rules. | **Provider-Independent AI Gateway** (Local AI adapter e.g. Ollama/WebLLM/OpenAI-compatible local + Cloud AI adapters), prompt/response schemas, provenance & human-review gates, PII minimization, AI CV tailoring, cover letter drafting, JD parsing, interview prep, AI email/suitability enhancement. |
| **Monetization & Credits** | **None.** Single-tier free local/self-hosted app. | **Credit Ledger** (append-only balance transactions, atomic reserve/commit/refund), pricing catalog per AI action, free/starter quotas, **Indonesia-first payment gateway** (e.g., Midtrans/Xendit webhook verification + IDR pricing) + global billing abstraction. |
| **Storage** | Local filesystem only (`./storage/documents/<userId>/<uuid>.<ext>`). | Cloud object storage adapter (S3 / Supabase Storage / R2) + sync replication for hybrid deployment. |
| **CI/CD & Observability** | Local scripts (`setup`, `migrate`, `test`) only. | GitHub Actions CI (`typecheck`, `lint`, `test`, `build`, `e2e`), migration verification against PostgreSQL, structured error/usage telemetry. |

---

## 6. Key Cross-Cutting Technical Risks Identified

1. **Non-atomic multi-step mutations:** Services like `recordSubmissionService`, `moveApplicationStageService`, `createVacancyService`, and `uploadOrVersionDocumentService` perform sequential inserts/updates without `db.transaction(...)`, risking partial state or sequence collisions (`nextApplicationSeq`, `nextJobSeq`, `versionNo`).
2. **Orphaned disk files on account deletion:** `deleteUserAccountService` deletes the `user` row (cascading DB tables) without deleting `storage/documents/<userId>/`.
3. **Unlinked foreign keys & incomplete JSON export:** `applications.cvVersionId`/`coverLetterVersionId` lack FK constraints; `exportAccountJsonService` omits `assessments`, `documents`, `documentVersions`, `applicationDocuments`, and `emailAccounts`.
4. **Monolithic UI component:** `src/components/applications/application-detail-client.tsx` (1,807 lines) and `interviews-client.tsx` (1,307 lines) will become difficult to extend with AI assistants without modularization.
5. **Client-side / memory-bound aggregation:** `getDashboardData` and `getAnalyticsData` load full user tables into Node memory and `recentActivity` / `upcomingInterviews` / `pendingFollowUps` do not consistently respect `includeSample`.
