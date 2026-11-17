import { z } from "zod";
import { executeAiTask } from "../router/ai-task-router";
import {
  CV_EVALUATION_CATEGORIES,
  DEFAULT_EVALUATION_DISCLAIMER,
  cvEvaluationSchema,
  type AiCvEvaluation,
} from "../schemas";
import { wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  resolveDocumentTextInput,
  type AiServiceRuntimeOptions,
} from "./_context";

export const evaluateCvInputSchema = aiExecutionOptionsSchema.extend({
  targetRole: z.string().trim().max(160).optional(),
  documentVersionId: z.string().uuid().optional().nullable(),
  cvText: z.string().trim().max(40000).optional(),
});

export async function evaluateCvWithAiService(
  userId: string,
  rawInput: z.input<typeof evaluateCvInputSchema> = {},
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = evaluateCvInputSchema.parse(rawInput);
  const profileCtx = await loadGroundedProfileContext(userId);
  const sources = [profileCtx.source];

  const promptParts = [
    input.targetRole
      ? `Target Role for evaluation context: ${input.targetRole}`
      : "Evaluate overall CV strength for target roles in the candidate profile.",
    `Evaluate all 10 required dimensions in categoryScores: ${CV_EVALUATION_CATEGORIES.join(", ")}.`,
    `Mandatory rule: Set scoreDisclaimer to explain that the score is NOT a hiring probability (default: "${DEFAULT_EVALUATION_DISCLAIMER}").`,
    "Verified Master Career Profile (authoritative factual source):",
    profileCtx.serializedJson,
  ];

  if (input.documentVersionId || input.cvText) {
    const resolvedDoc = await resolveDocumentTextInput(userId, {
      documentVersionId: input.documentVersionId,
      rawText: input.cvText,
    });
    const guarded = wrapUntrustedDataBlock(
      "candidate_cv_text",
      resolvedDoc.rawText,
    );
    promptParts.push("Candidate CV Content to evaluate:", guarded.wrapped);
    sources.push({
      sourceType: resolvedDoc.sourceType,
      sourceId: resolvedDoc.sourceId,
      sourceLabel: resolvedDoc.sourceLabel,
      sourceHash: guarded.sourceHash,
      isUntrustedExternal: true,
      injectionSignalCount: guarded.injectionSignals.length,
    });
  }

  return executeAiTask({
    userId,
    taskType: "cv_evaluate",
    locale: input.locale,
    schema: cvEvaluationSchema,
    schemaName: "CvEvaluation",
    userPrompt: promptParts.join("\n\n"),
    containsPrivateDocuments: true,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    consentGranted: input.consentGranted,
    onConsentRequired: input.onConsentRequired,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
    checkAvailability: input.checkAvailability,
    pricingKey:
      input.pricingKey ??
      (input.documentVersionId || input.cvText
        ? "cv_evaluate_detailed"
        : "cv_evaluate_basic"),
    idempotencyKey: input.idempotencyKey,
    registry: runtimeOptions?.registry,
    sources,
    extractSummary: (data: AiCvEvaluation) => ({
      overallScore: data.overallScore,
      summaryText: data.summary,
    }),
  });
}
