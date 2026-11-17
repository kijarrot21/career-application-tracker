import { z } from "zod";
import { executeAiTask } from "../router/ai-task-router";
import { careerRoadmapSchema, type AiCareerRoadmap } from "../schemas";
import {
  aiExecutionOptionsSchema,
  loadApplicationHistoryContext,
  loadGroundedProfileContext,
  type AiServiceRuntimeOptions,
} from "./_context";

export const careerRoadmapInputSchema = aiExecutionOptionsSchema.extend({
  targetRole: z.string().trim().min(2).max(160),
  horizonMonths: z.number().int().min(1).max(36).default(12),
});

export async function generateCareerRoadmapWithAiService(
  userId: string,
  rawInput: z.input<typeof careerRoadmapInputSchema>,
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = careerRoadmapInputSchema.parse(rawInput);
  const [profileCtx, historyCtx] = await Promise.all([
    loadGroundedProfileContext(userId),
    loadApplicationHistoryContext(userId),
  ]);

  const userPrompt = [
    `Generate a comprehensive Career Roadmap toward target role '${input.targetRole}' covering both a 6-month plan (sixMonthPlan) and a 12-month plan (twelveMonthPlan).`,
    "Include careerStrengths, developmentGaps, targetRoles, recommendedSkills, learningPriorities, recommendedCertifications, and recommendedProjects.",
    "STRICT SEPARATION: List directly observed profile/history statements under verifiedFacts and strategic extrapolations under aiInferences.",
    "HONESTY RULE: Never invent or claim actual employer rejection reasons if none are documented in Application History below.",
    "Verified Master Career Profile (authoritative baseline):",
    profileCtx.serializedJson,
    "Verified Application & Closure History Summary:",
    historyCtx.serializedJson,
  ].join("\n\n");

  return executeAiTask({
    userId,
    taskType: "career_roadmap",
    locale: input.locale,
    schema: careerRoadmapSchema,
    schemaName: "CareerRoadmap",
    userPrompt,
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
    sources: [profileCtx.source, historyCtx.source],
    extractSummary: (data: AiCareerRoadmap) => ({
      overallScore: data.readinessScore,
      summaryText: data.summary,
    }),
  });
}
