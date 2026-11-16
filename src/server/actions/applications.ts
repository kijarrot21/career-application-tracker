"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  completeFollowUpTaskService,
  type createFollowUpSchema,
  createFollowUpTaskService,
  deleteApplicationService,
  type logCommunicationSchema,
  logCommunicationService,
  moveApplicationStageService,
  type MoveStageInput,
  type RecordSubmissionInput,
  recordSubmissionService,
  type scheduleInterviewSchema,
  scheduleInterviewService,
  snoozeFollowUpTaskService,
  type updateApplicationSchema,
  updateApplicationService,
  type updateInterviewOutcomeSchema,
  updateInterviewOutcomeService,
} from "@/server/services/applications";

function revalidateAppPaths(applicationId?: string, vacancyId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/applications");
  revalidatePath("/jobs");
  revalidatePath("/shortlist");
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
  if (vacancyId) revalidatePath(`/jobs/${vacancyId}`);
}

export async function recordSubmissionAction(input: RecordSubmissionInput) {
  const user = await requireUser();
  const created = await recordSubmissionService(user.id, input);
  revalidateAppPaths(created.id, created.vacancyId);
  return created;
}

export async function moveApplicationStageAction(input: MoveStageInput) {
  const user = await requireUser();
  const result = await moveApplicationStageService(user.id, input);
  revalidateAppPaths(input.applicationId, result.application.vacancyId);
  return result;
}

export async function updateApplicationAction(
  applicationId: string,
  input: z.infer<typeof updateApplicationSchema>,
) {
  const user = await requireUser();
  const updated = await updateApplicationService(user.id, applicationId, input);
  revalidateAppPaths(applicationId, updated.vacancyId);
  return updated;
}

export async function deleteApplicationAction(applicationId: string) {
  const user = await requireUser();
  const deleted = await deleteApplicationService(user.id, applicationId);
  revalidateAppPaths(undefined, deleted.vacancyId);
  return { ok: true };
}

export async function logCommunicationAction(
  input: z.infer<typeof logCommunicationSchema>,
) {
  const user = await requireUser();
  const comm = await logCommunicationService(user.id, input);
  revalidateAppPaths(input.applicationId);
  return comm;
}

export async function scheduleInterviewAction(
  input: z.infer<typeof scheduleInterviewSchema>,
) {
  const user = await requireUser();
  const created = await scheduleInterviewService(user.id, input);
  revalidateAppPaths(input.applicationId);
  return created;
}

export async function updateInterviewOutcomeAction(
  applicationId: string,
  input: z.infer<typeof updateInterviewOutcomeSchema>,
) {
  const user = await requireUser();
  const updated = await updateInterviewOutcomeService(user.id, input);
  revalidateAppPaths(applicationId);
  return updated;
}

export async function createFollowUpTaskAction(
  input: z.infer<typeof createFollowUpSchema>,
) {
  const user = await requireUser();
  const task = await createFollowUpTaskService(user.id, input);
  revalidateAppPaths(input.applicationId ?? undefined);
  return task;
}

export async function completeFollowUpTaskAction(
  taskId: string,
  scheduleNext: boolean = true,
) {
  const user = await requireUser();
  const task = await completeFollowUpTaskService(user.id, taskId, scheduleNext);
  revalidateAppPaths(task.applicationId ?? undefined);
  return task;
}

export async function snoozeFollowUpTaskAction(taskId: string, newDueOn: string) {
  const user = await requireUser();
  const task = await snoozeFollowUpTaskService(user.id, taskId, newDueOn);
  revalidateAppPaths(task.applicationId ?? undefined);
  return task;
}
