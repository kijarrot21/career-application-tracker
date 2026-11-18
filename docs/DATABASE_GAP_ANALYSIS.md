# Database Gap Analysis

**Database Engines:** PGlite (`@electric-sql/pglite` 0.5.16) & PostgreSQL (`postgres` 4.1.1)  
**ORM / Migrations:** Drizzle ORM `0.45.4` + `drizzle-kit` `0.31.11`  
**Schema Entry:** [src/db/schema/index.ts](../src/db/schema/index.ts)  
**Current Migrations:** 1 baseline migration (`0000_messy_komodo.sql`)

---

## 1. Existing Schema Inventory (22 Tables, 25 Enums)

### 1.1 Better Auth Tables (`src/db/schema/auth.ts`)
| Table | PK | Key Columns & Constraints |
|---|---|---|
| `user` | `id` (`text`) | `email` unique, `emailVerified`, `name`, `image`, timestamps |
| `session` | `id` (`text`) | `token` unique, `expiresAt`, `userId -> user.id` (`cascade`), indexed on `userId` |
| `account` | `id` (`text`) | `accountId`, `providerId`, `userId -> user.id` (`cascade`), OAuth tokens, `password`, indexed on `userId` |
| `verification` | `id` (`text`) | `identifier`, `value`, `expiresAt`, indexed on `identifier` |

### 1.2 Core Profile, Jobs & Pipeline Tables (`src/db/schema/core.ts`)
| Table | PK | Foreign Keys & Composite Isolation | Unique / Check / Index Constraints |
|---|---|---|---|
| `user_settings` | `user_id` (`text`) | `-> user.id` (`cascade`) | `user_settings_follow_up_days_ck`, `user_settings_no_response_ck`; stores `timezone`, `currency`, `searchStatus`, `skills[]`, `yearsExperience`, `educationLevel`, salary range, `preferredLocations[]`, `preferredArrangements[]`, `holidays[]`, `suitabilityWeights`, `nextApplicationSeq`, `nextJobSeq` |
| `companies` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | `UNIQUE(id, userId)`, `UNIQUE(userId, normalizedName)` |
| `recruiter_contacts` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(companyId, userId) -> companies(id, userId)` (`cascade`) | `UNIQUE(id, userId)`, idx `(userId, companyId)` |
| `job_sources` | `id` (`uuid`) | `userId -> user.id` (`cascade`, nullable for system rows) | Partial unique `key WHERE user_id IS NULL`, partial unique `(userId, key) WHERE user_id IS NOT NULL` |
| `job_vacancies` | `id` (`uuid`) | `userId -> user.id` (`cascade`), `sourceId -> job_sources.id` (`set null`), composite FK `(companyId, userId) -> companies(id, userId)` (`cascade`) | `UNIQUE(id, userId)`, `UNIQUE(userId, code)`, partial `UNIQUE(userId, normalizedUrl) WHERE normalized_url IS NOT NULL`, salary/score/experience `CHECK`s, idx `(userId, triageStatus)` |
| `suitability_evaluations` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(vacancyId, userId) -> job_vacancies(id, userId)` (`cascade`) | `UNIQUE(vacancyId)`, 0 to 100 `CHECK` on all 6 scores |
| `application_stages` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | `UNIQUE(id, userId)`, `UNIQUE(userId, key)`, idx `(userId, sortOrder)` |

