# Phase 11: Environment Test Matrix

**Date:** 2026-11-17 · Secret values are never read or printed; variable names only.

## 1. Local (PGlite): ✅ FULLY VALIDATED

| Aspect | Assessment | Evidence |
|---|---|---|
| Configuration | `DATABASE_URL` optional (empty ⇒ PGlite); `PGLITE_DATA_DIR` selects data dir; `serverExternalPackages: ["@electric-sql/pglite"]` in `next.config.ts` | config inspected |
| Database | PGlite 0.5.16 + Drizzle migrations 0000–0007 applied cleanly in every test run | 125/125 tests |
| Storage | Local FS under `storage/` (gitignored); validated magic bytes, 10 MB cap, purge on deletion | phase4-storage + SEC-21 |
| Auth | Better Auth 1.7.25 cookie sessions; `requireUser()` server-side | security tests |
| AI | Local Ollama provider + mocked cloud providers; consent gate enforced | phase3-ai, ai-engine tests |
| Sync | Outbox + pull/push against local v1 API | sync tests (14) |
| Known limitations | Single-process embedded Postgres; not for multi-instance deployment | architecture docs |

## 2. Cloud (PostgreSQL): ⚠️ STATIC ASSESSMENT ONLY

| Aspect | Assessment | Status |
|---|---|---|
| Configuration | `DATABASE_URL` via `postgres` 4.1.1 driver; `scripts/migrate.mjs` supports remote execution | PASS (static) |
| Database compatibility | Drizzle SQL is Postgres-dialect; PGlite-specific CAS fallback noted in `credits.ts:26` with `FOR UPDATE` path for Postgres | PASS (static) |
| Storage | Local FS assumption breaks in multi-instance/cloud, needs object storage (S3/R2) adapter | GAP (DEF-11-009) |
| Auth | Same Better Auth; production requires real `BETTER_AUTH_SECRET`, dedicated `ENCRYPTION_KEY` | config requirement documented |
| AI | Cloud providers (OpenAI/Gemini) server-side keys only; never `NEXT_PUBLIC_*` | verified in `env.ts` |
| RLS | **No row-level security policies**, isolation relies on app-layer `user_id` filters + composite FKs | GAP (DEF-11-006) |
| Live test | NOT TESTED, no cloud environment in this audit | BLOCKED |

## 3. Hybrid: ✅ LOGIC VALIDATED / ⏸️ LIVE ROUND-TRIP NOT TESTED

| Aspect | Assessment | Evidence |
|---|---|---|
| Local DB | PGlite embedded; zero local credit mutation (server-authoritative) | sync tests |
| Cloud sync | `src/app/api/v1/sync/{push,pull,resolve,status}` endpoints; device registration with token auth | api-v1 + sync tests |
| Retry | Outbox-based retry mechanism | phase7-sync unit tests |
| Offline operation | Local-first writes; sync deferred | design + tests |
| Conflict detection | Version-based detection | phase7-sync |
| Conflict resolution | `resolve` endpoint with server-authoritative validation | phase7-sync |
| Duplicate event prevention | Idempotency keys throughout credits/sync | credits.ts verified |
| Known limitation | Live cloud round-trip untested (no cloud env); credits never mutated locally | n/a |

## 4. Required Environment Variables (names only: see `.env.example`)

`DATABASE_URL` · `PGLITE_DATA_DIR` · `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `ENCRYPTION_KEY` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `MICROSOFT_CLIENT_ID` · `MICROSOFT_CLIENT_SECRET` · `MICROSOFT_TENANT_ID` · AI provider keys (OpenAI/Gemini/Ollama endpoint) · payment provider keys (Midtrans/Stripe server keys)

## 5. Prohibited in All Environments (Phase 11 rules)

Real-money transactions · production data access · production migrations · real emails · paid AI credits without approval · `.env` modification.
