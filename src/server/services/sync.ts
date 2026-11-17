import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  syncCheckpoints,
  syncConflicts,
  syncDevices,
  syncEvents,
  syncOutbox,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  assertSyncableEntityAndOperation,
  SYNC_OPERATION_MODES,
  SYNC_OPERATIONS,
  SyncError,
  SyncForbiddenEntityError,
  type SyncEntityType,
  type SyncOperation,
  type SyncOperationMode,
} from "@/lib/domain/sync";
import { isHybridSyncEnabled } from "@/lib/env";
import { runCreditTx } from "@/server/services/credits";

// ---------------------------------------------------------------------------
// Zod Validation Schemas
// ---------------------------------------------------------------------------

export const registerDeviceSchema = z.object({
  deviceKey: z.string().trim().min(2).max(120),
  deviceName: z.string().trim().min(2).max(120),
  platform: z.string().trim().min(1).max(40).default("web"),
  operationMode: z.enum(SYNC_OPERATION_MODES).default("local_only"),
});

export const updateDeviceModeSchema = z.object({
  deviceId: z.string().uuid(),
  operationMode: z.enum(SYNC_OPERATION_MODES),
  status: z.enum(["active", "paused", "revoked"]).optional(),
});

export const enqueueLocalSyncChangeSchema = z.object({
  deviceId: z.string().uuid(),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().min(1).max(160),
  operation: z.enum(SYNC_OPERATIONS),
  baseVersion: z.number().int().min(0).default(0),
  targetVersion: z.number().int().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().trim().min(4).max(180).optional(),
});

export const syncPushEventInputSchema = z.object({
  outboxId: z.string().uuid().optional(),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().min(1).max(160),
  operation: z.enum(SYNC_OPERATIONS),
  baseVersion: z.number().int().min(0).default(0),
  targetVersion: z.number().int().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().trim().min(4).max(180),
});

export const syncPushBatchSchema = z.object({
  deviceId: z.string().uuid(),
  streamKey: z.string().trim().min(1).max(80).default("default"),
  events: z.array(syncPushEventInputSchema).min(1).max(100),
});

export const syncPullSchema = z.object({
  deviceId: z.string().uuid(),
  streamKey: z.string().trim().min(1).max(80).default("default"),
  sinceCursor: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  excludeSelfDevice: z.boolean().default(false),
});