### 1.3 Applications, Career Lifecycle, Documents & Audit Tables (`src/db/schema/applications.ts`)
| Table | PK | Foreign Keys & Composite Isolation | Notable Constraints & Purpose |
|---|---|---|---|
| `documents` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | `UNIQUE(id, userId)`, idx `(userId, category)` |
| `document_versions` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(documentId, userId) -> documents(id, userId)` (`cascade`) | `UNIQUE(id, userId)`, `UNIQUE(documentId, versionNo)` |
| `applications` | `id` (`uuid`) | `userId -> user.id` (`cascade`), `platformSourceId -> job_sources.id` (`set null`), composite FKs for `vacancyId`, `currentStageId`, `primaryRecruiterId` | `UNIQUE(id, userId)`, `UNIQUE(userId, code)`, partial `UNIQUE(vacancyId) WHERE outcome = 'active'`, `UNIQUE(vacancyId, attemptNumber)`, `attemptNumber >= 1` check |
| `application_status_history` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FKs for `applicationId` (`cascade`) and `toStageId` | Append-only stage history; idx `(applicationId, effectiveOn, recordedAt)` |
| `application_documents` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FKs for `applicationId` & `documentVersionId` (`cascade`) | `UNIQUE(applicationId, documentVersionId)` |
| `email_accounts` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | `UNIQUE(id, userId)`, `UNIQUE(userId, provider, email)` |
| `email_communications` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(applicationId, userId) -> applications(id, userId)` (`cascade`) | Partial `UNIQUE(userId, source, providerMessageId) WHERE provider_message_id IS NOT NULL`, idx `(userId, applicationId, occurredAt)` |
| `interviews` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(applicationId, userId)` (`cascade`) | idx `(userId, startsAt)` |
| `assessments` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(applicationId, userId)` (`cascade`) | Tracks technical/psychometric/case-study tests |
| `job_offers` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(applicationId, userId)` (`cascade`) | `UNIQUE(applicationId)` |
| `follow_up_tasks` | `id` (`uuid`) | `userId -> user.id` (`cascade`), composite FK `(applicationId, userId)` (`cascade`) | idx `(userId, status, dueOn)` |
| `notifications` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | idx `(userId, readAt)` |
| `audit_logs` | `id` (`uuid`) | `userId -> user.id` (`cascade`) | Append-only audit trail; idx `(userId, createdAt)` |

---

## 2. Integrity & Relational Gaps in Existing Schema

1. **Missing Foreign Keys on Reference Columns:**
   - `applications.cv_version_id` and `applications.cover_letter_version_id` (`src/db/schema/applications.ts:117-118`) have **no FK** to `document_versions(id, user_id)`. Deleting a document leaves dangling UUIDs on `applications`.
   - `application_status_history.from_stage_id` (`line 173`) and `email_id` (`line 180`) have **no FK** constraints.
   - `email_communications.email_account_id` (`line 253`) has **no FK** to `email_accounts(id, user_id)` (`onDelete: "set null"`).
   - `interviews.stage_id` (`line 298`) has **no FK** to `application_stages(id, user_id)`.
2. **Non-Atomic Sequence Counters (`next_application_seq`, `next_job_seq`):**
   - Stored as plain integers on `user_settings` and updated outside transactions (`src/server/services/applications.ts:157,255-258`, `vacancies.ts:217,268-271`). Concurrent mutations can generate duplicate `APP-xxxx` or `JOB-xxxx` codes and violate unique indexes.
3. **Lack of Multi-Statement Transactions:**
   - `recordSubmissionService`, `moveApplicationStageService`, `createVacancyService`, and `uploadOrVersionDocumentService` execute multiple sequential SQL statements without `db.transaction(...)`.
4. **Incomplete Account JSON Export (`exportAccountJsonService`):**
   - `src/server/services/settings.ts:304-407` omits `assessments`, `documents`, `documentVersions`, `applicationDocuments`, `emailAccounts` (metadata), and `notifications`.
5. **No PostgreSQL Row-Level Security (RLS) Policies:**
   - Planned in `docs/03-architecture.md` (Phase 6), not yet implemented in `0000_messy_komodo.sql`. Must remain compatible with PGlite when added (e.g., guarded cloud-only migration or app-role session variables).

---

## 3. Schema Gaps for Hybrid AI Career Management Platform

To evolve into the target platform without duplicating existing tables, the following **additive** schema extensions are needed in future phases:

### 3.1 Hybrid Local + Cloud Sync Gaps
- **Missing Sync Metadata on Mutable Entities:** No `sync_version` / Lamport clock / `updated_at` server watermark, `last_synced_at`, or `deleted_at` (soft-delete tombstones) to reconcile offline local edits with cloud PostgreSQL. Currently deletes are hard `DELETE`s (`onDelete: "cascade"`).
- **Missing Sync Infrastructure Tables:**
  - `sync_devices` (device/client ID, local PGlite instance ID, last checkpoint cursor)
  - `sync_outbox` / `sync_conflicts` (pending mutations, conflict audit & user resolution state)
  - `storage_objects` / blob sync status on `document_versions` (`storageProvider`: `local | s3 | supabase`, `remoteStorageKey`, `syncStatus`)

### 3.2 Structured Candidate Profile & Grounded CV Evidence Gaps
- `user_settings` currently stores only flat `headline`, `skills[]`, `yearsExperience`, `educationLevel`, `expectedSalaryMin/Max`.
- **Missing:**
  - `candidate_profiles` / `career_experiences`, `career_projects`, `career_educations`, `career_certifications`, verified factual source-of-truth records required so AI CV/cover-letter generation never fabricates achievements (Rule 11).
  - `document_extracted_contents` (or text/parsed JSON column on `document_versions`), stores extracted CV text, parsed sections, extraction method, and SHA-256 checksum to avoid re-parsing unchanged PDFs/DOCX.

### 3.3 Provider-Independent Hybrid AI Gaps
- **Missing:**
  - `ai_provider_configs` (per-user or system provider preferences: local Ollama/LM Studio/WebGPU vs. cloud OpenAI/Anthropic/Gemini; encrypted BYOK API keys if supported, never exposed to client).
  - `ai_runs` / `ai_generations` (traceable audit log of AI task type, provider/model used, execution mode `local | cloud`, prompt template version, input/output token counts, latency, credit cost, status, and grounded source entity IDs).
  - `ai_artifacts` / `tailored_cv_drafts` (draft CV tailoring, cover letters, JD summaries, interview prep briefs, linked to `vacancy_id` / `application_id` and `document_version_id`, with explicit `accepted_by_user` approval state).
  - Note: `suitability_evaluations` and `email_communications` already have `suggestions` (`jsonb`), `confidence`, and `classifier_reasons`, AI enhancements should extend these with `evaluation_source` / `ai_run_id` rather than duplicating tables.

### 3.4 Credit-Based Monetization & Indonesia Market Gaps
- **Missing:**
  - `credit_wallets` (current cached balance, currency/tier metadata, `user_id` PK)
  - `credit_ledger_entries` (immutable append-only double-entry/delta log: `grant`, `topup`, `reserve`, `settle`, `refund`, `expire`, `idempotency_key`, `ai_run_id`, balance check `>= 0`)
  - `credit_packages` & `payment_orders` (IDR-first pricing packages, payment gateway provider e.g. Midtrans/Xendit, external order ID, webhook verification status, idempotent fulfillment)
  - `ai_action_pricing` (credit cost table per AI capability & model tier, e.g., local AI = 0 credits vs. cloud AI = N credits)
