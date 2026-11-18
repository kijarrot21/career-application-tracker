# Development Backlog

**Baseline:** Personal ATS v0.1.0, `main` at `2a9540c` (2026-11-18)
**Scope:** Phases 0 to 13 delivered or in final documentation; Phase 12 defines the roadmap and backlog from here.
**Priority order:** Data integrity, then security, then reliability, then AI quality, then monetization, then UX.
**Rule:** Do not duplicate existing modules (`suitability.ts`, `email-classifier.ts`, documents, interviews, analytics, Better Auth, Drizzle with PGlite/PostgreSQL).

**Phase 13 update (2026-11-18):** Documentation was consolidated into the canonical `docs/01` to `docs/19` numbering without duplicating documents. `.env.example` now documents variable names and behavior only. CI reports unit tests and integration tests as separate gates. Final gate evidence and the production readiness assessment are recorded in `IMPLEMENTATION_REPORT.md`.

**OpenCode Stages 1-9 update (2026-11-18):** Added deterministic progress detection, workflow rules, a next best action engine, persistent onboarding preferences, dashboard guidance, guided setup wizard, product tour, contextual help, onboarding settings, and QA documentation. Details are in `docs/USER_ONBOARDING_DESIGN.md`, `docs/USER_ONBOARDING_IMPLEMENTATION.md`, `docs/USER_ONBOARDING_TEST_PLAN.md`, and `docs/NEXT_BEST_ACTION_ENGINE.md`. Known gaps: timezone boundary handling for UTC instants, limited Stage 5-8 browser E2E, and one pre-existing sign-in E2E assertion failure.

---

## 1. Method and Status Vocabulary

Every status in this document is backed by source code and executed tests, never by intention.

| Status | Meaning |
|---|---|
| **COMPLETE** | Code exists, is wired into the application, and automated tests pass |
| **PARTIAL** | Code exists but a specified part is missing or not exposed in the UI |
| **NOT STARTED** | No implementation exists |
| **BLOCKED** | Cannot proceed or cannot be verified without an external dependency or approval |
| **ACCEPTED DEFERRAL** | Owner explicitly accepted the gap and moved it to a later milestone |

| Testing status | Meaning |
|---|---|
| **PASS** | Automated tests exist and pass; file references are listed |
| **PARTIAL** | Some layers are covered; the remaining layers are manual or untested |
| **NOT TESTED** | No automated coverage exists |
| **BLOCKED** | Tests cannot run in the current environment |

**Complexity scale** (1 full-time engineer): **S** up to 1 day, **M** 2 to 4 days, **L** 1 to 2 weeks, **XL** 3 or more weeks.
**Priority scale:** **P0** blocks the next milestone, **P1** required for MVP, **P2** post-MVP improvement, **P3** later enhancement.

**Verified baseline evidence:** 125/125 Vitest tests across 25 files, 4/4 Playwright E2E tests, typecheck, lint, production build, and a green GitHub Actions run on `620f7d8`.

---

## 2. Sprint Status Summary

| Sprint | Scope | Implementation | Testing | Blockers |
|---|---|---|---|---|
| 0 | Audit | COMPLETE | PASS | None |
| 1 | Application Archive | COMPLETE | PASS | None |
| 2 | Career Profile | COMPLETE | PASS | None |
| 3 | AI Foundation | COMPLETE | PASS | Live cloud providers BLOCKED |
| 4 | AI Career MVP | COMPLETE | PASS | Live cloud providers BLOCKED |
| 5 | CV Studio | COMPLETE | PASS | None |
| 6 | Credit Economy | COMPLETE (package admin PARTIAL) | PASS | None |
| 7 | Payment | COMPLETE | PASS | Live gateway verification BLOCKED |
| 8 | Hybrid Sync | COMPLETE | PASS | Live cloud round-trip BLOCKED |
| 9 | Global Readiness | COMPLETE | PASS | None |
| 10 | Production Hardening | PARTIAL | PARTIAL | Performance and backup testing absent |

---

## 3. Backlog Detail

