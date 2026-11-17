import { z } from "zod";
import { executeAiTask } from "../router/ai-task-router";
import { skillGapSchema, type AiSkillGapAnalysis } from "../schemas";
import { wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  loadUntrustedVacancyContext,
  type AiServiceRuntimeOptions,
} from "./_context";

export const skillGapInputSchema = aiExecutionOptionsSchema.extend({
  vacancyId: z.string().uuid().optional(),
  targetRole: z.string().trim().max(160).optional(),
  targetSkills: z.array(z.string().trim().min(1).max(100)).optional(),
});

export async function analyzeSkillGapWithAiService(
  userId: string,
  rawInput: z.input<typeof skillGapInputSchema> = {},
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = skillGapInputSchema.parse(rawInput);
  const profileCtx = await loadGroundedProfileContext(userId);
  const sources = [profileCtx.source];

  const promptParts = [
    input.targetRole
      ? `Target Role: ${input.targetRole}`
      : "Analyze skill gaps against candidate target positions or provided vacancy.",
    input.targetSkills && input.targetSkills.length > 0
      ? `Explicit Target Skills: ${input.targetSkills.join(", ")}`
      : "",
    "Verified Master Career Profile:",
    profileCtx.serializedJson,
  ].filter(Boolean);

  if (input.vacancyId) {
    const vacancyCtx = await loadUntrustedVacancyContext(
      userId,
      input.vacancyId,
    );
    promptParts.push(
      "Target Vacancy Requirements (untrusted external text):",
      vacancyCtx.guarded.wrapped,
    );
    sources.push(vacancyCtx.source);
  } else if (!input.targetRole && !input.targetSkills?.length) {
    const defaultTarget = profileCtx.verifiedProfile.targetPositions.join(", ");
    if (defaultTarget) {
      const guarded = wrapUntrustedDataBlock("target_positions", defaultTarget);
      promptParts.push("Candidate Target Positions:", guarded.wrapped);
    }
  }

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
    registry: runtimeOptions?.registry,
    sources,
    extractSummary: (data: AiSkillGapAnalysis) => ({
      overallScore: data.readinessScore,
      summaryText: data.summary,
    }),
  });
}
