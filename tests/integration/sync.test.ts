import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { auditLogs, syncCheckpoints, syncEvents, syncOutbox } from "@/db/schema";
import { SyncError, SyncForbiddenEntityError } from "@/lib/domain/sync";
import { getSyncDashboardDataForUser } from "@/server/queries/sync";
import { exportAccountJsonService } from "@/server/services/settings";
import {
  enqueueLocalSyncChangeService,
  processSyncPushBatchService,
  pullSyncChangesService,
  pushDeviceOutboxService,
  registerSyncDeviceService,
  resolveSyncConflictService,
  revokeSyncDeviceService,
  updateDeviceSyncModeService,
} from "@/server/services/sync";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = {
  id: "sync-user-a",
  name: "Alice Sync",
  email: "alice-sync@example.com",
};

const USER_B = {
  id: "sync-user-b",
  name: "Bob Isolated",
  email: "bob-sync@example.com",
};

describe("Phase 7 Integration — Hybrid Local-Cloud Synchronization", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;
  const originalSyncMode = process.env.SYNC_MODE;

  beforeEach(async () => {
    const isolated = await createIsolatedTestDb();
    db = isolated.db;
    cleanup = isolated.cleanup;
    await createTestUser(db, USER_A);
    await createTestUser(db, USER_B);
    process.env.SYNC_MODE = "sandbox";
  }, 30000);

  afterEach(async () => {
    if (originalSyncMode === undefined) {
      delete process.env.SYNC_MODE;
    } else {
      process.env.SYNC_MODE = originalSyncMode;
    }
    await cleanup();
  });

  it("supports offline outbox capture in local_only mode while blocking cloud push until switched", async () => {
    const device = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "offline-laptop",
      deviceName: "Offline Laptop",
      platform: "macOS",
      operationMode: "local_only",
    });

    const queued = await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: device.id,
      entityType: "application",
      entityId: "app-offline-1",
      operation: "create",
      baseVersion: 0,
      payload: { roleTitle: "Staff Engineer", company: "LocalCorp" },
      idempotencyKey: "offline-change-1",
    });

    expect(queued.deduplicated).toBe(false);
    expect(queued.item.status).toBe("pending");

    await expect(
      pushDeviceOutboxService(USER_A.id, { deviceId: device.id }),
    ).rejects.toMatchObject({ code: "SYNC_LOCAL_ONLY_MODE", statusCode: 409 });

    await expect(
      pullSyncChangesService(USER_A.id, { deviceId: device.id }),
    ).rejects.toMatchObject({ code: "SYNC_LOCAL_ONLY_MODE", statusCode: 409 });
  });

  it("enforces SYNC_MODE=disabled approval gate while allowing local offline queuing", async () => {
    process.env.SYNC_MODE = "disabled";

    const device = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "hybrid-gated",
      deviceName: "Hybrid Gated Device",
      operationMode: "hybrid",
    });

    // Offline outbox capture must still work even when cloud exchange is gated
    const queued = await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: device.id,
      entityType: "note",
      entityId: "note-1",
      operation: "create",
      baseVersion: 0,
      payload: { body: "Offline interview prep note" },
    });
    expect(queued.item.status).toBe("pending");

    await expect(
      pushDeviceOutboxService(USER_A.id, { deviceId: device.id }),
    ).rejects.toMatchObject({ code: "SYNC_CLOUD_DISABLED", statusCode: 403 });

    await expect(
      pullSyncChangesService(USER_A.id, { deviceId: device.id }),
    ).rejects.toMatchObject({ code: "SYNC_CLOUD_DISABLED", statusCode: 403 });
  });

  it("performs multi-device hybrid push, incremental cursor pull, and idempotent duplicate protection", async () => {
    const deviceA = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "dev-a",
      deviceName: "Desktop A",
      operationMode: "hybrid",
    });
    const deviceB = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "dev-b",
      deviceName: "Laptop B",
      operationMode: "hybrid",
    });

    const q1 = await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: deviceA.id,
      entityType: "application",
      entityId: "app-100",
      operation: "create",
      baseVersion: 0,
      payload: { company: "Acme", stage: "Applied" },
      idempotencyKey: "k-app-100-create",
    });
    const q2 = await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: deviceA.id,
      entityType: "career_profile",
      entityId: "profile-main",
      operation: "update",
      baseVersion: 0,
      payload: { headline: "Principal Platform Architect" },
      idempotencyKey: "k-profile-update",
    });

    // Duplicate local capture with same idempotencyKey returns existing row
    const qDup = await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: deviceA.id,
      entityType: "application",
      entityId: "app-100",
      operation: "create",
      baseVersion: 0,
      payload: { company: "Acme", stage: "Applied" },
      idempotencyKey: "k-app-100-create",
    });
    expect(qDup.deduplicated).toBe(true);
    expect(qDup.item.id).toBe(q1.item.id);

    const pushRes = await pushDeviceOutboxService(USER_A.id, {
      deviceId: deviceA.id,
    });
    expect(pushRes.status).toBe("synced");
    expect(pushRes.appliedCount).toBe(2);

    // Duplicate remote push with identical idempotencyKey is deduplicated without double event creation
    const replayRes = await processSyncPushBatchService(USER_A.id, {
      deviceId: deviceA.id,
      events: [
        {
          outboxId: q1.item.id,
          entityType: "application",
          entityId: "app-100",
          operation: "create",
          baseVersion: 0,
          payload: { company: "Acme", stage: "Applied" },
          idempotencyKey: "k-app-100-create",
        },
        {
          outboxId: q2.item.id,
          entityType: "career_profile",
          entityId: "profile-main",
          operation: "update",
          baseVersion: 0,
          payload: { headline: "Principal Platform Architect" },
          idempotencyKey: "k-profile-update",
        },
      ],
    });
    expect(replayRes.deduplicatedCount).toBe(2);
    expect(replayRes.appliedCount).toBe(0);

    // Device B pulls incrementally from cursor 0
    const pull1 = await pullSyncChangesService(USER_A.id, {
      deviceId: deviceB.id,
    });
    expect(pull1.events).toHaveLength(2);
    expect(pull1.nextCursor).toBeGreaterThan(0);

    // Second incremental pull returns 0 new events
    const pull2 = await pullSyncChangesService(USER_A.id, {
      deviceId: deviceB.id,
    });
    expect(pull2.events).toHaveLength(0);
    expect(pull2.nextCursor).toBe(pull1.nextCursor);
  });

  it("handles network interruption during push and recovers via retry", async () => {
    const device = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "flaky-device",
      deviceName: "Field Tablet",
      operationMode: "cloud_only",
    });

    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: device.id,
      entityType: "interview",
      entityId: "iv-9",
      operation: "create",
      baseVersion: 0,
      payload: { round: "System Design", outcome: "Scheduled" },
      idempotencyKey: "iv-9-create",
    });

    // Simulate network drop
    const failedRes = await pushDeviceOutboxService(
      USER_A.id,
      { deviceId: device.id },
      {
        transport: async () => {
          throw new Error("ECONNRESET: cloud sync socket interrupted");
        },
      },
    );
    expect(failedRes.status).toBe("retry_scheduled");
    expect(failedRes.error).toContain("ECONNRESET");

    const [failedRow] = await db
      .select()
      .from(syncOutbox)
      .where(eq(syncOutbox.deviceId, device.id));
    expect(failedRow.status).toBe("failed");
    expect(failedRow.retryCount).toBe(1);
    expect(failedRow.nextRetryAt).not.toBeNull();

    const [cpAfterFail] = await db
      .select()
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.deviceId, device.id));
    expect(cpAfterFail.lastError).toContain("ECONNRESET");

    // Manual/immediate retry after connectivity returns
    const retryRes = await pushDeviceOutboxService(USER_A.id, {
      deviceId: device.id,
      ignoreBackoff: true,
    });
    expect(retryRes.status).toBe("synced");
    expect(retryRes.appliedCount).toBe(1);

    const [syncedRow] = await db
      .select()
      .from(syncOutbox)
      .where(eq(syncOutbox.deviceId, device.id));
    expect(syncedRow.status).toBe("synced");
    expect(syncedRow.lastError).toBeNull();
  });

  it("detects version conflicts without silent overwrite and resolves them manually (keep_cloud, keep_local, merged)", async () => {
    const devA = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "con-dev-a",
      deviceName: "Device A",
      operationMode: "hybrid",
    });
    const devB = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "con-dev-b",
      deviceName: "Device B",
      operationMode: "hybrid",
    });

    // Device A writes application v1 cleanly
    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: devA.id,
      entityType: "application_status",
      entityId: "app-shared-1",
      operation: "update",
      baseVersion: 0,
      payload: { stage: "Technical Screen", salary: 25000000 },
      idempotencyKey: "con-a-1",
    });
    await pushDeviceOutboxService(USER_A.id, { deviceId: devA.id });

    // Device B attempts stale edit with baseVersion: 0 -> triggers conflict
    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: devB.id,
      entityType: "application_status",
      entityId: "app-shared-1",
      operation: "update",
      baseVersion: 0,
      payload: { stage: "Offer", salary: 30000000 },
      idempotencyKey: "con-b-stale-1",
    });
    const pushB = await pushDeviceOutboxService(USER_A.id, {
      deviceId: devB.id,
    });
    expect(pushB.status).toBe("partial_conflicts");
    expect(pushB.conflictCount).toBe(1);

    const dashAfterConflict = await getSyncDashboardDataForUser(USER_A.id);
    expect(dashAfterConflict.summary.openConflictCount).toBe(1);
    const conflict = dashAfterConflict.conflicts[0];
    expect(conflict.localVersion).toBe(1);
    expect(conflict.cloudVersion).toBe(1);

    // Resolve via merged payload
    const resolvedMerged = await resolveSyncConflictService(USER_A.id, {
      conflictId: conflict.id,
      resolution: "merged",
      mergedPayload: {
        stage: "Technical Screen",
        salary: 30000000,
        note: "Merged salary update",
      },
    });
    expect(resolvedMerged.conflict.resolutionStatus).toBe("resolved_merged");
    expect(resolvedMerged.syncEvent?.entityVersion).toBe(2);

    // Second conflict scenario -> Keep Cloud
    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: devB.id,
      entityType: "note",
      entityId: "note-conflict-2",
      operation: "update",
      baseVersion: 0,
      payload: { text: "Cloud note" },
      idempotencyKey: "note-cloud-1",
    });
    await pushDeviceOutboxService(USER_A.id, { deviceId: devB.id });

    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: devA.id,
      entityType: "note",
      entityId: "note-conflict-2",
      operation: "update",
      baseVersion: 0,
      payload: { text: "Stale local note" },
      idempotencyKey: "note-stale-a",
    });
    await pushDeviceOutboxService(USER_A.id, { deviceId: devA.id });

    const openList = (await getSyncDashboardDataForUser(USER_A.id)).conflicts.filter(
      (c) => c.resolutionStatus === "open",
    );
    expect(openList).toHaveLength(1);

    const resolvedCloud = await resolveSyncConflictService(USER_A.id, {
      conflictId: openList[0].id,
      resolution: "keep_cloud",
    });
    expect(resolvedCloud.conflict.resolutionStatus).toBe("resolved_keep_cloud");
    expect(resolvedCloud.syncEvent).toBeNull();
  });

  it("merges application_history using append-only semantics without conflict loss", async () => {
    const devA = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "hist-a",
      deviceName: "Hist A",
      operationMode: "hybrid",
    });
    const devB = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "hist-b",
      deviceName: "Hist B",
      operationMode: "hybrid",
    });

    await processSyncPushBatchService(USER_A.id, {
      deviceId: devA.id,
      events: [
        {
          entityType: "application_history",
          entityId: "app-hist-1",
          operation: "append",
          baseVersion: 0,
          payload: { event: "Submitted CV" },
          idempotencyKey: "hist-ev-1",
        },
      ],
    });

    // Concurrent Device B appends with stale baseVersion: 0 -> append-only merges as v2
    const appendB = await processSyncPushBatchService(USER_A.id, {
      deviceId: devB.id,
      events: [
        {
          entityType: "application_history",
          entityId: "app-hist-1",
          operation: "append",
          baseVersion: 0,
          payload: { event: "Recruiter replied" },
          idempotencyKey: "hist-ev-2",
        },
      ],
    });

    expect(appendB.conflictCount).toBe(0);
    expect(appendB.mergedCount).toBe(1);
    expect(appendB.results[0].entityVersion).toBe(2);

    const historyRows = await db
      .select()
      .from(syncEvents)
      .where(eq(syncEvents.entityId, "app-hist-1"));
    expect(historyRows).toHaveLength(2);
  });

  it("rejects forbidden credit/payment sync mutations with security audit and protects existing document versions", async () => {
    const dev = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "sec-dev",
      deviceName: "Security Check Device",
      operationMode: "hybrid",
    });

    await expect(
      enqueueLocalSyncChangeService(USER_A.id, {
        deviceId: dev.id,
        entityType: "credit_wallets",
        entityId: "wallet-1",
        operation: "update",
        baseVersion: 0,
        payload: { availableBalance: 100000 },
      }),
    ).rejects.toThrow(SyncForbiddenEntityError);

    await expect(
      processSyncPushBatchService(USER_A.id, {
        deviceId: dev.id,
        events: [
          {
            entityType: "payment_orders",
            entityId: "order-1",
            operation: "update",
            baseVersion: 0,
            payload: { status: "paid" },
            idempotencyKey: "forbid-pay-1",
          },
        ],
      }),
    ).rejects.toThrow(SyncForbiddenEntityError);

    const securityAudits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityType, "sync_security"));
    expect(securityAudits.length).toBeGreaterThanOrEqual(2);

    // Document version protection: creating v1 succeeds; overwriting v1 in place fails (422)
    await processSyncPushBatchService(USER_A.id, {
      deviceId: dev.id,
      events: [
        {
          entityType: "document",
          entityId: "cv-doc-1",
          operation: "create",
          baseVersion: 0,
          targetVersion: 1,
          payload: { storageKey: "docs/cv-v1.pdf" },
          idempotencyKey: "doc-v1",
        },
      ],
    });

    await expect(
      processSyncPushBatchService(USER_A.id, {
        deviceId: dev.id,
        events: [
          {
            entityType: "document",
            entityId: "cv-doc-1",
            operation: "update",
            baseVersion: 0,
            targetVersion: 1,
            payload: { storageKey: "docs/cv-v1-tampered.pdf" },
            idempotencyKey: "doc-v1-overwrite",
          },
        ],
      }),
    ).rejects.toThrow(SyncError);
  });

  it("enforces strict cross-user sync isolation, device revocation, and UU PDP account export coverage", async () => {
    const aliceDev = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "alice-dev",
      deviceName: "Alice Device",
      operationMode: "hybrid",
    });

    // Bob cannot push, pull, update mode, or revoke Alice's device
    await expect(
      updateDeviceSyncModeService(USER_B.id, {
        deviceId: aliceDev.id,
        operationMode: "local_only",
      }),
    ).rejects.toMatchObject({ code: "SYNC_DEVICE_NOT_FOUND", statusCode: 404 });

    await expect(
      pullSyncChangesService(USER_B.id, { deviceId: aliceDev.id }),
    ).rejects.toMatchObject({ code: "SYNC_DEVICE_NOT_FOUND", statusCode: 404 });

    await expect(
      revokeSyncDeviceService(USER_B.id, aliceDev.id),
    ).rejects.toMatchObject({ code: "SYNC_DEVICE_NOT_FOUND", statusCode: 404 });

    // Alice exports account JSON and sees her sync state; Bob's export sees none of Alice's sync rows
    await enqueueLocalSyncChangeService(USER_A.id, {
      deviceId: aliceDev.id,
      entityType: "application",
      entityId: "alice-app-1",
      operation: "create",
      baseVersion: 0,
      payload: { role: "Frontend Lead" },
    });

    const aliceExport = await exportAccountJsonService(USER_A.id);
    const bobExport = await exportAccountJsonService(USER_B.id);

    expect(aliceExport.syncDevices).toHaveLength(1);
    expect(aliceExport.syncOutbox).toHaveLength(1);
    expect(bobExport.syncDevices).toHaveLength(0);
    expect(bobExport.syncOutbox).toHaveLength(0);

    // Revoking Alice's device blocks further sync mutations
    await revokeSyncDeviceService(USER_A.id, aliceDev.id);
    await expect(
      enqueueLocalSyncChangeService(USER_A.id, {
        deviceId: aliceDev.id,
        entityType: "note",
        entityId: "after-revoke",
        operation: "create",
        baseVersion: 0,
        payload: { text: "Should fail" },
      }),
    ).rejects.toMatchObject({ code: "SYNC_DEVICE_REVOKED", statusCode: 403 });
  });
});
