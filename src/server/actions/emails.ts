"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { EmailClassification } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { getNotificationsSummary } from "@/server/queries/emails";
import {
  confirmEmailStageTransitionService,
  createRecruiterContactService,
  deleteRecruiterContactService,
  disconnectEmailAccountService,
  dismissNotificationService,
  type IngestEmailInput,
  ingestEmailMessageService,
  linkEmailToApplicationService,
  type recruiterContactSchema,
  syncEmailAccountService,
} from "@/server/services/emails";

function revalidateEmailPaths(applicationId?: string | null) {
  revalidatePath("/emails");
  revalidatePath("/dashboard");
  revalidatePath("/applications");
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}

export async function ingestEmailMessageAction(input: IngestEmailInput) {
  const user = await requireUser();
  const res = await ingestEmailMessageService(user.id, input);
  revalidateEmailPaths(res.email.applicationId);
  return res;
}

export async function syncEmailAccountAction(accountId: string) {
  const user = await requireUser();
  const res = await syncEmailAccountService(user.id, accountId);
  revalidateEmailPaths();
  return res;
}

export async function disconnectEmailAccountAction(accountId: string) {
  const user = await requireUser();
  await disconnectEmailAccountService(user.id, accountId);
  revalidateEmailPaths();
  return { ok: true };
}

export async function linkEmailToApplicationAction(params: {
  emailId: string;
  applicationId: string | null;
  linkStatus: "confirmed" | "unlinked" | "ignored";
  classification?: EmailClassification;
}) {
  const user = await requireUser();
  const updated = await linkEmailToApplicationService(user.id, params);
  revalidateEmailPaths(params.applicationId);
  return updated;
}

export async function confirmEmailStageTransitionAction(params: {
  emailId: string;
  applicationId: string;
  toStageId: string;
  effectiveOn?: string;
  reason?: string | null;
}) {
  const user = await requireUser();
  const res = await confirmEmailStageTransitionService(user.id, params);
  revalidateEmailPaths(params.applicationId);
  return res;
}

export async function createRecruiterContactAction(
  input: z.infer<typeof recruiterContactSchema>,
) {
  const user = await requireUser();
  const contact = await createRecruiterContactService(user.id, input);
  revalidateEmailPaths();
  return contact;
}

export async function deleteRecruiterContactAction(contactId: string) {
  const user = await requireUser();
  await deleteRecruiterContactService(user.id, contactId);
  revalidateEmailPaths();
  return { ok: true };
}

export async function getNotificationsAction() {
  const user = await requireUser();
  return getNotificationsSummary(user.id);
}

export async function dismissNotificationAction(notificationKey: string) {
  const user = await requireUser();
  await dismissNotificationService(user.id, notificationKey);
  revalidatePath("/dashboard");
  return { ok: true };
}