### Sprint 0: Audit

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S0-01 | Repository audit | Full inventory of modules, routes, schema, and gaps | P1 | None | S | `docs/REPOSITORY_AUDIT.md` published and consistent with tree | COMPLETE | PASS (documented) |
| S0-02 | Architecture review | Layer map and data flow review | P1 | S0-01 | S | `docs/CURRENT_ARCHITECTURE.md` and `docs/03-architecture.md` match code | COMPLETE | PASS (documented) |
| S0-03 | Security review | Threat surface and control review | P1 | S0-02 | M | `docs/SECURITY_REVIEW_REPORT.md`, `SECURITY_GAP_ANALYSIS.md`, `14-security-and-data-governance.md` published | COMPLETE | PASS (Phase 11 fixes tested in `phase10-security.test.ts`, `security.test.ts`) |
| S0-04 | Functionality inventory | Phase-by-phase feature inventory | P1 | S0-01 | S | `docs/PHASE_PROGRESS_STATUS.md` lists every phase with evidence | COMPLETE | PASS (documented) |
| S0-05 | Baseline tests | Establish passing baseline | P1 | S0-04 | S | Vitest, E2E, typecheck, lint, build all green | COMPLETE | PASS (125/125, 4/4) |

### Sprint 1: Application Archive

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S1-01 | Archive schema | Closure records, snapshots, retention fields, tenant isolation | P1 | S0 | M | Tables `application_closure_records` and `application_archive_snapshots` with composite FKs and unique active-closure index | COMPLETE | PASS (`archive.test.ts`) |
| S1-02 | Lifecycle | Archive, restore, and manual close transitions | P1 | S1-01 | M | Archive and restore preserve the application record and stage history | COMPLETE | PASS (`phase1-archive.test.ts`, 10 tests) |
| S1-03 | Snapshots | Immutable JSONB snapshot with SHA-256 content hash | P1 | S1-01 | M | Snapshot hash is stable and never updated after creation | COMPLETE | PASS (`archive.test.ts`) |
| S1-04 | Archive UI | Archive list, detail, restore, and retention policy controls | P2 | S1-02 | M | Pages render with empty, archived, and restored states | COMPLETE | PARTIAL (service covered; UI not in E2E journey) |
| S1-05 | Tests | Unit and integration coverage | P1 | S1-01 to S1-04 | M | Archive lifecycle covered at service and route level | COMPLETE | PASS |

### Sprint 2: Career Profile

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S2-01 | Structured profile | Master profile entity with protected verified fields | P1 | S0 | M | AI cannot overwrite verified fields without explicit confirmation | COMPLETE | PASS (`career-profile.test.ts`) |
| S2-02 | Work experience | CRUD for experiences | P1 | S2-01 | S | Create, update, delete with audit entries | COMPLETE | PASS (`phase2-career-profile.test.ts`) |
| S2-03 | Skills | Skill inventory with levels | P1 | S2-01 | S | Skills feed suitability and skill-gap analysis | COMPLETE | PASS |
| S2-04 | Education | Education records | P1 | S2-01 | S | CRUD plus ordering | COMPLETE | PASS |
| S2-05 | Certifications | Certification records | P1 | S2-01 | S | CRUD plus issuer and date fields | COMPLETE | PASS |
| S2-06 | Projects | Project portfolio records | P1 | S2-01 | S | CRUD plus technology tags | COMPLETE | PASS |

### Sprint 3: AI Foundation

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S3-01 | Provider adapters | Ollama, OpenAI, and Gemini adapters behind one interface | P1 | S2 | L | All adapters implement the shared provider contract and sanitized status reporting | COMPLETE | PASS (`ai-engine.test.ts`) |
| S3-02 | Task router | Provider selection by locality, task, and configuration | P1 | S3-01 | M | Router falls back deterministically when cloud is unavailable | COMPLETE | PASS |
| S3-03 | Structured AI output | Zod-validated structured responses | P1 | S3-01 | M | Invalid model output is rejected and never persisted | COMPLETE | PASS |
| S3-04 | AI job processing | `ai_analysis_jobs` lifecycle with audit trail | P1 | S3-02 | M | Jobs record status, provider, model, prompt version, credit cost, and usage | COMPLETE (synchronous execution; no background worker) | PASS |
| S3-05 | Consent system | Explicit consent gate and privacy mode per run | P1 | S3-04 | M | Cloud calls require consent; local mode works offline | COMPLETE | PASS |
| S3-06 | Usage metadata | Token, cost, and latency accounting | P1 | S3-04 | S | `usageMetadata` stores input, output, total tokens, cost, latency, and estimate flag | COMPLETE | PASS |

