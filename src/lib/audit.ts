import type { AppDb } from "@/db";
import { auditLogs } from "@/db/schema";

const REDACTED_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "accessToken",
  "refreshToken",
  "encryptedRefreshToken",
  "token",
]);

function redactChanges(changes?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!changes) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(changes)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = val;
    }
  }
  return out;
}

export async function writeAudit(
  dbOrTx: Pick<AppDb, "insert">,
  entry: {
    userId: string;
    entityType: string;
    entityId: string;
    action:
      | "create"
      | "update"
      | "delete"
      | "stage_change"
      | "triage_change"
      | "export"
      | "sample_load"
      | "sample_remove";
    summary?: string;
    changes?: Record<string, unknown>;
  },
): Promise<void> {
  await dbOrTx.insert(auditLogs).values({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    summary: entry.summary ?? null,
    changes: redactChanges(entry.changes) ?? null,
  });
}
