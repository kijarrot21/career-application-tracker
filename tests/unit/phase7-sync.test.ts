import { afterEach, describe, expect, it } from "vitest";
import {
  assertSyncableEntityAndOperation,
  FORBIDDEN_SYNC_ENTITIES,
  SYNC_ENTITY_TYPES,
  SyncError,
  SyncForbiddenEntityError,
} from "@/lib/domain/sync";
import { checkRateLimit, resetRateLimitKey } from "@/lib/rate-limit";
import {
  registerDeviceSchema,
  resolveConflictSchema,
  syncPullSchema,
  syncPushBatchSchema,
} from "@/server/services/sync";

afterEach(() => {
  resetRateLimitKey();
});

describe("Phase 7 Domain Rules — Hybrid Local-Cloud Sync", () => {
  it("blocks every cloud-authoritative credit and payment entity from local sync", () => {
    for (const forbidden of FORBIDDEN_SYNC_ENTITIES) {
      expect(() =>
        assertSyncableEntityAndOperation({
          entityType: forbidden,
          operation: "create",
          payload: { availableBalance: 999999 },
        }),
      ).toThrow(SyncForbiddenEntityError);
    }
  });

  it("enforces archive snapshot immutability against update and delete operations", () => {
    expect(() =>
      assertSyncableEntityAndOperation({
        entityType: "archive_snapshot",
        operation: "create",
        payload: { stageName: "Archived" },
      }),
    ).not.toThrow();

    expect(() =>
      assertSyncableEntityAndOperation({
        entityType: "archive_snapshot",
        operation: "update",
        payload: { stageName: "Mutated" },
      }),
    ).toThrow(SyncError);

    expect(() =>
      assertSyncableEntityAndOperation({
        entityType: "archive_snapshot",
        operation: "delete",
      }),
    ).toThrow(SyncError);
  });

  it("forbids overwriting existing document versions while allowing new versions", () => {
    expect(() =>
      assertSyncableEntityAndOperation({
        entityType: "document",
        operation: "create",
        payload: { versionNumber: 2, storageKey: "cvs/v2.pdf" },
      }),
    ).not.toThrow();

    expect(() =>
      assertSyncableEntityAndOperation({
        entityType: "document",
        operation: "update",
        payload: { overwriteExistingVersion: true, storageKey: "cvs/v1.pdf" },
      }),
    ).toThrow(SyncError);
  });

  it("supports all declared syncable career & ATS entities", () => {
    for (const entityType of SYNC_ENTITY_TYPES) {
      expect(() =>
        assertSyncableEntityAndOperation({
          entityType,
          operation: "create",
          payload: { ok: true },
        }),
      ).not.toThrow();
    }
  });
});

describe("Phase 7 Rate Limiter", () => {
  it("enforces sliding-window request caps and resets after the window elapses", () => {
    const t0 = 1_700_000_000_000;
    const key = "sync:user-1:push";

    expect(checkRateLimit({ key, maxRequests: 2, windowMs: 1000, nowMs: t0 }).allowed).toBe(true);
    expect(checkRateLimit({ key, maxRequests: 2, windowMs: 1000, nowMs: t0 + 100 }).allowed).toBe(true);

    const blocked = checkRateLimit({ key, maxRequests: 2, windowMs: 1000, nowMs: t0 + 200 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    const recovered = checkRateLimit({ key, maxRequests: 2, windowMs: 1000, nowMs: t0 + 1_100 });
    expect(recovered.allowed).toBe(true);
    expect(recovered.remaining).toBe(1);
  });
});

describe("Phase 7 Zod Input Schemas", () => {
  it("validates device registration, batch push, pull, and resolution payloads", () => {
    const device = registerDeviceSchema.parse({
      deviceKey: "macbook-01",
      deviceName: "Work Mac",
      operationMode: "hybrid",
    });
    expect(device.platform).toBe("web");

    const push = syncPushBatchSchema.parse({
      deviceId: "11111111-1111-4111-8111-111111111111",
      events: [
        {
          entityType: "application",
          entityId: "app-1",
          operation: "create",
          baseVersion: 0,
          payload: { company: "Acme" },
          idempotencyKey: "idem-0001",
        },
      ],
    });
    expect(push.streamKey).toBe("default");

    const pull = syncPullSchema.parse({
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(pull.limit).toBe(50);

    const resolved = resolveConflictSchema.parse({
      conflictId: "22222222-2222-4222-8222-222222222222",
      resolution: "merged",
      mergedPayload: { status: "interview" },
    });
    expect(resolved.resolution).toBe("merged");
  });
});
