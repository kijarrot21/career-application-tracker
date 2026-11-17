import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps, userId } from "./core";
import {
  syncConflictStatusEnum,
  syncDeviceStatusEnum,
  syncDirectionEnum,
  syncEntityTypeEnum,
  syncOperationEnum,
  syncOperationModeEnum,
  syncOutboxStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// 1. Registered Sync Devices (Per-user local/hybrid endpoints)
// ---------------------------------------------------------------------------
export const syncDevices = pgTable(
  "sync_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    deviceKey: text("device_key").notNull(),
    deviceName: text("device_name").notNull(),
    platform: text("platform").notNull().default("web"),
    operationMode: syncOperationModeEnum("operation_mode")
      .notNull()
      .default("local_only"),
    status: syncDeviceStatusEnum("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    unique("sync_devices_id_user_uq").on(t.id, t.userId),
    uniqueIndex("sync_devices_user_key_uq").on(t.userId, t.deviceKey),
    index("sync_devices_user_status_idx").on(t.userId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// 2. Sync Outbox (Offline local changes waiting for cloud push & retry)
// ---------------------------------------------------------------------------
export const syncOutbox = pgTable(
  "sync_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    deviceId: uuid("device_id").notNull(),
    entityType: syncEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    operation: syncOperationEnum("operation").notNull(),
    baseVersion: integer("base_version").notNull().default(0),
    targetVersion: integer("target_version").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: syncOutboxStatusEnum("status").notNull().default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastError: text("last_error"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("sync_outbox_id_user_uq").on(t.id, t.userId),
    uniqueIndex("sync_outbox_user_idemp_uq").on(t.userId, t.idempotencyKey),
    foreignKey({
      name: "sync_outbox_device_fk",
      columns: [t.deviceId, t.userId],
      foreignColumns: [syncDevices.id, syncDevices.userId],
    }).onDelete("cascade"),
    index("sync_outbox_user_device_status_idx").on(
      t.userId,
      t.deviceId,
      t.status,
      t.createdAt,
    ),
    check("sync_outbox_versions_ck", sql`${t.baseVersion} >= 0 and ${t.targetVersion} >= 1`),
    check("sync_outbox_retry_ck", sql`${t.retryCount} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// 3. Sync Checkpoints (Incremental push/pull cursor per device stream)
// ---------------------------------------------------------------------------
export const syncCheckpoints = pgTable(
  "sync_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    deviceId: uuid("device_id").notNull(),
    streamKey: text("stream_key").notNull().default("default"),
    lastPushCursor: bigint("last_push_cursor", { mode: "number" })
      .notNull()
      .default(0),
    lastPullCursor: bigint("last_pull_cursor", { mode: "number" })
      .notNull()
      .default(0),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", {
      withTimezone: true,
    }),
    lastAttemptedSyncAt: timestamp("last_attempted_sync_at", {
      withTimezone: true,
    }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sync_checkpoints_device_stream_uq").on(
      t.deviceId,
      t.streamKey,
    ),
    foreignKey({
      name: "sync_checkpoints_device_fk",
      columns: [t.deviceId, t.userId],
      foreignColumns: [syncDevices.id, syncDevices.userId],
    }).onDelete("cascade"),
    check(
      "sync_checkpoints_cursors_nonneg_ck",
      sql`${t.lastPushCursor} >= 0 and ${t.lastPullCursor} >= 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4. Sync Conflicts (Explicit version conflict queue for manual resolution)
// ---------------------------------------------------------------------------
export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    deviceId: uuid("device_id").notNull(),
    outboxId: uuid("outbox_id").references(() => syncOutbox.id, {
      onDelete: "set null",
    }),
    entityType: syncEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    localVersion: integer("local_version").notNull(),
    cloudVersion: integer("cloud_version").notNull(),
    localPayload: jsonb("local_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    cloudPayload: jsonb("cloud_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    conflictReason: text("conflict_reason").notNull(),
    resolutionStatus: syncConflictStatusEnum("resolution_status")
      .notNull()
      .default("open"),
    resolvedPayload: jsonb("resolved_payload").$type<Record<
      string,
      unknown
    > | null>(),
    resolvedByUserId: text("resolved_by_user_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "sync_conflicts_device_fk",
      columns: [t.deviceId, t.userId],
      foreignColumns: [syncDevices.id, syncDevices.userId],
    }).onDelete("cascade"),
    index("sync_conflicts_user_status_idx").on(
      t.userId,
      t.resolutionStatus,
      t.createdAt,
    ),
    index("sync_conflicts_entity_idx").on(t.userId, t.entityType, t.entityId),
  ],
);

// ---------------------------------------------------------------------------
// 5. Sync Events (Append-only monotonic cloud event log & pull feed)
// ---------------------------------------------------------------------------
export const syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: serial("seq").notNull(),
    userId: userId(),
    deviceId: uuid("device_id").references(() => syncDevices.id, {
      onDelete: "set null",
    }),
    direction: syncDirectionEnum("direction").notNull().default("push"),
    entityType: syncEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    operation: syncOperationEnum("operation").notNull(),
    entityVersion: integer("entity_version").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    outcome: text("outcome").notNull().default("applied"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sync_events_user_idemp_uq").on(t.userId, t.idempotencyKey),
    index("sync_events_user_seq_idx").on(t.userId, t.seq),
    index("sync_events_user_entity_idx").on(
      t.userId,
      t.entityType,
      t.entityId,
      t.entityVersion,
    ),
    check("sync_events_version_pos_ck", sql`${t.entityVersion} >= 1`),
  ],
);
