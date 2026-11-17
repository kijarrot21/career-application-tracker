"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  aiFeedbackSchema,
  approveAndRunAiJobService,
  cancelAiJobService,
  submitAiFeedbackService,
} from "@/server/ai/router/ai-task-router";
import {
  applyApprovedCvCorrectionsSchema,
  applyApprovedCvCorrectionsService,
  careerRoadmapInputSchema,
  cvCorrectionInputSchema,
  evaluateCvInputSchema,
  evaluateCvWithAiService,
  generateCareerRoadmapWithAiService,
  generateTailoredCvInputSchema,
  generateTailoredCvWithAiService,
  jobMatchInputSchema,
  matchJobWithAiService,
  parseCvInputSchema,
  parseCvWithAiService,
  saveGeneratedCvAsDocumentVersionService,
  saveGeneratedCvVersionSchema,
  stageAiParsedCvToProfileService,
  suggestCvCorrectionsWithAiService,
} from "@/server/ai/services";
import type { z } from "zod";

function revalidateAiRoutes() {
  revalidatePath("/cv-studio");
  revalidatePath("/profile");
  revalidatePath("/documents");
  revalidatePath("/jobs");
}

export async function parseCvWithAiAction(
  input: z.input<typeof parseCvInputSchema>,
) {
  const user = await requireUser();
  const res = await parseCvWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function stageAiParsedCvToProfileAction(input: {
  analysisId: string;
  sourceDocumentVersionId?: string | null;
}) {
  const user = await requireUser();
  const res = await stageAiParsedCvToProfileService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function evaluateCvWithAiAction(
  input: z.input<typeof evaluateCvInputSchema> = {},
) {
  const user = await requireUser();
  const res = await evaluateCvWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function matchJobWithAiAction(
  input: z.input<typeof jobMatchInputSchema>,
) {
  const user = await requireUser();
  const res = await matchJobWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function suggestCvCorrectionsWithAiAction(
  input: z.input<typeof cvCorrectionInputSchema> = {},
) {
  const user = await requireUser();
  const res = await suggestCvCorrectionsWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function applyApprovedCvCorrectionsAction(
  input: z.input<typeof applyApprovedCvCorrectionsSchema>,
) {
  const user = await requireUser();
  const res = await applyApprovedCvCorrectionsService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function generateTailoredCvWithAiAction(
  input: z.input<typeof generateTailoredCvInputSchema>,
) {
  const user = await requireUser();
  const res = await generateTailoredCvWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function saveGeneratedCvVersionAction(
  input: z.input<typeof saveGeneratedCvVersionSchema>,
) {
  const user = await requireUser();
  const res = await saveGeneratedCvAsDocumentVersionService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function generateCareerRoadmapWithAiAction(
  input: z.input<typeof careerRoadmapInputSchema>,
) {
  const user = await requireUser();
  const res = await generateCareerRoadmapWithAiService(user.id, input);
  revalidateAiRoutes();
  return res;
}

export async function approveAndRunAiJobAction(jobId: string) {
  const user = await requireUser();
  const res = await approveAndRunAiJobService(user.id, jobId);
  revalidateAiRoutes();
  return res;
}

export async function cancelAiJobAction(jobId: string) {
  const user = await requireUser();
  const res = await cancelAiJobService(user.id, jobId);
  revalidateAiRoutes();
  return res;
}

export async function submitAiFeedbackAction(
  input: z.input<typeof aiFeedbackSchema>,
) {
  const user = await requireUser();
  const res = await submitAiFeedbackService(user.id, input);
  revalidateAiRoutes();
  return res;
}