### Sprint 4: AI Career MVP

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S4-01 | CV parser | Parse uploaded documents into structured CV data | P1 | S3 | L | PDF, DOCX, TXT, and MD inputs parse with extraction method recorded | COMPLETE | PASS (`ai-career-features.test.ts`, `phase4-ai-career.test.ts`) |
| S4-02 | CV evaluation | ATS and content quality evaluation | P1 | S3, S2 | M | Evaluation returns criterion scores grounded in verified data | COMPLETE | PASS |
| S4-03 | Job matching | Vacancy-to-profile fit analysis | P1 | S3, S2 | M | Match output cites profile evidence and returns a bounded score | COMPLETE | PASS |
| S4-04 | Skill gap analysis | Gap list against target role | P1 | S3, S2 | M | Gaps map to skills and suggested actions | COMPLETE | PASS |
| S4-05 | Career roadmap | Structured growth roadmap generation | P2 | S4-04 | M | Roadmap items are time-bounded and stored per user | COMPLETE | PASS |
| S4-06 | Interview coach | Grounded interview preparation service | P2 | S4-03 | M | Service returns grounded question and answer guidance | PARTIAL (service exists in `interview-coach.service.ts`; no action or UI wiring) | NOT TESTED (no API/UI path) |
| S4-07 | Archive analysis | AI analysis of archived applications | P2 | S1, S3 | M | Archived snapshot analysis requires consent and records usage | PARTIAL (service and API complete; UI placeholder disabled) | PASS (service and API tests) |
| E-15 | Archive post-mortem UI | Wire archive detail page to the existing analysis service | P2 | S4-07 | M | Analysis runs from the archive detail page and results are displayed | NOT STARTED | NOT TESTED |

### Sprint 5: CV Studio

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S5-01 | CV correction | Suggested wording edits with per-item approval | P1 | S4-01 | L | Only approved edits are applied; approval is recorded | COMPLETE | PASS (`phase4-ai-career.test.ts`) |
| S5-02 | CV generation | Grounded CV and cover letter generation | P1 | S4-01, S2 | L | Output uses verified facts and supports Indonesian CV and international resume formats | COMPLETE | PASS |
| S5-03 | CV versioning | Save generated output as a new document version | P1 | S5-02 | M | Saving creates a version without altering originals | COMPLETE | PASS |
| S5-04 | PDF and DOCX export | Native exporters without third-party renderers | P1 | S5-02 | L | PDF starts with a valid header; DOCX is a valid OOXML package and re-extracts as text | COMPLETE | PASS (`phase4-ai-career.test.ts`) |
| S5-05 | User approval | Human-in-the-loop approval gate | P1 | S5-01 | M | AI jobs require explicit approval before execution | COMPLETE | PASS |

### Sprint 6: Credit Economy

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S6-01 | Credit wallet | Server-authoritative balance per user | P1 | S3 | M | Wallet initializes with a ledger grant; balance cannot go negative | COMPLETE | PASS (`credits.test.ts`) |
| S6-02 | Credit ledger | Append-only ledger with integrity verification | P1 | S6-01 | M | Ledger entries reconcile to the wallet balance | COMPLETE | PASS |
| S6-03 | Reservations | Reserve, capture, and release around AI tasks | P1 | S6-01 | L | Insufficient balance is rejected; failed tasks release reservations | COMPLETE | PASS |
| S6-04 | AI usage accounting | Credit cost per AI task and pricing table | P1 | S6-03 | M | Each AI job records credit cost and pricing version | COMPLETE | PASS |
| S6-05 | Package management | Credit package catalog and pricing control | P3 | S6-01 | M | Active packages are listed with IDR and USD pricing | PARTIAL (schema, seed, read API, and pricing update service exist; no admin CRUD UI) | PARTIAL (`credits.test.ts` covers pricing updates, not catalog management) |

### Sprint 7: Payment

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S7-01 | Payment abstraction | Provider-neutral checkout and webhook contract | P1 | S6 | M | Midtrans and Stripe implement the same provider interface | COMPLETE | PASS (`payments.test.ts`) |
| S7-02 | Checkout | Credit package checkout with order records | P1 | S7-01 | M | Orders are created with unique codes and pending status | COMPLETE | PASS |
| S7-03 | Webhook verification | Signature verification and replay protection | P1 | S7-01 | L | Invalid signatures, replays, wrong amount, and wrong currency are rejected without granting credits | COMPLETE | PASS |
| S7-04 | Reconciliation | Idempotent order reconciliation | P1 | S7-02 | M | Reconciling twice grants credits exactly once | COMPLETE | PASS |
| S7-05 | Refund handling | Refund clawback through the ledger | P1 | S6-02 | M | Refund reverses credits exactly once and is audited | COMPLETE | PASS |