export const resolveConflictSchema = z.object({
  conflictId: z.string().uuid(),
  resolution: z.enum(["keep_local", "keep_cloud", "merged", "dismissed"]),
  mergedPayload: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers & Approval Gate
// ---------------------------------------------------------------------------

export interface SyncCloudOptions {
  syncModeOverride?: "disabled" | "sandbox";
}

export function isSyncCloudExchangeAllowed(
  override?: "disabled" | "sandbox",
): boolean {
  if (override) return override === "sandbox";
  if (process.env.SYNC_MODE === "sandbox") return true;
  if (process.env.SYNC_MODE === "disabled") return false;
  return isHybridSyncEnabled();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`)
    .join(",")}}`;
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function assertSyncableWithAuditOrThrow(
  userId: string,
  params: {
    entityType: string;
    operation: SyncOperation;
    payload: Record<string, unknown>;
    deviceId: string;
  },
): void {
  try {
    assertSyncableEntityAndOperation(params);
  } catch (err) {
    if (err instanceof SyncForbiddenEntityError) {
      // Best-effort durable audit outside tx in caller wrapper or async helper;
      // synchronous helper leaves caller free to record security event.
      throw err;
    }
    throw err;
  }
}

async function recordForbiddenSyncAttemptAudit(
  userId: string,
  entityType: string,
  entityId: string,
  deviceId: string,
) {
  try {
    const db = await ensureDbReady();
    await writeAudit(db, {
      userId,
      entityType: "sync_security",
      entityId: `${deviceId}:${entityId}`,
      action: "create",
      summary: `Blocked forbidden local-to-cloud sync attempt for cloud-authoritative entity '${entityType}'.`,
      changes: { entityType, entityId, deviceId },
    });
  } catch {
    // Non-fatal if audit cannot flush
  }
}

type TxType = Parameters<Parameters<typeof runCreditTx>[0]>[0];

async function requireDeviceTx(
  tx: TxType,
  userId: string,
  deviceId: string,
  opts?: { allowPaused?: boolean },
) {
  const [device] = await tx
    .select()
    .from(syncDevices)
    .where(and(eq(syncDevices.id, deviceId), eq(syncDevices.userId, userId)));

  if (!device) {
    throw new SyncError(
      "SYNC_DEVICE_NOT_FOUND",
      "Sync device not found or does not belong to the authenticated user.",
      404,
    );
  }
  if (device.status === "revoked") {
    throw new SyncError(
      "SYNC_DEVICE_REVOKED",
      "This sync device has been revoked and cannot sync.",
      403,
    );
  }
  if (device.status === "paused" && !opts?.allowPaused) {
    throw new SyncError(
      "SYNC_DEVICE_PAUSED",
      "Synchronization is currently paused for this device.",
      409,
    );
  }
  return device;
}

async function ensureCheckpointTx(
  tx: TxType,
  userId: string,
  deviceId: string,
  streamKey = "default",
) {
  const [existing] = await tx
    .select()
    .from(syncCheckpoints)
    .where(
      and(
        eq(syncCheckpoints.userId, userId),
        eq(syncCheckpoints.deviceId, deviceId),
        eq(syncCheckpoints.streamKey, streamKey),
      ),
    );
  if (existing) return existing;

  const [created] = await tx
    .insert(syncCheckpoints)
    .values({
      userId,
      deviceId,
      streamKey,
      lastPushCursor: 0,
      lastPullCursor: 0,
    })
    .returning();
  return created;
}

function assertCloudModeReady(
  operationMode: SyncOperationMode,
  options?: SyncCloudOptions,
) {
  if (operationMode === "local_only") {
    throw new SyncError(
      "SYNC_LOCAL_ONLY_MODE",
      "Device is running in local_only offline mode. Switch device mode to hybrid or cloud_only to synchronize with the cloud.",
      409,
    );
  }
  if (!isSyncCloudExchangeAllowed(options?.syncModeOverride)) {
    throw new SyncError(
      "SYNC_CLOUD_DISABLED",
      "Hybrid cloud synchronization is disabled (SYNC_MODE=disabled) pending production approval.",
      403,
    );
  }
}

// ---------------------------------------------------------------------------
// 1. Device Registration & Mode Management
// ---------------------------------------------------------------------------

export async function registerSyncDeviceService(
  userId: string,
  rawInput: z.input<typeof registerDeviceSchema>,
) {
  const input = registerDeviceSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const now = new Date();
    const [existing] = await tx
      .select()
      .from(syncDevices)
      .where(
        and(
          eq(syncDevices.userId, userId),
          eq(syncDevices.deviceKey, input.deviceKey),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(syncDevices)
        .set({
          deviceName: input.deviceName,
          platform: input.platform,
          operationMode: input.operationMode,
          status: existing.status === "revoked" ? "active" : existing.status,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(syncDevices.id, existing.id))
        .returning();

      await ensureCheckpointTx(tx, userId, updated.id, "default");
      await writeAudit(tx, {
        userId,
        entityType: "sync_device",
        entityId: updated.id,
        action: "update",
        summary: `Updated sync device '${updated.deviceName}' (${updated.operationMode}).`,
        changes: {
          deviceKey: updated.deviceKey,
          operationMode: updated.operationMode,
        },
      });
      return updated;
    }

    const [created] = await tx
      .insert(syncDevices)
      .values({
        userId,
        deviceKey: input.deviceKey,
        deviceName: input.deviceName,
        platform: input.platform,
        operationMode: input.operationMode,
        status: "active",
        lastSeenAt: now,
      })
      .returning();

    await ensureCheckpointTx(tx, userId, created.id, "default");
    await writeAudit(tx, {
      userId,
      entityType: "sync_device",
      entityId: created.id,
      action: "create",
      summary: `Registered sync device '${created.deviceName}' (${created.operationMode}).`,
      changes: {
        deviceKey: created.deviceKey,
        platform: created.platform,
        operationMode: created.operationMode,
      },
    });
    return created;
  });
}

export async function updateDeviceSyncModeService(
  userId: string,
  rawInput: z.input<typeof updateDeviceModeSchema>,
) {
  const input = updateDeviceModeSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const existing = await requireDeviceTx(tx, userId, input.deviceId, {
      allowPaused: true,
    });
    const now = new Date();
    const [updated] = await tx
      .update(syncDevices)
      .set({
        operationMode: input.operationMode,
        status: input.status ?? existing.status,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(syncDevices.id, input.deviceId), eq(syncDevices.userId, userId)),
      )
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "sync_device",
      entityId: updated.id,
      action: "update",
      summary: `Changed sync device mode to '${updated.operationMode}'.`,
      changes: {
        fromMode: existing.operationMode,
        toMode: updated.operationMode,
        status: updated.status,
      },
    });
    return updated;
  });
}

