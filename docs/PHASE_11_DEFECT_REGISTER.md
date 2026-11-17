# Phase 11 — Defect Register

**Date:** 2026-11-17 · Statuses: OPEN / APPROVED / FIXED / ACCEPTED / CLOSED
All entries verified against source code and executed test results on `main` @ `8a070ff`.

---

## Critical

None identified.

## High

### DEF-11-001 — OAuth state: timing-unsafe comparison, no TTL
- **Module:** K. Security (Email OAuth)
- **Files:** `src/lib/crypto.ts` (`verifyOAuthState`, lines 77–91)
- **Reproduction:** inspect `verifyOAuthState` — `if (sig !== expected) return null` uses JS string comparison; the `ts` field inside the state payload is never validated, so a captured state is replayable indefinitely.
- **Expected:** constant-time comparison (`crypto.timingSafeEqual`) + strict TTL (e.g. 10 minutes) on the state timestamp.
- **Actual:** timing side-channel possible; captured state never expires.
- **Root cause:** implementation predates the Phase 10 gap-analysis remediation; the remediation plan's OAuth item was not applied (unlike the download-token and storage-purge items, which were).
- **Regression risk:** low — pure security hardening; existing unit tests cover valid/invalid signatures.
- **Recommended fix:** `timingSafeEqual` on equal-length buffers + TTL check against a signed timestamp.
- **Regression test:** unit — reject expired state; reject signature of different length; accept fresh valid state.
- **Regression evidence (2026-11-17):** targeted security tests 26/26 PASS (`phase10-security`, `phase4-storage`, `security` integration); full suite PASS; typecheck + lint PASS. Hardened the identical constant-time pattern in `verifySignedDownloadToken` (same defect class, same file).
- **Status:** FIXED.

### DEF-11-002 — No CSP sandbox on inline document file responses
- **Module:** K. Security (Documents)
- **Files:** `src/app/api/documents/versions/[versionId]/file/route.ts` (headers block, lines 46–52)
- **Reproduction:** request an inline PDF/text document; response headers include only `X-Content-Type-Options: nosniff` and `Cache-Control`.
- **Expected:** `Content-Security-Policy: sandbox; default-src 'none'` on file responses (per Phase 10 gap analysis).
- **Actual:** inline-rendered documents execute without a restrictive CSP; a malicious PDF/HTML can run scripts in the app origin context.
- **Root cause:** signed-token remediation landed; the CSP-sandbox remediation did not.
- **Regression risk:** low — additive header.
- **Recommended fix:** add CSP sandbox header to the file response; keep `attachment` for non-preview types.
- **Regression test:** integration — assert header present on inline file response.
- **Regression evidence (2026-11-17):** targeted security tests 26/26 PASS; full suite PASS; typecheck + lint PASS. Header verified in code; a dedicated header-assertion test can be added on request.
- **Status:** FIXED.

### DEF-11-003 — No global Content-Security-Policy header
- **Module:** K. Security (HTTP headers)
- **Files:** `next.config.ts` (`securityHeaders` array)
- **Reproduction:** inspect response headers of any route — CSP absent (HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy are present).
- **Expected:** environment-aware CSP (per `docs/06-privacy-and-security.md:33`).
- **Actual:** CSP was documented but never implemented; the gap analysis High item remains open.
- **Root cause:** partially applied header remediation (HSTS added, CSP not).
- **Regression risk:** **medium** — a strict CSP can break Next.js inline scripts/styles; must be tuned against the app (nonce or hash strategy) and verified by E2E.
- **Recommended fix:** add CSP with `'unsafe-inline'` only where Next.js requires it initially, then tighten; verify with full E2E run.
- **Regression test:** E2E header assertion + full journey run.
- **Regression evidence (2026-11-17):** build PASS; production headers verified via `curl -I` (CSP present on `/sign-in`, 200 OK, prod policy correctly omits `'unsafe-eval'`); full suite 125/125 PASS; typecheck + lint PASS; E2E 1/1 PASS (document preview iframe + images work under global CSP + per-file `sandbox` CSP).
- **Status:** FIXED.

## Medium

### DEF-11-004 — No CI/CD pipeline
- **Files:** repository root (no `.github/workflows/`)
- **Impact:** all quality gates (typecheck, lint, vitest, playwright, build) are manual; regressions can land unnoticed.
- **Recommended fix:** GitHub Actions workflow running the five existing gates on PR/push. (Requires approval; touches no source code.)
- **Status:** FIXED (2026-11-17) — `.github/workflows/ci.yml` created: npm ci → typecheck → lint → vitest → production build → Playwright chromium E2E, triggered on push to `main` and PRs. Caveat: workflow execution can only be demonstrated after a push (prohibited without approval); all five gates verified passing locally.

