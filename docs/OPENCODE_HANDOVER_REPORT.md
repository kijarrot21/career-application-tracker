# OpenCode Handover Report — Career Application Tracker

**Date:** 2026-11-17 · **Branch:** `main` · **Version:** 0.1.0
**Status:** Phase 0–10 implemented and verified; Phase 11 (QA & Testing) in final completion stage.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Product | Personal Applicant Tracking System (ATS) → evolving into a Hybrid AI Career Management Platform |
| Repository | `career-application-tracker` (origin: `github.com/kijarrot21/career-application-tracker`) |
| Canonical working directory | `/Users/arhel/Documents/Project/Personal Job Applicant Tracking System` |
| Deployment model | **Hybrid** (local-first with cloud sync) |
| AI strategy | **Hybrid Local + Cloud** (Ollama local; OpenAI/Gemini cloud, consent-gated) |
| Monetization | **Credits** (server-authoritative wallet, Midtrans + Stripe) |
| Target market | Indonesia (id-ID, IDR) + Global (en-US, USD) |
| Licensing | Proprietary — do not redistribute source |

## 2. Technology Stack (verified in `package.json`)

- **Next.js 16.4.6** (App Router, Turbopack) — ⚠️ read `AGENTS.md` rule + `node_modules/next/dist/docs/` before code changes; APIs may differ from training data
- React 19.3, TypeScript (strict), Tailwind CSS v4, Drizzle ORM 0.45.4
- **PGlite** 0.5.16 (embedded local Postgres; `DATABASE_URL` empty = local)
- Better Auth 1.7.25 (cookie sessions), Radix UI, Recharts, dnd-kit, cmdk
- Vitest 5.1.0 (unit/integration, isolated in-memory PGlite), Playwright 1.65.1 (E2E)

## 3. Architecture Map

| Path | Responsibility |
|---|---|
| `src/app/(app)/` | Authenticated pages: dashboard, jobs, applications (13-stage kanban), archive, interviews, emails, documents, analytics, credits, cv-studio, sync, settings, profile, shortlist |
| `src/app/(auth)/` | sign-in / sign-up (UU PDP notice) |
| `src/app/api/` | Route handlers: auth, documents (upload/download/versions), email OAuth (PKCE), payments webhooks, AI, `api/v1/*` (versioned API incl. sync + credits + payments) |
| `src/db/` | Drizzle schema (11 domain modules), migrations 0000–0007, seeds (system/demo/credits) |
| `src/lib/` | session/auth, crypto (AES-256-GCM, HMAC tokens, PKCE), storage (magic bytes, 10 MB cap, malware hooks), rate-limit, i18n, csv, audit |
| `src/server/` | actions, queries, services, AI engine (providers/router/schemas/security), payments providers, sync |
| `docs/` | 18 phase/spec documents + audits (see `PHASE_PROGRESS_STATUS.md`) |
| `tests/` | unit (14 files), integration (11), e2e (core-journey + accessibility) |

## 4. How to Run

```bash
npm install            # dependencies
npm run setup          # writes .env.local (secrets) — STOP dev server first!
npm run dev            # http://localhost:3000
npm run test           # vitest: unit + integration (in-memory PGlite)
npm run test:e2e       # playwright (needs build; port 3105, memory PGlite)
npm run typecheck / lint / build / db:migrate / db:generate
```

**⚠️ Critical operational rule (learned 2026-11-17, DEF-11-009):** never run `npm run setup` or `npm run db:migrate` while `next dev` is running — concurrent access to `.data/pglite` corrupts the data dir irrecoverably (upstream bug `electric-sql/pglite#884`). Stop the dev server first.

## 5. Quality Gates (as of 2026-11-17)

| Gate | Status |
|---|---|
| Vitest | 125/125 PASS |
| Playwright E2E | core-journey 1/1 PASS + accessibility spec |
| Typecheck / Lint | PASS |
| Production build | PASS (21 routes) |
| CI/CD | `.github/workflows/ci.yml` (runs all gates on push/PR) — activates on next push |

## 6. Security Posture (Phase 10 + Phase 11 fixes)

- Verified: tenant isolation (`requireUser()` + composite FKs), AES-256-GCM OAuth tokens, PKCE + HMAC state, magic-byte upload validation, malware scan hooks, signed download tokens, rate limiting on `/api/v1`, atomic credits (`FOR UPDATE` + CAS + idempotency), webhook signature verification (Midtrans SHA-512, Stripe HMAC), prompt-injection defense, UU PDP erasure + export.
- Phase 11 hardening applied: constant-time signature comparison + OAuth state TTL replay protection (`crypto.ts`), `CSP: sandbox` on inline document responses, global environment-aware `Content-Security-Policy` (`next.config.ts`), upload size pre-check (`413`) + `DomainError`-typed error sanitization on the upload route.
- **Accepted exception:** no PostgreSQL row-level security (cloud) — deferred to a dedicated cloud-hardening phase (DEF-11-006).
- CSP currently retains `'unsafe-inline'` for scripts (Next.js hydration + theme-init); nonce-based tightening via middleware is future work.

## 7. Working-Tree State (⚠️ important for the next engineer)

The repository carries **substantial uncommitted work** (Phase 1–10 implementations: AI engine, credits, payments, sync, i18n, security, UI modernization — 113 tracked changes + 69 untracked files as of 2026-11-17). Nothing has been committed since `8a070ff`. Recommended first action: review `git status`, then commit in coherent feature slices. Do not run destructive git commands.

## 8. Known Non-Blocking Issues

- Browser console warning: inline `<script>` (theme init, `layout.tsx:39`) renders inside the React tree — benign known React pattern warning; moving it out of the component tree is optional cleanup.
- `vitest.config.ts` triggers a Vite config-loader deprecation warning (ESM/CJS) — cosmetic.
- Local DB starts empty after the 2026-11-17 corruption reset; use the in-app sample-data loader, or restore `_pglite_corrupt_backup_2026-11-17.zip` (Project folder) for the old data.
