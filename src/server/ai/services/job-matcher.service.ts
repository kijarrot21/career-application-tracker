import { z } from "zod";
import { executeAiTask } from "../router/ai-task-router";
import { jobMatchSchema, type AiJobMatchResult } from "../schemas";
import { wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  loadUntrustedVacancyContext,
  resolveDocumentTextInput,
  type AiServiceRuntimeOptions,
} from "./_context";

export const jobMatchInputSchema = aiExecutionOptionsSchema.extend({
  vacancyId: z.string().uuid().optional(),
  jobDescriptionText: z.string().trim().min(20).max(40000).optional(),
  documentVersionId: z.string().uuid().optional().nullable(),
  cvText: z.string().trim().max(40000).optional(),
});

export async function matchJobWithAiService(
  userId: string,
  rawInput: z.input<typeof jobMatchInputSchema>,
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = jobMatchInputSchema.parse(rawInput);
  if (!input.vacancyId && !input.jobDescriptionText) {
    throw new Error("Either vacancyId or jobDescriptionText must be provided.");
  }

  const profileCtx = await loadGroundedProfileContext(userId);
  const sources = [profileCtx.source];

  const promptParts = [
    "Compare the candidate's verified Master Career Profile (and selected CV if provided) against the job description.",
    "Return overallMatchScore, matchingSkills, missingSkills, qualificationGaps, transferableSkills, and actionable recommendations.",
    "Verified Candidate Master Career Profile:",
    profileCtx.serializedJson,
  ];

  if (input.documentVersionId || input.cvText) {
    const resolvedDoc = await resolveDocumentTextInput(userId, {
      documentVersionId: input.documentVersionId,
      rawText: input.cvText,
    });
    const guardedCv = wrapUntrustedDataBlock(
      "selected_candidate_cv",
      resolvedDoc.rawText,
    );
    promptParts.push("Selected Candidate CV Version:", guardedCv.wrapped);
    sources.push({
      sourceType: resolvedDoc.sourceType,
      sourceId: resolvedDoc.sourceId,
      sourceLabel: resolvedDoc.sourceLabel,
      sourceHash: guardedCv.sourceHash,
      isUntrustedExternal: true,
      injectionSignalCount: guardedCv.injectionSignals.length,
    });
  }

  if (input.vacancyId) {
    const vacancyCtx = await loadUntrustedVacancyContext(
      userId,
      input.vacancyId,
    );
    promptParts.push("Untrusted External Job Vacancy:", vacancyCtx.guarded.wrapped);
    sources.push(vacancyCtx.source);
  }

  if (input.jobDescriptionText) {
    const guardedJd = wrapUntrustedDataBlock(
      "job_description_input",
      input.jobDescriptionText,
    );
    promptParts.push("Additional Job Description Input:", guardedJd.wrapped);
    sources.push({
      sourceType: "raw_text",
      sourceId: null,
      sourceLabel: "Job Description Text",
      sourceHash: guardedJd.sourceHash,
      isUntrustedExternal: true,
      injectionSignalCount: guardedJd.injectionSignals.length,
    });
  }

  return executeAiTask({
    userId,
    taskType: "job_match",
    locale: input.locale,
    schema: jobMatchSchema,
    schemaName: "JobMatch",
    userPrompt: promptParts.join("\n\n"),
    containsPrivateDocuments: true,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    consentGranted: input.consentGranted,
    onConsentRequired: input.onConsentRequired,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
    checkAvailability: input.checkAvailability,
    pricingKey: input.pricingKey,
    idempotencyKey: input.idempotencyKey,
    registry: runtimeOptions?.registry,
    sources,
    extractSummary: (data: AiJobMatchResult) => ({
      overallScore: data.overallMatchScore,
      summaryText: data.summary,
    }),
  });
}
