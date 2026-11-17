"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  type archiveApplicationSchema,
  archiveApplicationService,
  deleteArchiveRecordService,
  purgeExpiredArchivesService,
  type reapplyFromArchiveSchema,
  reapplyFromArchiveService,
  type restoreArchivedApplicationSchema,
  restoreArchivedApplicationService,
  type retentionPolicySchema,
  type updateClosureRetentionSchema,
  updateClosureRetentionService,
  updateRetentionPolicyService,
} from "@/server/services/archive";

function revalidateArchivePaths(
  closureRecordId?: string,
  applicationId?: string,
) {
  revalidatePath("/archive");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/analytics");
  revalidatePath("/settings");
  if (closureRecordId) {
    revalidatePath(`/archive/${closureRecordId}`);
  }
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}

export async function archiveApplicationAction(
  input: z.infer<typeof archiveApplicationSchema>,
) {
  const user = await requireUser();
  const result = await archiveApplicationService(user.id, input);
  revalidateArchivePaths(result.closureRecord.id, input.applicationId);
  return result;
}

export async function restoreArchivedApplicationAction(
  input: z.infer<typeof restoreArchivedApplicationSchema>,
) {
  const user = await requireUser();
  const result = await restoreArchivedApplicationService(user.id, input);
  revalidateArchivePaths(result.closureRecord.id, result.application.id);
  return result;
}

export async function reapplyFromArchiveAction(
  input: z.infer<typeof reapplyFromArchiveSchema>,
) {
  const user = await requireUser();
  const created = await reapplyFromArchiveService(user.id, input);
  revalidateArchivePaths(input.closureRecordId, created.id);
  return created;
}

export async function updateRetentionPolicyAction(
  input: z.infer<typeof retentionPolicySchema>,
) {
  const user = await requireUser();
  const updated = await updateRetentionPolicyService(user.id, input);
  revalidateArchivePaths();
  return updated;
}

export async function updateClosureRetentionAction(
  input: z.infer<typeof updateClosureRetentionSchema>,
) {
  const user = await requireUser();
  const updated = await updateClosureRetentionService(user.id, input);
  revalidateArchivePaths(updated.id, updated.applicationId);
  return updated;
}

export async function deleteArchiveRecordAction(closureRecordId: string) {
  const user = await requireUser();
  const deleted = await deleteArchiveRecordService(user.id, closureRecordId);
  revalidateArchivePaths(closureRecordId, deleted.applicationId);
  return { ok: true };
}

export async function purgeExpiredArchivesAction() {
  const user = await requireUser();
  const result = await purgeExpiredArchivesService(user.id);
  revalidateArchivePaths();
  return result;
}