export async function revokeSyncDeviceService(
  userId: string,
  deviceId: string,
) {
  const parsedId = z.string().uuid().parse(deviceId);
  return runCreditTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(syncDevices)
      .where(
        and(eq(syncDevices.id, parsedId), eq(syncDevices.userId, userId)),
      );
    if (!existing) {
      throw new SyncError(
        "SYNC_DEVICE_NOT_FOUND",
        "Sync device not found.",
        404,
      );
    }

    const now = new Date();
    const [updated] = await tx
      .update(syncDevices)
      .set({
        status: "revoked",
        updatedAt: now,
      })
      .where(
        and(eq(syncDevices.id, parsedId), eq(syncDevices.userId, userId)),
      )
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "sync_device",
      entityId: updated.id,
      action: "update",
      summary: `Revoked sync device '${updated.deviceName}'.`,
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// 2. Local Change Capture -> Sync Outbox (Works Offline & Local-Only)
// ---------------------------------------------------------------------------

export async function enqueueLocalSyncChangeService(
  userId: string,
  rawInput: z.input<typeof enqueueLocalSyncChangeSchema>,
) {
  const input = enqueueLocalSyncChangeSchema.parse(rawInput);

  try {
    assertSyncableWithAuditOrThrow(userId, {
      entityType: input.entityType,
      operation: input.operation,
      payload: input.payload,
      deviceId: input.deviceId,
    });
  } catch (err) {
    if (err instanceof SyncForbiddenEntityError) {
      await recordForbiddenSyncAttemptAudit(
        userId,
        input.entityType,
        input.entityId,
        input.deviceId,
      );
    }
    throw err;
  }

  const normalizedEntity = input.entityType.trim().toLowerCase() as SyncEntityType;
  const idempotencyKey =
    input.idempotencyKey ??
    `${input.deviceId}:${normalizedEntity}:${input.entityId}:${input.operation}:${input.baseVersion}:${randomUUID()}`;
  const targetVersion = Math.max(
    1,
    input.targetVersion ?? input.baseVersion + 1,
  );
  const payloadHash = computePayloadHash(input.payload);

  return runCreditTx(async (tx) => {
    await requireDeviceTx(tx, userId, input.deviceId, { allowPaused: true });

    const [existing] = await tx
      .select()
      .from(syncOutbox)
      .where(
        and(
          eq(syncOutbox.userId, userId),
          eq(syncOutbox.idempotencyKey, idempotencyKey),
        ),
      );
    if (existing) {
      return { item: existing, deduplicated: true };
    }

    const [created] = await tx
      .insert(syncOutbox)
      .values({
        userId,
        deviceId: input.deviceId,
        entityType: normalizedEntity,
        entityId: input.entityId,
        operation: input.operation,
        baseVersion: input.baseVersion,
        targetVersion,
        payload: input.payload,
        payloadHash,
        idempotencyKey,
        status: "pending",
      })
      .returning();

    return { item: created, deduplicated: false };
  });
}

// ---------------------------------------------------------------------------
// 3. Server-Authoritative Cloud Push Ingestion & Conflict Detection
// ---------------------------------------------------------------------------

export interface PushBatchResultItem {
  idempotencyKey: string;
  outboxId?: string;
  entityType: SyncEntityType;
  entityId: string;
  status: "applied" | "merged" | "deduplicated" | "conflict";
  seq?: number;
  entityVersion?: number;
  conflictId?: string;
}

export interface PushBatchResult {
  deviceId: string;
  streamKey: string;
  results: PushBatchResultItem[];
  appliedCount: number;
  mergedCount: number;
  deduplicatedCount: number;
  conflictCount: number;
  lastPushCursor: number;
}

export async function processSyncPushBatchService(
  userId: string,
  rawInput: z.input<typeof syncPushBatchSchema>,
  options?: SyncCloudOptions,
): Promise<PushBatchResult> {
  const input = syncPushBatchSchema.parse(rawInput);

  // Pre-validate syncable entities before entering transaction so forbidden attempts record audit durably
  for (const event of input.events) {
    try {
      assertSyncableWithAuditOrThrow(userId, {
        entityType: event.entityType,
        operation: event.operation,
        payload: event.payload,
        deviceId: input.deviceId,
      });
    } catch (err) {
      if (err instanceof SyncForbiddenEntityError) {
        await recordForbiddenSyncAttemptAudit(
          userId,
          event.entityType,
          event.entityId,
          input.deviceId,
        );
      }
      throw err;
    }
  }

  return runCreditTx(async (tx) => {
    const device = await requireDeviceTx(tx, userId, input.deviceId);
    assertCloudModeReady(device.operationMode, options);

    const checkpoint = await ensureCheckpointTx(
      tx,
      userId,
      input.deviceId,
      input.streamKey,
    );
    const now = new Date();
    const results: PushBatchResultItem[] = [];
    let maxSeqSeen = checkpoint.lastPushCursor;
    let appliedCount = 0;
    let mergedCount = 0;
    let deduplicatedCount = 0;
    let conflictCount = 0;

    for (const rawEvent of input.events) {
      const entityType = rawEvent.entityType.trim().toLowerCase() as SyncEntityType;
      const targetVersion = Math.max(
        1,
        rawEvent.targetVersion ?? rawEvent.baseVersion + 1,
      );
      const payloadHash = computePayloadHash(rawEvent.payload);

      // 1) Idempotency check on (userId, idempotencyKey)
      const [existingEvent] = await tx
        .select()
        .from(syncEvents)
        .where(
          and(
            eq(syncEvents.userId, userId),
            eq(syncEvents.idempotencyKey, rawEvent.idempotencyKey),
          ),
        );

      if (existingEvent) {
        maxSeqSeen = Math.max(maxSeqSeen, existingEvent.seq);
        deduplicatedCount += 1;
        if (rawEvent.outboxId) {
          await tx
            .update(syncOutbox)
            .set({
              status: existingEvent.outcome === "conflict" ? "conflict" : "synced",
              syncedAt: existingEvent.outcome === "conflict" ? null : now,
              lastError: existingEvent.errorMessage,
              updatedAt: now,
            })
            .where(
              and(
                eq(syncOutbox.id, rawEvent.outboxId),
                eq(syncOutbox.userId, userId),
                eq(syncOutbox.deviceId, input.deviceId),
              ),
            );
        }
        results.push({
          idempotencyKey: rawEvent.idempotencyKey,
          outboxId: rawEvent.outboxId,
          entityType,
          entityId: rawEvent.entityId,
          status: "deduplicated",
          seq: existingEvent.seq,
          entityVersion: existingEvent.entityVersion,
        });
        continue;
      }

      // 2) Inspect latest authoritative cloud state for this entity
      const [latestCloud] = await tx
        .select()
        .from(syncEvents)
        .where(
          and(
            eq(syncEvents.userId, userId),
            eq(syncEvents.entityType, entityType),
            eq(syncEvents.entityId, rawEvent.entityId),
            inArray(syncEvents.outcome, ["applied", "merged"]),
          ),
        )
        .orderBy(desc(syncEvents.entityVersion), desc(syncEvents.seq))
        .limit(1);

      const cloudVersion = latestCloud?.entityVersion ?? 0;

      // 3) Append-only merging rule for application_history
      if (entityType === "application_history") {
        const nextVersion = Math.max(cloudVersion + 1, targetVersion);
        const outcome = rawEvent.baseVersion < cloudVersion ? "merged" : "applied";
        const [inserted] = await tx
          .insert(syncEvents)
          .values({
            userId,
            deviceId: input.deviceId,
            direction: "push",
            entityType,
            entityId: rawEvent.entityId,
            operation: rawEvent.operation === "update" ? "append" : rawEvent.operation,
            entityVersion: nextVersion,
            idempotencyKey: rawEvent.idempotencyKey,
            payload: rawEvent.payload,
            payloadHash,
            outcome,
          })
          .returning();

        maxSeqSeen = Math.max(maxSeqSeen, inserted.seq);
        if (outcome === "merged") {
          mergedCount += 1;
        } else {
          appliedCount += 1;
        }

        if (rawEvent.outboxId) {
          await tx
            .update(syncOutbox)
            .set({
              status: "synced",
              syncedAt: now,
              lastError: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(syncOutbox.id, rawEvent.outboxId),
                eq(syncOutbox.userId, userId),
                eq(syncOutbox.deviceId, input.deviceId),
              ),
            );
        }

        results.push({
          idempotencyKey: rawEvent.idempotencyKey,
          outboxId: rawEvent.outboxId,
          entityType,
          entityId: rawEvent.entityId,
          status: outcome,
          seq: inserted.seq,
          entityVersion: nextVersion,
        });
        continue;
      }

      // 4) Document version immutability protection: never overwrite an existing document version
      if (
        entityType === "document" &&
        cloudVersion > 0 &&
        rawEvent.operation === "update" &&
        targetVersion <= cloudVersion
      ) {
        throw new SyncError(
          "DOCUMENT_VERSION_IMMUTABLE",
          `Existing document version v${cloudVersion} cannot be overwritten; targetVersion must exceed ${cloudVersion}.`,
          422,
        );
      }

      // 5) Version conflict check: baseVersion behind authoritative cloudVersion
      if (cloudVersion > rawEvent.baseVersion) {
        const conflictReason = `Version conflict on ${entityType} (${rawEvent.entityId}): local baseVersion v${rawEvent.baseVersion} is behind cloud v${cloudVersion}.`;

        const [conflict] = await tx
          .insert(syncConflicts)
          .values({
            userId,
            deviceId: input.deviceId,
            outboxId: rawEvent.outboxId ?? null,
            entityType,
            entityId: rawEvent.entityId,
            localVersion: targetVersion,
            cloudVersion,
            localPayload: rawEvent.payload,
            cloudPayload: latestCloud?.payload ?? {},
            conflictReason,
            resolutionStatus: "open",
          })
          .returning();

        const [conflictEvent] = await tx
          .insert(syncEvents)
          .values({
            userId,
            deviceId: input.deviceId,
            direction: "push",
            entityType,
            entityId: rawEvent.entityId,
            operation: rawEvent.operation,
            entityVersion: targetVersion,
            idempotencyKey: rawEvent.idempotencyKey,
            payload: rawEvent.payload,
            payloadHash,
            outcome: "conflict",
            errorMessage: conflictReason,
          })
          .returning();

        maxSeqSeen = Math.max(maxSeqSeen, conflictEvent.seq);
        conflictCount += 1;

        if (rawEvent.outboxId) {
          await tx
            .update(syncOutbox)
            .set({
              status: "conflict",
              lastError: conflictReason,
              updatedAt: now,
            })
            .where(
              and(
                eq(syncOutbox.id, rawEvent.outboxId),
                eq(syncOutbox.userId, userId),
                eq(syncOutbox.deviceId, input.deviceId),
              ),
            );
        }

        results.push({
          idempotencyKey: rawEvent.idempotencyKey,
          outboxId: rawEvent.outboxId,
          entityType,
          entityId: rawEvent.entityId,
          status: "conflict",
          seq: conflictEvent.seq,
          entityVersion: targetVersion,
          conflictId: conflict.id,
        });
        continue;
      }

      // 6) Clean non-conflicting apply
      const nextVersion = Math.max(cloudVersion + 1, targetVersion);
      const [appliedEvent] = await tx
        .insert(syncEvents)
        .values({
          userId,
          deviceId: input.deviceId,
          direction: "push",
          entityType,
          entityId: rawEvent.entityId,
          operation: rawEvent.operation,
          entityVersion: nextVersion,
          idempotencyKey: rawEvent.idempotencyKey,
          payload: rawEvent.payload,
          payloadHash,
          outcome: "applied",
        })
        .returning();

      maxSeqSeen = Math.max(maxSeqSeen, appliedEvent.seq);
      appliedCount += 1;

      if (rawEvent.outboxId) {
        await tx
          .update(syncOutbox)
          .set({
            status: "synced",
            syncedAt: now,
            lastError: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(syncOutbox.id, rawEvent.outboxId),
              eq(syncOutbox.userId, userId),
              eq(syncOutbox.deviceId, input.deviceId),
            ),
          );
      }

      results.push({
        idempotencyKey: rawEvent.idempotencyKey,
        outboxId: rawEvent.outboxId,
        entityType,
        entityId: rawEvent.entityId,
        status: "applied",
        seq: appliedEvent.seq,
        entityVersion: nextVersion,
      });
    }

    await tx
      .update(syncCheckpoints)
      .set({
        lastPushCursor: maxSeqSeen,
        lastAttemptedSyncAt: now,
        lastSuccessfulSyncAt: conflictCount === 0 ? now : checkpoint.lastSuccessfulSyncAt,
        lastError:
          conflictCount > 0
            ? `${conflictCount} conflict(s) detected and queued for manual resolution.`
            : null,
        updatedAt: now,
      })
      .where(eq(syncCheckpoints.id, checkpoint.id));

    await tx
      .update(syncDevices)
      .set({
        lastSeenAt: now,
        lastSyncedAt: conflictCount === 0 ? now : device.lastSyncedAt,
        lastError:
          conflictCount > 0
            ? `${conflictCount} sync conflict(s) require manual resolution.`
            : null,
        updatedAt: now,
      })
      .where(eq(syncDevices.id, device.id));

    if (appliedCount > 0 || mergedCount > 0 || conflictCount > 0) {
      await writeAudit(tx, {
        userId,
        entityType: "sync_push",
        entityId: input.deviceId,
        action: "create",
        summary: `Processed push batch: ${appliedCount} applied, ${mergedCount} merged, ${deduplicatedCount} deduplicated, ${conflictCount} conflict(s).`,
        changes: {
          deviceId: input.deviceId,
          appliedCount,
          mergedCount,
          deduplicatedCount,
          conflictCount,
          lastPushCursor: maxSeqSeen,
        },
      });
    }

    return {
      deviceId: input.deviceId,
      streamKey: input.streamKey,
      results,
      appliedCount,
      mergedCount,
      deduplicatedCount,
      conflictCount,
      lastPushCursor: maxSeqSeen,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Outbox Drain & Network Interruption Retry Recovery
// ---------------------------------------------------------------------------

export type OutboxPushTransport = (
  userId: string,
  batch: z.input<typeof syncPushBatchSchema>,
  options?: SyncCloudOptions,
) => Promise<PushBatchResult>;

export interface DrainOutboxResult {
  status: "idle" | "synced" | "partial_conflicts" | "retry_scheduled";
  attemptedCount: number;
  appliedCount: number;
  mergedCount: number;
  deduplicatedCount: number;
  conflictCount: number;
  error?: string;
}

export async function pushDeviceOutboxService(
  userId: string,
  params: {
    deviceId: string;
    streamKey?: string;
    ignoreBackoff?: boolean;
    limit?: number;
  },
  options?: SyncCloudOptions & { transport?: OutboxPushTransport },
): Promise<DrainOutboxResult> {
  const deviceId = z.string().uuid().parse(params.deviceId);
  const streamKey = params.streamKey?.trim() || "default";
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));

  // Step A: Claim eligible outbox entries atomically & validate mode/gate
  const claimed = await runCreditTx(async (tx) => {
    const device = await requireDeviceTx(tx, userId, deviceId);
    assertCloudModeReady(device.operationMode, options);

    const now = new Date();
    const statusFilter = or(
      eq(syncOutbox.status, "pending"),
      params.ignoreBackoff
        ? eq(syncOutbox.status, "failed")
        : and(
            eq(syncOutbox.status, "failed"),
            or(isNull(syncOutbox.nextRetryAt), lte(syncOutbox.nextRetryAt, now)),
          ),
    );

    const items = await tx
      .select()
      .from(syncOutbox)
      .where(
        and(
          eq(syncOutbox.userId, userId),
          eq(syncOutbox.deviceId, deviceId),
          statusFilter,
        ),
      )
      .orderBy(asc(syncOutbox.createdAt))
      .limit(limit);

    if (items.length === 0) {
      return [];
    }

    await tx
      .update(syncOutbox)
      .set({ status: "in_flight", updatedAt: now })
      .where(
        inArray(
          syncOutbox.id,
          items.map((item) => item.id),
        ),
      );

    return items;
  });

  if (claimed.length === 0) {
    return {
      status: "idle",
      attemptedCount: 0,
      appliedCount: 0,
      mergedCount: 0,
      deduplicatedCount: 0,
      conflictCount: 0,
    };
  }

  // Step B: Execute push transport (local call or injected simulated network transport)
  const transport: OutboxPushTransport =
    options?.transport ?? processSyncPushBatchService;

  try {
    const batchRes = await transport(
      userId,
      {
        deviceId,
        streamKey,
        events: claimed.map((item) => ({
          outboxId: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          baseVersion: item.baseVersion,
          targetVersion: item.targetVersion,
          payload: item.payload,
          idempotencyKey: item.idempotencyKey,
        })),
      },
      options,
    );

    return {
      status: batchRes.conflictCount > 0 ? "partial_conflicts" : "synced",
      attemptedCount: claimed.length,
      appliedCount: batchRes.appliedCount,
      mergedCount: batchRes.mergedCount,
      deduplicatedCount: batchRes.deduplicatedCount,
      conflictCount: batchRes.conflictCount,
    };
  } catch (err) {
    // Non-transient policy errors propagate directly (revert in_flight first)
    const message = err instanceof Error ? err.message : "Sync network failure";
    const isPolicyError = err instanceof SyncError && err.statusCode < 500;

    await runCreditTx(async (tx) => {
      const now = new Date();
      const checkpoint = await ensureCheckpointTx(tx, userId, deviceId, streamKey);
      for (const item of claimed) {
        const nextRetryCount = item.retryCount + 1;
        const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(6, nextRetryCount));
        await tx
          .update(syncOutbox)
          .set({
            status: "failed",
            retryCount: nextRetryCount,
            nextRetryAt: new Date(now.getTime() + backoffMs),
            lastError: message,
            updatedAt: now,
          })
          .where(eq(syncOutbox.id, item.id));
      }

      await tx
        .update(syncCheckpoints)
        .set({
          lastAttemptedSyncAt: now,
          lastError: message,
          updatedAt: now,
        })
        .where(eq(syncCheckpoints.id, checkpoint.id));

      await tx
        .update(syncDevices)
        .set({
          lastError: message,
          updatedAt: now,
        })
        .where(eq(syncDevices.id, deviceId));
    });

    if (isPolicyError) {
      throw err;
    }

    return {
      status: "retry_scheduled",
      attemptedCount: claimed.length,
      appliedCount: 0,
      mergedCount: 0,
      deduplicatedCount: 0,
      conflictCount: 0,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// 5. Incremental Cloud Pull (Cursor-Based)
// ---------------------------------------------------------------------------

export async function pullSyncChangesService(
  userId: string,
  rawInput: z.input<typeof syncPullSchema>,
  options?: SyncCloudOptions,
) {
  const input = syncPullSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const device = await requireDeviceTx(tx, userId, input.deviceId);
    assertCloudModeReady(device.operationMode, options);

    const checkpoint = await ensureCheckpointTx(
      tx,
      userId,
      input.deviceId,
      input.streamKey,
    );
    const effectiveCursor = input.sinceCursor ?? checkpoint.lastPullCursor;

    const conditions = [
      eq(syncEvents.userId, userId),
      gt(syncEvents.seq, effectiveCursor),
      inArray(syncEvents.outcome, ["applied", "merged"]),
    ];
    if (input.excludeSelfDevice) {
      conditions.push(
        or(isNull(syncEvents.deviceId), sql`${syncEvents.deviceId} <> ${input.deviceId}`)!,
      );
    }

    const events = await tx
      .select()
      .from(syncEvents)
      .where(and(...conditions))
      .orderBy(asc(syncEvents.seq))
      .limit(input.limit);

    const now = new Date();
    const lastSeq =
      events.length > 0 ? events[events.length - 1].seq : effectiveCursor;
    const nextCursor = Math.max(checkpoint.lastPullCursor, lastSeq);

    await tx
      .update(syncCheckpoints)
      .set({
        lastPullCursor: nextCursor,
        lastAttemptedSyncAt: now,
        lastSuccessfulSyncAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(syncCheckpoints.id, checkpoint.id));

    await tx
      .update(syncDevices)
      .set({
        lastSeenAt: now,
        lastSyncedAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(syncDevices.id, device.id));

    return {
      deviceId: input.deviceId,
      streamKey: input.streamKey,
      sinceCursor: effectiveCursor,
      nextCursor,
      hasMore: events.length === input.limit,
      events: events.map((ev) => ({
        ...ev,
        isOriginDevice: ev.deviceId === input.deviceId,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// 6. Manual Conflict Resolution
// ---------------------------------------------------------------------------

export async function resolveSyncConflictService(
  userId: string,
  rawInput: z.input<typeof resolveConflictSchema>,
) {
  const input = resolveConflictSchema.parse(rawInput);

  if (input.resolution === "merged" && !input.mergedPayload) {
    throw new SyncError(
      "MERGED_PAYLOAD_REQUIRED",
      "A mergedPayload object is required when resolution is 'merged'.",
      400,
    );
  }

  return runCreditTx(async (tx) => {
    const [conflict] = await tx
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.id, input.conflictId),
          eq(syncConflicts.userId, userId),
        ),
      );

    if (!conflict) {
      throw new SyncError(
        "SYNC_CONFLICT_NOT_FOUND",
        "Sync conflict not found.",
        404,
      );
    }

    const targetStatus =
      input.resolution === "keep_local"
        ? "resolved_keep_local"
        : input.resolution === "keep_cloud"
          ? "resolved_keep_cloud"
          : input.resolution === "merged"
            ? "resolved_merged"
            : "dismissed";

    if (conflict.resolutionStatus !== "open") {
      if (conflict.resolutionStatus === targetStatus) {
        return { conflict, deduplicated: true, syncEvent: null };
      }
      throw new SyncError(
        "SYNC_CONFLICT_ALREADY_RESOLVED",
        `Conflict has already been resolved as '${conflict.resolutionStatus}'.`,
        409,
      );
    }

    const now = new Date();
    const resolvedPayload =
      input.resolution === "keep_local"
        ? conflict.localPayload
        : input.resolution === "keep_cloud"
          ? conflict.cloudPayload
          : input.resolution === "merged"
            ? input.mergedPayload!
            : null;

    let emittedEvent = null;

    if (
      (input.resolution === "keep_local" || input.resolution === "merged") &&
      resolvedPayload
    ) {
      assertSyncableEntityAndOperation({
        entityType: conflict.entityType,
        operation: "update",
        payload: resolvedPayload,
      });

      const nextVersion =
        Math.max(conflict.cloudVersion, conflict.localVersion) + 1;
      const idempotencyKey = `resolve:${conflict.id}:${input.resolution}`;

      const [existingEvent] = await tx
        .select()
        .from(syncEvents)
        .where(
          and(
            eq(syncEvents.userId, userId),
            eq(syncEvents.idempotencyKey, idempotencyKey),
          ),
        );

      if (existingEvent) {
        emittedEvent = existingEvent;
      } else {
        const [createdEvent] = await tx
          .insert(syncEvents)
          .values({
            userId,
            deviceId: conflict.deviceId,
            direction: "resolve",
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            operation: "update",
            entityVersion: nextVersion,
            idempotencyKey,
            payload: resolvedPayload,
            payloadHash: computePayloadHash(resolvedPayload),
            outcome: input.resolution === "merged" ? "merged" : "applied",
          })
          .returning();
        emittedEvent = createdEvent;
      }

      if (conflict.outboxId) {
        await tx
          .update(syncOutbox)
          .set({
            status: "synced",
            syncedAt: now,
            lastError: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(syncOutbox.id, conflict.outboxId),
              eq(syncOutbox.userId, userId),
            ),
          );
      }
    } else if (conflict.outboxId) {
      await tx
        .update(syncOutbox)
        .set({
          status: "discarded",
          lastError: `Conflict resolved via ${input.resolution}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(syncOutbox.id, conflict.outboxId),
            eq(syncOutbox.userId, userId),
          ),
        );
    }

    const [updatedConflict] = await tx
      .update(syncConflicts)
      .set({
        resolutionStatus: targetStatus,
        resolvedPayload,
        resolvedByUserId: userId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(syncConflicts.id, conflict.id), eq(syncConflicts.userId, userId)),
      )
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "sync_conflict",
      entityId: conflict.id,
      action: "update",
      summary: `Manually resolved sync conflict on ${conflict.entityType} (${conflict.entityId}) via '${targetStatus}'.`,
      changes: {
        conflictId: conflict.id,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        resolutionStatus: targetStatus,
        emittedSeq: emittedEvent?.seq ?? null,
      },
    });

    return {
      conflict: updatedConflict,
      deduplicated: false,
      syncEvent: emittedEvent,
    };
  });
}
