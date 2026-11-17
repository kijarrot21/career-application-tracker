export const SYNC_OPERATION_MODES = [
  "local_only",
  "cloud_only",
  "hybrid",
] as const;
export type SyncOperationMode = (typeof SYNC_OPERATION_MODES)[number];

export const SYNC_OPERATION_MODE_LABELS: Record<SyncOperationMode, string> = {
  local_only: "Local-Only (PGlite Offline)",
  cloud_only: "Cloud-Only (Direct PostgreSQL)",
  hybrid: "Hybrid (Local PGlite + Cloud Sync)",
};

export const SYNC_DEVICE_STATUSES = ["active", "paused", "revoked"] as const;
export type SyncDeviceStatus = (typeof SYNC_DEVICE_STATUSES)[number];

export const SYNC_ENTITY_TYPES = [
  "application",
  "application_status",
  "note",
  "career_profile",
  "document",
  "application_history",
  "archive_snapshot",
  "job_vacancy",
  "interview",
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_ENTITY_LABELS: Record<SyncEntityType, string> = {
  application: "Application Record",
  application_status: "Application Status",
  note: "Notes",
  career_profile: "Master Career Profile",
  document: "Document Metadata / New Version",
  application_history: "Application History (Append-Only)",
  archive_snapshot: "Archive Snapshot (Immutable)",
  job_vacancy: "Job Vacancy",
  interview: "Interview Record",
};

/**
 * Entities strictly governed by cloud server authority; local devices may NEVER
 * push or modify them through synchronization.
 */
export const FORBIDDEN_SYNC_ENTITIES = new Set([
  "credit_wallet",
  "credit_wallets",
  "credit_ledger",
  "credit_reservation",
  "credit_reservations",
  "ai_credit_pricing",
  "payment_order",
  "payment_orders",
  "payment_transaction",
  "payment_transactions",
  "payment_webhook_event",
  "payment_webhook_events",
]);

export const SYNC_OPERATIONS = [
  "create",
  "update",
  "append",
  "delete",
] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const SYNC_OUTBOX_STATUSES = [
  "pending",
  "in_flight",
  "synced",
  "conflict",
  "failed",
  "discarded",
] as const;
export type SyncOutboxStatus = (typeof SYNC_OUTBOX_STATUSES)[number];

export const SYNC_CONFLICT_STATUSES = [
  "open",
  "resolved_keep_local",
  "resolved_keep_cloud",
  "resolved_merged",
  "dismissed",
] as const;
export type SyncConflictStatus = (typeof SYNC_CONFLICT_STATUSES)[number];

export const SYNC_DIRECTIONS = ["push", "pull", "resolve", "system"] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export class SyncError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class SyncForbiddenEntityError extends SyncError {
  constructor(entityType: string) {
    super(
      "SYNC_FORBIDDEN_ENTITY",
      `Entity '${entityType}' is cloud-authoritative and cannot be synchronized from local devices.`,
      403,
    );
    this.name = "SyncForbiddenEntityError";
  }
}

export function assertSyncableEntityAndOperation(params: {
  entityType: string;
  operation: SyncOperation;
  payload?: Record<string, unknown>;
}) {
  const normalized = params.entityType.trim().toLowerCase();
  if (FORBIDDEN_SYNC_ENTITIES.has(normalized)) {
    throw new SyncForbiddenEntityError(params.entityType);
  }
  if (!SYNC_ENTITY_TYPES.includes(normalized as SyncEntityType)) {
    throw new SyncError(
      "UNSUPPORTED_SYNC_ENTITY",
      `Unsupported sync entity type '${params.entityType}'.`,
      400,
    );
  }
  if (
    normalized === "archive_snapshot" &&
    (params.operation === "update" || params.operation === "delete")
  ) {
    throw new SyncError(
      "ARCHIVE_SNAPSHOT_IMMUTABLE",
      "Historical archive snapshots are immutable and cannot be updated or deleted via sync.",
      422,
    );
  }
  if (
    normalized === "document" &&
    params.operation === "update" &&
    params.payload?.overwriteExistingVersion === true
  ) {
    throw new SyncError(
      "DOCUMENT_VERSION_IMMUTABLE",
      "Existing document versions are immutable; sync must create a new document version instead of overwriting.",
      422,
    );
  }
}
