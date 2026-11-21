"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  approveCvExtractionService,
  cancelCvExtractionService,
  startCvExtractionService,
} from "@/server/services/document-processing";

function revalidateDocuments() {
  revalidatePath("/documents");
  revalidatePath("/profile");
}

export async function retryCvExtractionAction(versionId: string) {
  const user = await requireUser();
  const result = await startCvExtractionService(user.id, versionId);
  revalidateDocuments();
  return result;
}

export async function approveCvExtractionAction(versionId: string) {
  const user = await requireUser();
  const result = await approveCvExtractionService(user.id, versionId);
  revalidateDocuments();
  return result;
}

export async function cancelCvExtractionAction(versionId: string) {
  const user = await requireUser();
  await cancelCvExtractionService(user.id, versionId);
  revalidateDocuments();
  return { ok: true };
}
