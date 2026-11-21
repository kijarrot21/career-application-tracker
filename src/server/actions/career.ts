"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  type assessmentSchema,
  deleteAssessmentService,
  deleteDocumentService,
  deleteInterviewService,
  type jobOfferSchema,
  linkDocumentVersionToApplicationService,
  saveAssessmentService,
  unlinkDocumentVersionFromApplicationService,
  updateDocumentService,
  updateDocumentVersionService,
  type updateDocumentSchema,
  type updateDocumentVersionSchema,
  type updateInterviewFullSchema,
  updateInterviewFullService,
  upsertJobOfferService,
} from "@/server/services/career";

function revalidateCareerPaths(applicationId?: string | null) {
  revalidatePath("/interviews");
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidatePath("/applications");
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}

export async function updateInterviewFullAction(
  input: z.infer<typeof updateInterviewFullSchema>,
) {
  const user = await requireUser();
  const updated = await updateInterviewFullService(user.id, input);
  revalidateCareerPaths(updated.applicationId);
  return updated;
}

export async function deleteInterviewAction(interviewId: string) {
  const user = await requireUser();
  const deleted = await deleteInterviewService(user.id, interviewId);
  revalidateCareerPaths(deleted.applicationId);
  return { ok: true };
}

export async function saveAssessmentAction(
  input: z.infer<typeof assessmentSchema>,
) {
  const user = await requireUser();
  const saved = await saveAssessmentService(user.id, input);
  revalidateCareerPaths(saved.applicationId);
  return saved;
}

export async function deleteAssessmentAction(assessmentId: string) {
  const user = await requireUser();
  const deleted = await deleteAssessmentService(user.id, assessmentId);
  revalidateCareerPaths(deleted.applicationId);
  return { ok: true };
}

export async function upsertJobOfferAction(
  input: z.infer<typeof jobOfferSchema>,
) {
  const user = await requireUser();
  const saved = await upsertJobOfferService(user.id, input);
  revalidateCareerPaths(saved.applicationId);
  return saved;
}

export async function linkDocumentVersionToApplicationAction(params: {
  applicationId: string;
  documentVersionId: string;
  role: "cv" | "cover_letter" | "other";
}) {
  const user = await requireUser();
  const link = await linkDocumentVersionToApplicationService(user.id, params);
  revalidateCareerPaths(params.applicationId);
  return link;
}

export async function unlinkDocumentVersionFromApplicationAction(
  linkId: string,
  applicationId?: string,
) {
  const user = await requireUser();
  await unlinkDocumentVersionFromApplicationService(user.id, linkId);
  revalidateCareerPaths(applicationId);
  return { ok: true };
}

export async function updateDocumentAction(input: z.infer<typeof updateDocumentSchema>) {
  const user = await requireUser();
  const updated = await updateDocumentService(user.id, input);
  revalidateCareerPaths();
  return updated;
}

export async function updateDocumentVersionAction(
  input: z.infer<typeof updateDocumentVersionSchema>,
) {
  const user = await requireUser();
  const updated = await updateDocumentVersionService(user.id, input);
  revalidateCareerPaths();
  return updated;
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requireUser();
  await deleteDocumentService(user.id, documentId);
  revalidateCareerPaths();
  return { ok: true };
}