### DEF-11-005 — Missing handover documentation
- **Files:** `docs/` (missing `OPENCODE_HANDOVER_REPORT.md`, `PHASE_PROGRESS_STATUS.md`)
- **Impact:** onboarding/audit continuity relies on informal knowledge; phase status not machine-checkable.
- **Recommended fix:** author both documents from this audit's evidence.
- **Status:** FIXED (2026-11-17) — `docs/OPENCODE_HANDOVER_REPORT.md` and `docs/PHASE_PROGRESS_STATUS.md` authored from verified evidence.

### DEF-11-006 — No PostgreSQL row-level security (cloud target)
- **Files:** `src/db/migrations/*` (policy absent)
- **Impact:** cloud multi-tenant isolation depends entirely on app-layer filters + composite FKs.
- **Recommended fix:** dedicated hardening phase adding RLS policies compatible with cloud Postgres.
- **Status:** **ACCEPTED BY OWNER (2026-11-17)** — explicitly deferred to a future cloud-hardening phase; documented as a standing exception in `PHASE_11_QA_AUDIT.md` and `PHASE_PROGRESS_STATUS.md`.

### DEF-11-007 — Missing UI/UX automated accessibility coverage
- **Files:** `tests/e2e/` (no axe/a11y scenarios; keyboard-nav untested)
- **Impact:** WCAG regressions undetectable; E2E covers only the happy path.
- **Recommended fix:** add Playwright axe scan + keyboard-only journey (new test code — requires approval).
- **Status:** FIXED (2026-11-17) — `tests/e2e/accessibility.spec.ts` added (no new dependencies): document language, heading structure, labelled inputs, focus order, visible focus indicators, keyboard operability (Enter submit), landmarks, accessible button names, sidebar keyboard navigation — **3/3 PASS**. Axe-core automated scans remain future work (needs dependency approval).

## Low

### DEF-11-008 — Multipart upload buffered before size check; raw error passthrough
- **Files:** `src/app/api/documents/upload/route.ts:14,35,67-68`
- **Impact:** request body buffered before the 10 MB check (DoS surface); unexpected errors may leak internals.
- **Recommended fix:** Content-Length pre-check + typed error sanitization.
- **Status:** FIXED (2026-11-17) — `src/lib/errors.ts` (`DomainError`), `career.ts` domain throws typed (12 sites; messages preserved), `upload/route.ts`: 413 pre-check before buffering + unexpected errors logged server-side and returned as generic 500. Regression: 125/125 + typecheck + lint PASS.

---

### DEF-11-009 — PGlite data-dir corruption on concurrent access (runtime incident)
- **Module:** Database / local environment
- **Severity at occurrence:** High (app returned 500 on every request)
- **Files:** `.data/pglite/*` (operational data, not source); `src/db/index.ts` (no defect — singleton pattern is correct)
- **Reproduction:** open the same `.data/pglite` dir from two processes (e.g. run `npm run db:migrate`/`setup` while `next dev` holds the dir), or kill the dev server mid-write. Subsequent opens abort on the first query with `RuntimeError: Aborted(). Build with -sASSERTIONS for more info.` wrapped by drizzle as `Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"`.
- **Root cause:** upstream PGlite bug [electric-sql/pglite#884](https://github.com/electric-sql/pglite/issues/884) — NODEFS data dir becomes unreadable after improper multi-process access; no in-place recovery exists.
- **Resolution (2026-11-17):** dev server stopped → corruption confirmed on live dir (`select 1` aborts) → dir backed up to `_pglite_corrupt_backup_2026-11-17.zip` → `.data` reset → `npm run db:migrate` re-applied migrations + seeds → dev server restarted → `GET /` 307→`/sign-in`, `/sign-in` 200. **Note: prior local DB contents are only recoverable from the backup zip.**
- **Prevention:** never run `npm run setup` / `npm run db:migrate` while the dev server is running; stop `next dev` first. Optional code guard (clear error message on open failure) can be added later.
- **Status:** FIXED (operational). Upstream bug remains open.

## Blocked-Test Register (environment, not code defects)

| ID | Item | Reason |
|---|---|---|
| BLK-01 | Real cloud AI provider execution | Paid credits; not consumed without approval |
| BLK-02 | Real Midtrans/Stripe processing | Real-money transactions prohibited |
| BLK-03 | Live OAuth (Gmail/Microsoft) flows | No credentials in audit environment |
| BLK-04 | Live cloud PostgreSQL round-trip | No cloud environment available |
