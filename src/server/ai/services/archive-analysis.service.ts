import { z } from "zod";
import { API_ERROR_CODES, ApiError } from "@/lib/api/v1";
import { getArchivedApplicationDetail } from "@/server/queries/archive";
import { executeAiTask } from "../router/ai-task-router";
import { skillGapSchema, type AiSkillGapAnalysis } from "../schemas";
import { canonicalSha256, wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  type AiServiceRuntimeOptions,
} from "./_context";

export const analyzeArchivedApplicationInputSchema =
  aiExecutionOptionsSchema.extend({
    closureRecordId: z.string().uuid(),
    focusQuestion: z.string().trim().max(500).optional(),
  });

export async function analyzeArchivedApplicationWithAiService(
  userId: string,
  rawInput: z.input<typeof analyzeArchivedApplicationInputSchema>,
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = analyzeArchivedApplicationInputSchema.parse(rawInput);

  const [detail, profileCtx] = await Promise.all([
    getArchivedApplicationDetail(userId, input.closureRecordId),
    loadGroundedProfileContext(userId),
  ]);

  if (!detail) {
    throw new ApiError(
      API_ERROR_CODES.NOT_FOUND,
      "Archived application record not found.",
      404,
    );
  }

  const snapshotSummary = {
    closureId: detail.closure.id,
    closureOutcome: detail.closure.closureOutcome,
    closureReason: detail.closure.closureReason,
    closureNote: detail.closure.closureNote,
    closedOn: detail.closure.closedOn,
    integrityVerified: detail.integrityVerified,
    companyName: detail.snapshot.companyName,
    jobTitle: detail.snapshot.jobTitle,
    snapshotPayload: detail.snapshot.snapshotPayload,
  };

  const guardedArchive = wrapUntrustedDataBlock(
    "archived_application_snapshot",
    JSON.stringify(snapshotSummary, null, 2),
  );

  const promptParts = [
    "Analyze this archived job application alongside the user's verified Master Career Profile.",
    "Identify skill/qualification gaps and actionable next improvements grounded strictly in recorded closure details and profile evidence.",
    "HONESTY RULE: Never fabricate an employer rejection reason if `closureReason` is empty or unrecorded.",
    input.focusQuestion ? `Focus question: ${input.focusQuestion}` : "",
    "Verified Master Career Profile:",
    profileCtx.serializedJson,
    "Archived Application Snapshot:",
    guardedArchive.wrapped,
  ].filter(Boolean);

  return executeAiTask({
    userId,
    taskType: "skill_gap",
    locale: input.locale,
    schema: skillGapSchema,
    schemaName: "SkillGap",
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
    sources: [
      profileCtx.source,
      {
        sourceType: "archive_snapshot",
        sourceId: detail.snapshot.id,
        sourceLabel: `${detail.snapshot.companyName} - ${detail.snapshot.jobTitle}`,
        sourceHash: canonicalSha256(snapshotSummary),
        isUntrustedExternal: true,
        injectionSignalCount: guardedArchive.injectionSignals.length,
      },
    ],
    extractSummary: (data: AiSkillGapAnalysis) => ({
      overallScore: data.readinessScore,
      summaryText: data.summary,
    }),
  });
}
