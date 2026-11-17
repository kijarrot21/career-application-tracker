# 12. Credit-Based Monetization System

**Phase:** 5 — Credit-Based Monetization  
**Status:** Implemented (Database Schema, Atomic Reservation Engine, AI Router Integration, Wallet UI, Tests; Real-Money Payment Checkout Not Activated)  
**Primary Route:** `/credits`

---

## 1. Architecture & Server Authority

All credit balances, reservations, and ledger transactions live exclusively on the server in PostgreSQL / PGlite:
- Clients **never** send balance updates or authoritative costs.
- Local devices cannot directly mutate cloud credit balances.
- Every reservation, capture, release, grant, refund, and adjustment creates an immutable row in `credit_ledger` linked to a traceable `reference_type`, `reference_id`, `idempotency_key`, and `audit_logs` record.
- Real-money payment gateways are **not** activated in this phase (`credit_packages` serves as a preview pricing catalog only).

---

## 2. Database Schema (`src/db/schema/credits.ts`, Migration `0004_hesitant_goblin_queen.sql`)

| Table | Purpose | Key Constraints |
|---|---|---|
| `credit_wallets` | 1:1 per-user available/reserved balances & lifetime totals | `UNIQUE(user_id)`, `UNIQUE(id, user_id)`, `available_balance >= 0`, `reserved_balance >= 0`, optimistic `version >= 1` |
| `credit_reservations` | Atomic holds created before AI tasks execute (`reserved` → `captured` or `released`) | Composite FK to `credit_wallets`, `UNIQUE(user_id, idempotency_key)`, `amount > 0` |
| `credit_ledger` | Append-only financial & AI usage audit trail | Composite FKs to `credit_wallets` and `credit_reservations`, `UNIQUE(user_id, idempotency_key)`, non-negative balance checks |
| `ai_credit_pricing` | Database-configurable AI task cost table | `UNIQUE(pricing_key)`, `credit_cost >= 0`, `charge_local_runs` toggle |
| `credit_packages` | IDR-first & USD credit pack display catalog | `UNIQUE(package_key)`, positive credits/non-negative prices |

`ai_analysis_jobs` also stores `pricing_key`, `credit_cost`, and `credit_reservation_id` for end-to-end job traceability.

---

## 3. Atomic Credit Lifecycle & Concurrency Controls

`src/server/services/credits.ts` wraps every balance mutation in database transactions using:
- Pessimistic row locking (`SELECT ... FOR UPDATE`) combined with atomic conditional balance + version checks (`WHERE available_balance >= cost AND version = expectedVersion`), plus single-connection PGlite transaction serialization when `DATABASE_URL` is unset.
- Strict idempotency keys (`UNIQUE(user_id, idempotency_key)`) preventing duplicate deductions on retried or double-submitted requests.

### Connected AI Execution Flow (`src/server/ai/router/ai-task-router.ts`)
1. **Pricing Resolution:** `resolveAiTaskPricingService()` reads the active cost from `ai_credit_pricing` (never permanently hardcoded).
2. **Consent Gate First:** In `ask_before_each` or unconsented cloud runs, `ai_analysis_jobs` pauses at `awaiting_consent` without deducting or holding credits.
3. **Atomic Reserve:** Immediately before invoking the AI provider, `reserveCreditsForAiTaskService()` verifies balance (`InsufficientCreditsError` if short) and moves credits from `available_balance` to `reserved_balance`.
4. **Capture on Success / Auto-Release on Failure:**
   - Successful Zod-validated AI responses invoke `captureCreditReservationService()`, clearing `reserved_balance`, incrementing `lifetime_spent`, and persisting `credit_cost` & `usage_metadata`.
   - Permanent provider/validation failures invoke `releaseCreditReservationService()`, returning reserved credits back to `available_balance`.

---

## 4. Initial Database Pricing Assumptions

Seeded idempotently by `seedCreditCatalog()` (`src/db/seed/credits.ts`) and modifiable in `ai_credit_pricing`:

| Pricing Key | Label | Initial Seed Cost |
|---|---|---|
| `cv_parse` | AI CV Parser | 1 credit |
| `job_match` | Job Matching | 1 credit |
| `cv_evaluate_basic` | Basic CV Evaluation | 2 credits |
| `cv_evaluate_detailed` | Detailed CV Evaluation | 3 credits |
| `cv_correction` | CV Correction | 3 credits |
| `cover_letter` | Cover Letter Drafting | 2 credits |
| `cv_generate` | CV Generator | 4 credits |
| `cv_generate_job_optimized` | Job-Specific CV Optimization | 5 credits |
| `skill_gap` | Skill Gap Analysis | 3 credits |
| `career_roadmap` | Career Roadmap | 5 credits |
| `interview_coach` | Interview Simulation | 3 credits |

New wallets initialize idempotently via `ensureCreditWalletService()` with a configurable starter grant (`DEFAULT_WELCOME_CREDITS = 100`) recorded in `credit_ledger`.

---

## 5. UI (`/credits`)

[CreditsWalletClient](file:///Users/arhel/Documents/Project/Personal%20Job%20Applicant%20System/src/components/credits/credits-wallet-client.tsx) displays:
- **Credit Wallet KPIs:** Available balance, reserved credits, lifetime spent, lifetime granted.
- **Low-Balance Warning:** Alert banner when `availableBalance <= lowBalanceThreshold`.
- **Credit Packages Preview:** IDR & USD package cards clearly labeled `"Online Checkout Not Activated"`.
- **AI Task Pricing Schedule & Reservation Status:** Live configurable DB pricing and active/settled holds.
- **Append-Only Credit Ledger Table:** Complete transaction history with deltas, post-balances, reference types, and reasons.
