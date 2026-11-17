import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import { applications, interviews } from "@/db/schema";
import { executeAiTask } from "../router/ai-task-router";
import {
  interviewCoachSchema,
  type AiInterviewCoachResult,
} from "../schemas";
import { wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  loadUntrustedVacancyContext,
  type AiServiceRuntimeOptions,
} from "./_context";

export const interviewCoachInputSchema = aiExecutionOptionsSchema.extend({
  vacancyId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  interviewId: z.string().uuid().optional(),
  interviewType: z
    .enum(["hr_screening", "user_technical", "system_design", "panel", "final"])
    .optional(),
});

export async function prepareInterviewCoachWithAiService(
  userId: string,
  rawInput: z.input<typeof interviewCoachInputSchema> = {},
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = interviewCoachInputSchema.parse(rawInput);
  const profileCtx = await loadGroundedProfileContext(userId);
  const sources = [profileCtx.source];

  const promptParts = [
    input.interviewType
      ? `Interview Round Focus: ${input.interviewType}`
      : "Prepare role-aligned interview coaching questions and grounded STAR hints.",
    "Verified Master Career Profile (use for STAR examples):",
    profileCtx.serializedJson,
  ];

  let effectiveVacancyId = input.vacancyId;

  if (input.interviewId) {
    const db = await ensureDbReady();
    const [iv] = await db
      .select()
      .from(interviews)
      .where(
        and(eq(interviews.id, input.interviewId), eq(interviews.userId, userId)),
      );
    if (!iv) throw new Error("Interview record not found.");

    const [app] = await db
      .select({ vacancyId: applications.vacancyId })
      .from(applications)
      .where(
        and(
          eq(applications.id, iv.applicationId),
          eq(applications.userId, userId),
        ),
      );
    if (app && !effectiveVacancyId) {
      effectiveVacancyId = app.vacancyId;
    }

    const ivSummary = [
      `Interview Type: ${iv.interviewType}`,
      iv.interviewerPosition
        ? `Interviewer Role: ${iv.interviewerPosition}`
        : null,
      iv.preparationNotes ? `Prep Notes: ${iv.preparationNotes}` : null,
      iv.notes ? `Notes: ${iv.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const guardedIv = wrapUntrustedDataBlock("interview_context", ivSummary);
    promptParts.push("Interview Context:", guardedIv.wrapped);
    sources.push({
      sourceType: "interview",
      sourceId: iv.id,
      sourceLabel: `Interview (${iv.interviewType})`,
      sourceHash: guardedIv.sourceHash,
      isUntrustedExternal: false,
      injectionSignalCount: guardedIv.injectionSignals.length,
    });
  } else if (input.applicationId) {
    const db = await ensureDbReady();
    const [app] = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.id, input.applicationId),
          eq(applications.userId, userId),
        ),
      );
    if (!app) throw new Error("Application not found.");
    if (!effectiveVacancyId) {
      effectiveVacancyId = app.vacancyId;
    }
  }

  if (effectiveVacancyId) {
    const vacancyCtx = await loadUntrustedVacancyContext(
      userId,
      effectiveVacancyId,
    );
    promptParts.push(
      "Target Vacancy Description (untrusted external text):",
      vacancyCtx.guarded.wrapped,
    );
    sources.push(vacancyCtx.source);
  }

  return executeAiTask({
    userId,
    taskType: "interview_coach",
    locale: input.locale,
    schema: interviewCoachSchema,
    schemaName: "InterviewCoach",
    userPrompt: promptParts.join("\n\n"),
    containsPrivateDocuments: true,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    consentGranted: input.consentGranted,
    onConsentRequired: input.onConsentRequired,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
    checkAvailability: input.checkAvailability,
    registry: runtimeOptions?.registry,
    sources,
    extractSummary: (data: AiInterviewCoachResult) => ({
      overallScore: data.overallReadinessScore,
      summaryText: data.summary,
    }),
  });
}
