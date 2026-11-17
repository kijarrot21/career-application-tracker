import { and, desc, eq, inArray } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  syncCheckpoints,
  syncConflicts,
  syncDevices,
  syncEvents,
  syncOutbox,
} from "@/db/schema";
import { env } from "@/lib/env";
import { isSyncCloudExchangeAllowed } from "@/server/services/sync";

export async function listSyncDevicesForUser(userId: string) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(syncDevices)
    .where(eq(syncDevices.userId, userId))
    .orderBy(desc(syncDevices.updatedAt));
}

export async function listSyncOutboxForUser(userId: string, limit = 50) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(syncOutbox)
    .where(eq(syncOutbox.userId, userId))
    .orderBy(desc(syncOutbox.createdAt))
    .limit(limit);
}

export async function listSyncCheckpointsForUser(userId: string) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(syncCheckpoints)
    .where(eq(syncCheckpoints.userId, userId))
    .orderBy(desc(syncCheckpoints.updatedAt));
}

export async function listSyncConflictsForUser(
  userId: string,
  includeResolved = true,
  limit = 40,
) {
  const db = await ensureDbReady();
  const condition = includeResolved
    ? eq(syncConflicts.userId, userId)
    : and(
        eq(syncConflicts.userId, userId),
        eq(syncConflicts.resolutionStatus, "open"),
      );

  return db
    .select()
    .from(syncConflicts)
    .where(condition)
    .orderBy(desc(syncConflicts.createdAt))
    .limit(limit);
}

export async function listSyncEventsForUser(userId: string, limit = 50) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(syncEvents)
    .where(eq(syncEvents.userId, userId))
    .orderBy(desc(syncEvents.seq))
    .limit(limit);
}

export async function getSyncDashboardDataForUser(userId: string) {
  const db = await ensureDbReady();
  const [devices, checkpoints, outbox, conflicts, events] = await Promise.all([
    listSyncDevicesForUser(userId),
    listSyncCheckpointsForUser(userId),
    listSyncOutboxForUser(userId, 60),
    listSyncConflictsForUser(userId, true, 50),
    listSyncEventsForUser(userId, 50),
  ]);

  const pendingOutboxCount = outbox.filter(
    (item) => item.status === "pending" || item.status === "in_flight",
  ).length;
  const failedOutboxCount = outbox.filter(
    (item) => item.status === "failed",
  ).length;
  const openConflictCount = conflicts.filter(
    (c) => c.resolutionStatus === "open",
  ).length;

  const successfulSyncDates = checkpoints
    .map((cp) => cp.lastSuccessfulSyncAt)
    .filter((d): d is Date => d instanceof Date);
  const lastSuccessfulSyncAt =
    successfulSyncDates.length > 0
      ? new Date(Math.max(...successfulSyncDates.map((d) => d.getTime())))
      : null;

  const latestCloudCursor = events.length > 0 ? events[0].seq : 0;

  const activeErrors = [
    ...devices
      .filter((d) => d.lastError)
      .map((d) => ({
        source: `Device: ${d.deviceName}`,
        message: d.lastError!,
      })),
    ...outbox
      .filter((o) => o.status === "failed" && o.lastError)
      .slice(0, 5)
      .map((o) => ({
        source: `Outbox ${o.entityType} (${o.entityId})`,
        message: o.lastError!,
      })),
  ];

  // Ensure any stale pending count across full table beyond 60 is accurate if needed
  const pendingRows = await db
    .select({ id: syncOutbox.id, status: syncOutbox.status })
    .from(syncOutbox)
    .where(
      and(
        eq(syncOutbox.userId, userId),
        inArray(syncOutbox.status, ["pending", "in_flight", "failed"]),
      ),
    );

  return {
    syncMode: isSyncCloudExchangeAllowed() ? "sandbox" : "disabled",
    cloudSyncEnabled: isSyncCloudExchangeAllowed(),
    databaseEngine: env.DATABASE_URL ? "postgresql" : "pglite",
    devices,
    checkpoints,
    outbox,
    conflicts,
    events,
    summary: {
      deviceCount: devices.length,
      activeDeviceCount: devices.filter((d) => d.status === "active").length,
      pendingOutboxCount:
        pendingRows.filter(
          (r) => r.status === "pending" || r.status === "in_flight",
        ).length || pendingOutboxCount,
      failedOutboxCount:
        pendingRows.filter((r) => r.status === "failed").length ||
        failedOutboxCount,
      openConflictCount,
      lastSuccessfulSyncAt,
      latestCloudCursor,
      activeErrors,
    },
  };
}