### Sprint 8: Hybrid Sync

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S8-01 | Sync outbox | Local change capture and ordered outbox | P1 | S0 | L | Local-only mode queues changes without cloud connectivity | COMPLETE | PASS (`sync.test.ts`) |
| S8-02 | Sync endpoints | Push, pull, resolve, and status routes | P1 | S8-01 | L | Routes enforce auth, rate limits, and per-user isolation | COMPLETE | PASS |
| S8-03 | Conflict detection | Version-based conflict detection | P1 | S8-02 | M | Concurrent edits are flagged instead of silently overwritten | COMPLETE | PASS |
| S8-04 | Conflict resolution | Manual resolution with keep-cloud, keep-local, and merge | P1 | S8-03 | M | Every resolution path is recorded and replay-safe | COMPLETE | PASS |
| S8-05 | Sync UI | Sync center for devices, outbox, and conflicts | P2 | S8-04 | M | UI exposes push, pull, status, and conflict resolution | COMPLETE | PARTIAL (service covered; UI not in E2E journey) |

### Sprint 9: Global Readiness

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S9-01 | English localization | Full en-US and id-ID dictionaries | P1 | S0 | L | Locale switch changes UI strings and document language attribute | COMPLETE | PASS (`localization.test.ts`) |
| S9-02 | International resume templates | Indonesian CV and international resume formats with five styles | P2 | S5-02 | M | Generated CVs use the selected format and style in all exports | COMPLETE | PASS (`phase9-localization.test.ts`) |
| S9-03 | Currency formatting | IDR and USD formatting per market | P1 | S9-01 | S | Amounts render with the correct currency and grouping | COMPLETE | PASS |
| S9-04 | Timezone support | Locale-aware defaults including Asia/Jakarta | P1 | S9-01 | S | Business-day calculations use the configured timezone | COMPLETE | PASS |
| S9-05 | Privacy documentation | UU PDP documentation and data rights | P1 | S0 | M | Privacy and security docs cover retention, export, erasure, and breach handling | COMPLETE | PASS (documented) |

### Sprint 10: Production Hardening

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| S10-01 | Security audit | Audit plus High-severity fixes | P0 | S0 | L | Three High findings fixed and regression-verified | COMPLETE | PASS (`security.test.ts`) |
| S10-02 | Performance testing | Load and latency baseline | P1 | S10-05 | L | Repeatable harness with documented baseline thresholds | NOT STARTED | NOT TESTED |
| S10-03 | Backup testing | Backup and restore drill | P0 | Cloud or local deployment target | M | Restore drill documented and executed with verified data integrity | NOT STARTED | NOT TESTED |
| S10-04 | Migration verification | Migrations apply cleanly on PGlite and PostgreSQL | P1 | None | M | 8 migrations apply from zero; tests use the real migrator | COMPLETE (PGlite verified; PostgreSQL leg pending E-04) | PASS (`tests/helpers/db.ts` migrator) |
| S10-05 | E2E testing | Browser-level coverage of critical journeys | P1 | S10-01 | L | Core journey plus accessibility suite pass in CI | PARTIAL (AI, sync, and credit flows have no E2E) | PASS (4/4) |
| S10-06 | Production readiness report | Consolidated readiness assessment | P0 | S10-01 to S10-05 | S | Report states gates, risks, and accepted exceptions | COMPLETE (`docs/PHASE_11_QA_AUDIT.md`, `docs/RELEASE_PLAN.md`) | PASS (documented) |

---

## 4. Post-Roadmap Backlog

