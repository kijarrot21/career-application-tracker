# 13. Hybrid Local-Cloud Synchronization

**Phase:** 7: Hybrid Local-Cloud Synchronization
**Status:** Outbox, push/pull/resolve/status endpoints, conflict detection and resolution, Sync Center UI and tenant isolation COMPLETE with local mocks. Live cloud sync NOT TESTED. Cloud exchange BLOCKED until `SYNC_MODE` is enabled.
**Primary Route:** `/sync`

---

## Overview

Phase 7 introduces an explicit, additive synchronization subsystem that works alongside existing **PGlite** (`.data/pglite` / `memory://`) and **PostgreSQL** (`DATABASE_URL`) operation modes without replacing or merging them.

- **Local-Only Mode (`local_only`)**: Works offline with zero cloud connectivity. Local changes are captured in `sync_outbox` and blocked from cloud exchange.
- **Cloud-Only Mode (`cloud_only`)**: Direct cloud synchronization for connected endpoints.
- **Hybrid Mode (`hybrid`)**: Captures local offline edits in `sync_outbox`, pushes idempotent batches with exponential-backoff retry recovery, pulls incremental cloud changes via monotonic `seq` cursors, and flags conflicting mutations for explicit manual resolution.

---

## Database Schema (`src/db/schema/sync.ts`)

1. **`sync_devices`**: Registered per-user endpoints (`deviceKey`, `deviceName`, `platform`, `operationMode`, `status`: `active | paused | revoked`, timestamps, `lastSyncedAt`, `lastError`). Composite unique key `(id, userId)` enforces tenant ownership on all child sync tables.
2. **`sync_outbox`**: Local offline mutation queue (`entityType`, `entityId`, `operation`, `baseVersion`, `targetVersion`, JSON `payload`, SHA-256 `payloadHash`, `idempotencyKey`, `status`, `retryCount`, `nextRetryAt`, `lastError`).
3. **`sync_checkpoints`**: Per-device stream cursors (`lastPushCursor`, `lastPullCursor`, `lastSuccessfulSyncAt`, `lastAttemptedSyncAt`, `lastError`).
4. **`sync_conflicts`**: Explicit version-conflict queue capturing `localVersion`, `cloudVersion`, `localPayload`, `cloudPayload`, `conflictReason`, `resolutionStatus` (`open`, `resolved_keep_local`, `resolved_keep_cloud`, `resolved_merged`, `dismissed`), `resolvedPayload`, and `resolvedByUserId`.
5. **`sync_events`**: Append-only monotonic cloud cursor log (`seq` `SERIAL`, `direction`, `entityType`, `entityId`, `operation`, `entityVersion`, `idempotencyKey`, `outcome`: `applied | merged | conflict`).

---

## Security & Domain Rules (`src/lib/domain/sync.ts`, `src/server/services/sync.ts`)

- **Cloud Authority over Monetization**: Credits (`credit_wallets`, `credit_ledger`, `credit_reservations`, `ai_credit_pricing`) and Payments (`payment_orders`, `payment_transactions`, `payment_webhook_events`) are strictly rejected (`403 SYNC_FORBIDDEN_ENTITY`) on both local capture and cloud push, recording a durable `sync_security` audit log entry.
- **Document & Archive Immutability**:
  - `archive_snapshot` records forbid `update` and `delete` (`422 ARCHIVE_SNAPSHOT_IMMUTABLE`).
  - `document` records reject overwriting existing document versions (`422 DOCUMENT_VERSION_IMMUTABLE`).
- **Append-Only Merging**: `application_history` events merge incrementally (`cloudVersion + 1`, outcome `merged`) rather than raising destructive conflicts.
- **No Silent Overwrites**: Version mismatches (`cloudVersion > baseVersion`) on `application`, `application_status`, `note`, `career_profile`, `document`, `job_vacancy`, and `interview` create an explicit `sync_conflicts` record rather than overwriting cloud data.
- **User Isolation & Rate Limiting**: All endpoints enforce authenticated `user_id` ownership and sliding-window rate limiting (`SYNC_RATE_LIMIT_PER_MIN`, HTTP `429` with `Retry-After`).

---

## API Contracts

- `POST /api/v1/sync/push`: Processes an explicit event batch (`{ deviceId, streamKey?, events }`) or drains the device outbox (`{ mode: "outbox", deviceId, ignoreBackoff? }`).
- `GET / POST /api/v1/sync/pull`: Returns committed cloud `sync_events` strictly after `sinceCursor` (or stored `lastPullCursor`) and updates checkpoints.
- `GET /api/v1/sync/status`: Returns device list, checkpoints, pending/failed outbox counts, active errors, open conflicts, and sync gate status.
- `POST /api/v1/sync/resolve`: Applies manual conflict resolution (`keep_local`, `keep_cloud`, `merged`, `dismissed`).

---

## Approval Gate (`SYNC_MODE`)

Cloud synchronization exchange defaults to **`SYNC_MODE=disabled`**, returning HTTP `403 SYNC_CLOUD_DISABLED` on remote push/pull until explicitly switched to **`SYNC_MODE=sandbox`** (or activated after explicit production approval). Offline device registration and local outbox capture continue operating safely even when `SYNC_MODE=disabled`.

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Sync schema, domain rules and device registration | COMPLETE | `src/db/schema/sync.ts`, `src/lib/domain/sync.ts`, `src/server/services/sync.ts`. |
| Outbox push, incremental cursor pull, status and conflict resolution endpoints | COMPLETE | `src/app/api/v1/sync/push/route.ts`, `pull/route.ts`, `status/route.ts`, `resolve/route.ts`. |
| Conflict detection and keep_cloud, keep_local and merged resolution | COMPLETE | `resolveSyncConflictService()` in `src/server/services/sync.ts`, tested in `tests/integration/sync.test.ts`. |
| Sync Center UI | COMPLETE | `src/components/sync/sync-center-client.tsx`, page `src/app/(app)/sync/page.tsx`. |
| Tenant isolation and forbidden-entity audit logging | COMPLETE | Verified in integration tests. |
| Live cloud synchronization against a real remote | NOT TESTED | `SYNC_MODE` defaults to `"disabled"` and no live remote was configured. Tests exercise mock handlers and in-memory PGlite only. |
| Activating cloud exchange for production | BLOCKED | Requires `SYNC_MODE=sandbox` or explicit production approval. |

## Test evidence

- Unit: `tests/unit/phase7-sync.test.ts` covers forbidden credit/payment entities, archive snapshot and document version immutability, syncable entity set, sliding-window rate limiting and Zod input schemas.
- Integration: `tests/integration/sync.test.ts` (in-memory PGlite) covers offline outbox capture in `local_only`, the `SYNC_MODE=disabled` gate, multi-device hybrid push, cursor pull, idempotency, retry recovery, conflict detection and manual resolution, append-only `application_history` merge, forbidden-entity security audit, cross-user isolation and device revocation.
- Suite totals: 125/125 Vitest tests pass across 25 files, 4/4 Playwright E2E tests pass, typecheck, lint and build are green, and CI is green on commit `2a9540c`.
