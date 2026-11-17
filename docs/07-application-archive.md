# 07. Application Archive Module

**Phase:** 1: Application Archive  
**Status:** Implemented  
**Primary Routes:** `/archive`, `/archive/[id]`

---

## 1. Purpose & Design Principles

The **Application Archive** preserves a complete, tamper-evident historical record whenever a job application reaches a terminal outcome, without deleting or mutating the original application row or breaking existing pipeline workflows.

Core guarantees:
1. **Original Records Remain Intact:** Archival creates closure metadata and an immutable snapshot while keeping `applications` and all related records intact.
2. **Immutable Historical Snapshots:** `application_archive_snapshots` captures a frozen point-in-time JSONB payload and a canonical SHA-256 `content_hash` computed via recursive key-sorted JSON serialization (`computeSnapshotContentHash`). Snapshots are never updated or overwritten, even when an application is later edited or restored.
3. **Idempotent / Duplicate-Safe:** A partial unique index (`app_closure_active_app_uq` on `(application_id) WHERE status = 'archived'`) plus transactional pre-checks ensure an application can never have duplicate active closure records.
4. **Per-User Tenant Isolation:** All three archive tables enforce `user_id` ownership and composite foreign keys `(parent_id, user_id)` referencing `applications`, `job_vacancies`, `application_closure_records`, and `application_archive_snapshots`.
5. **Document & Version Preservation:** `application_archive_documents` captures document metadata (`document_title`, `version_no`, `version_label`, `filename`, `mime_type`, `size_bytes`, `sha256`, `storage_key`) with `ON DELETE SET NULL` references to `documents` and `document_versions`, ensuring archive document history survives even if the live document is later deleted.

---

## 2. Supported Terminal Outcomes & Triggers

| Closure Outcome | Application Outcome | Trigger Paths |
|---|---|---|
| `rejected` | `unsuccessful` | Auto-archived on transition to a `rejected` stage (Kanban, MoveStageDialog, Email confirmation) or manual archive |
| `withdrawn` | `withdrawn` | Auto-archived on transition to a `withdrawn` stage (including declined offer sync) or manual archive |
| `hired` | `successful` | Auto-archived on transition to a `hired` stage (including accepted offer sync) or manual archive |
| `no_response` | `no_response` | Auto-archived on user-confirmed No Response transition or manual archive |
| `closed` | `closed` | Manual closure & archive (e.g., role filled/cancelled) without requiring a separate terminal stage |

Auto-archival is controlled by `user_settings.auto_archive_on_terminal` (default `true`) and executed inside the same database transaction in `moveApplicationStageService` (`src/server/services/applications.ts`).

---

## 3. Database Schema

Added in migration `0001_parallel_omega_flight.sql` (`src/db/schema/applications.ts`, `src/db/schema/core.ts`, `src/db/schema/enums.ts`):

1. **`application_closure_records`**
   - Tracks lifecycle status (`archived` | `restored`), `closure_outcome`, `closure_source`, `closed_on`, `archived_at`, `previous_stage_id`, `previous_outcome`, `closed_stage_id`, `closure_reason`, `closure_note`, `retain_until`, `restored_at`, `restored_to_stage_id`, `restoration_reason`, and `is_sample`.
   - Partial unique index `app_closure_active_app_uq` prevents duplicate active archives for the same application.
2. **`application_archive_snapshots`**
   - 1:1 with `application_closure_records` (`app_archive_snapshots_closure_uq`), storing `snapshot_version`, `content_hash` (SHA-256), and `snapshot_payload` (`ApplicationArchiveSnapshotPayload` v1):
     - Application metadata & stage at closure
     - Vacancy & company snapshot
     - Suitability evaluation scores & notes
     - Full ordered `application_status_history`
     - `email_communications`
     - `interviews` & `assessments`
     - `job_offers` & `follow_up_tasks`
     - Preserved document references
3. **`application_archive_documents`**
   - Preserves relational links and immutable metadata for attached `application_documents`, direct `cv_version_id` / `cover_letter_version_id`, and label-only CV / cover letter references.
4. **`user_settings` Extensions**
   - `auto_archive_on_terminal` (`boolean`, default `true`)
   - `archive_retention_days` (`integer`, nullable, check `30..3650`)
   - `archive_auto_delete_expired` (`boolean`, default `false`)

---

## 4. Workflows & Server Services (`src/server/services/archive.ts`)

- **`archiveApplicationTx` / `archiveApplicationService`:** Transactionally transitions active applications if manually archived, inserts `application_closure_records`, freezes `application_archive_snapshots` with SHA-256 hash, preserves `application_archive_documents`, and logs to `audit_logs`. Idempotent when an active `archived` closure record already exists.
- **`restoreArchivedApplicationService`:** Transactionally restores an incorrectly archived application to a chosen (or previous) active stage, sets `outcome = 'active'`, appends a `reopen` row to `application_status_history`, marks the closure record `status = 'restored'` with timestamp and reason, and leaves the historical snapshot untouched.
- **`reapplyFromArchiveService`:** Validates there is no active application on the vacancy and delegates to `recordSubmissionService` with `isIntentionalReapply: true`, creating a new attempt (`attemptNumber + 1`) while preserving prior archive records.
- **`updateRetentionPolicyService` / `updateClosureRetentionService` / `purgeExpiredArchivesService` / `deleteArchiveRecordService`:** Manages retention deadlines and user-confirmed deletion of archive records while leaving original `applications` records intact.

---

## 5. User Interface

- **Navigation:** `Archive` link in `AppSidebar` (`src/components/layout/app-sidebar.tsx`) and `CommandMenu` (`src/components/layout/command-menu.tsx`), protected by `src/proxy.ts` and `requireUser()`.
- **Archive Table (`/archive`):** Outcome KPI strip, retention status banner, search & filter bar (search, outcome, company, job title, closure date range, archive status), sortable `DataTable`, manual archive dialog, restore dialog, re-apply dialog, and retention policy modal.
- **Archive Detail (`/archive/[id]`):** SHA-256 integrity verification badge, retention editor, restore/re-apply/delete controls, **AI Career Post-Mortem & Outcome Insights** placeholder (explicitly disabled until the Hybrid AI phase), and 4 tabs (`Overview & Fit`, `Historical Timeline`, `Comms, Interviews & Offers`, `Document History`).
- **Application Detail Integration (`/applications/[id]`):** Displays `Archive` button for unarchived applications or `View Archive Snapshot` link when archived.