| ID | Feature | Description | Pri | Deps | Cx | Acceptance criteria | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| E-01 | PostgreSQL RLS | Row-level security for cloud multi-tenancy | P1 | E-04, cloud DB | L | Policies isolate tenants on PostgreSQL without breaking PGlite | NOT STARTED (ACCEPTED DEFERRAL, DEF-11-006) | NOT TESTED |
| E-02 | Object storage adapter | S3 or Supabase storage behind a storage interface | P1 | Cloud deployment target | L | Uploads and downloads work through an adapter without changing callers | NOT STARTED | NOT TESTED |
| E-03 | Live cloud sync round-trip | Two-device sync against a real cloud database | P1 | E-01, E-02, cloud env | M | Push and pull complete with conflict resolution on real infrastructure | BLOCKED (no cloud environment) | BLOCKED |
| E-04 | PostgreSQL CI matrix | CI leg running tests against PostgreSQL service | P2 | None | M | CI runs migrations and integration tests on PostgreSQL in addition to PGlite | NOT STARTED | NOT TESTED |
| E-05 | Payment live verification | End-to-end sandbox verification with real gateway calls | P1 | Sandbox credentials and owner approval | M | Checkout, webhook, reconciliation, and refund verified against sandbox APIs | BLOCKED (policy: no live gateway calls without approval) | BLOCKED |
| E-06 | Interview coach UI | Expose the existing service through actions and UI | P2 | S4-06 | M | Users can request interview coaching from the interviews area | PARTIAL (service only) | NOT TESTED |
| E-07 | Credit package admin | Manage package catalog and pricing | P3 | S6-05 | M | Admin can create, update, and deactivate packages safely | NOT STARTED | NOT TESTED |
| E-08 | Axe-core a11y scans | Automated accessibility scanning | P2 | Dependency approval | S | Axe scans run in CI with a zero critical-violation gate | NOT STARTED | BLOCKED (dependency approval) |
| E-09 | CSP nonce tightening | Remove `unsafe-inline` for scripts | P2 | Next.js nonce middleware design | M | Scripts load only with per-request nonces | NOT STARTED | NOT TESTED |
| E-10 | Retention reminders | UU PDP 24-month retention review notifications | P2 | S1 | M | Due reviews generate in-app notifications | NOT STARTED | NOT TESTED |
| E-11 | Automated backups | Scheduled backup and restore automation | P1 | Deployment target | L | Backups run on schedule and restores are validated | NOT STARTED | NOT TESTED |
| E-12 | AI, sync, and credit E2E | Browser coverage for AI, sync, and billing flows | P1 | Stable AI test doubles | L | Three new E2E journeys pass in CI | NOT STARTED | NOT TESTED |
| E-13 | Background AI worker | Move AI execution off the request path | P3 | S3-04 | L | Jobs process asynchronously with retry and status reporting | NOT STARTED | NOT TESTED |
| E-14 | CI action upgrades | Resolve Node 20 deprecation warnings | P3 | None | S | Workflow uses current action major versions without warnings | NOT STARTED | NOT TESTED |

---

## 5. Blocked Items and Unblock Actions

| ID | Blocked by | Unblock action |
|---|---|---|
| S3, S4 live verification | No AI provider credentials and no cost budget | Provide sandbox API keys or approve local Ollama-only verification |
| E-05 | Policy prohibits real gateway calls; no sandbox keys | Owner approval plus Midtrans and Stripe sandbox credentials |
| E-03 | No cloud PostgreSQL or object storage environment | Provision a staging project and configure `DATABASE_URL` |
| E-08 | New dependency requires approval | Approve `@axe-core/playwright` |
| S10-03, E-11 | Deployment target not chosen | Decide local-first versus cloud hosting model |
| E-01 | Waits on cloud environment and PostgreSQL CI matrix | Schedule cloud hardening phase |

---

## 6. Release Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloud tenant isolation relies on application filters (no RLS) | Medium | High | Accepted deferral DEF-11-006; do not offer shared-cloud multi-tenancy before E-01 |
| Payment flows verified only with simulated providers | Medium | High | Keep `PAYMENT_MODE=disabled` until E-05 completes |
| AI quality and cost unverified against live providers | High | Medium | Local Ollama-first mode; consent gate; per-run cost metadata |
| No performance baseline | Medium | Medium | S10-02 before public beta |
| No backup or restore drill | Medium | High | S10-03 and E-11 before private beta data is entrusted |
| PGlite corruption under concurrent setup and dev server | Low | High | Operational rule documented; backups retained |
| CSP still allows `unsafe-inline` scripts | Medium | Medium | E-09 before public beta |
| E2E gaps in AI, sync, and billing UI | Medium | Medium | E-12 before public beta |
| Single-maintainer capacity | High | High | Milestones are effort-based, not date-based; scope is trimmed in `docs/RELEASE_PLAN.md` |

---

## 7. MVP Boundary

**MVP scope (implemented, needs hardening sign-off):** core ATS, archive, career profile, AI foundation, AI career MVP, CV Studio, credits, payments (simulated), hybrid sync, and localization.

**Post-MVP enhancements:** interview coach UI (E-06), credit package admin (E-07), background AI worker (E-13), retention reminders (E-10), and CI action upgrades (E-14).

**Production-grade cloud requirements:** RLS (E-01), object storage (E-02), live cloud sync (E-03), PostgreSQL CI (E-04), live payment verification (E-05), performance testing (S10-02), backup automation (S10-03, E-11), CSP nonce (E-09), and expanded E2E (E-12).
