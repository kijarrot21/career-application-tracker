# Phase 7: Hybrid Local-Cloud Synchronization

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
