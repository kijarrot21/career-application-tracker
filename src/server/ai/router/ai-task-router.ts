import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  aiAnalysisJobs,
  aiAnalysisSources,
  aiCareerAnalyses,
  aiFeedback,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import type {
  AiFeedbackAction,
  AiLocale,
  AiLocality,
  AiProviderId,
  AiSourceType,
  AiTaskType,
  AiUsageMetadata,
} from "@/lib/domain/ai";
import { getUserSettings } from "@/server/queries/settings";
import {
  captureCreditReservationService,
  releaseCreditReservationService,
  reserveCreditsForAiTaskService,
  resolveAiTaskPricingService,
} from "@/server/services/credits";
import { ensurePromptVersionRecorded } from "../prompts/prompt-registry";
import {
  AiProviderError,
  type AiModelConfig,
  type AiProvider,
  type AiProviderRegistry,
  createDefaultProviderRegistry,
} from "../providers";
import {
  careerRoadmapSchema,
  correctionResultSchema,
  cvDataSchema,
  cvEvaluationSchema,
  cvGenerationSchema,
  interviewCoachSchema,
  jobMatchSchema,
  skillGapSchema,
} from "../schemas";
import { canonicalSha256, minimizeCloudPii } from "../security/prompt-guard";
import { toAiLocale } from "@/lib/i18n";
import { selectAiProvider } from "./provider-selector";

export interface AiTaskSourceInput {
  sourceType: AiSourceType;
  sourceId?: string | null;
  sourceLabel?: string | null;
  sourceHash: string;
  isUntrustedExternal?: boolean;
  injectionSignalCount?: number;
}

export interface ExecuteAiTaskParams<TSchema extends z.ZodTypeAny> {
  userId: string;
  taskType: AiTaskType;
  locale?: AiLocale;
  schema: TSchema;
  schemaName: string;
  userPrompt: string;
  sources: AiTaskSourceInput[];
  containsPrivateDocuments?: boolean;
  requestedProvider?: AiProviderId;
  requestedModel?: string;
  consentGranted?: boolean;
  onConsentRequired?: "pause" | "throw";
  maxAttempts?: number;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  checkAvailability?: boolean;
  pricingKey?: string;
  idempotencyKey?: string;
  registry?: AiProviderRegistry;
  extractSummary?: (data: z.infer<TSchema>) => {
    overallScore?: number | null;
    summaryText?: string | null;
  };
}

export type AiTaskExecutionResult<TOutput> =
  | {
      status: "completed";
      jobId: string;
      analysisId: string;
      provider: AiProviderId;
      locality: AiLocality;
      model: string;
      promptVersionTag: string;
      usage: AiUsageMetadata;
      creditCost: number;
      creditReservationId: string | null;
      deduplicated?: boolean;
      data: TOutput;
    }
  | {
      status: "awaiting_consent";
      jobId: string;
      provider: AiProviderId;
      locality: AiLocality;
      model: string;
      promptVersionTag: string;
      consentReason: string;
      estimatedUsage: AiUsageMetadata;
      estimatedCreditCost: number;
      pricingKey: string;
    };

const SCHEMA_BY_TASK: Record<AiTaskType, { schema: z.ZodTypeAny; name: string }> = {
  cv_parse: { schema: cvDataSchema, name: "CvData" },
  cv_evaluate: { schema: cvEvaluationSchema, name: "CvEvaluation" },
  job_match: { schema: jobMatchSchema, name: "JobMatch" },
  cv_correction: { schema: correctionResultSchema, name: "CorrectionResult" },
  cv_generate: { schema: cvGenerationSchema, name: "CvGeneration" },
  skill_gap: { schema: skillGapSchema, name: "SkillGap" },
  career_roadmap: { schema: careerRoadmapSchema, name: "CareerRoadmap" },
  interview_coach: { schema: interviewCoachSchema, name: "InterviewCoach" },
};

function defaultSummaryExtractor(
  data: unknown,
): { overallScore?: number | null; summaryText?: string | null } {
  if (!data || typeof data !== "object") return {};
  const obj = data as Record<string, unknown>;
  const rawScore =
    typeof obj.overallScore === "number"
      ? obj.overallScore
      : typeof obj.overallMatchScore === "number"
        ? obj.overallMatchScore
        : typeof obj.readinessScore === "number"
          ? obj.readinessScore
          : typeof obj.overallReadinessScore === "number"
            ? obj.overallReadinessScore
            : null;
  const clampedScore =
    rawScore !== null && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore)))
      : null;
  const summaryText =
    typeof obj.summary === "string"
      ? obj.summary
      : typeof obj.tailoredSummary === "string"
        ? obj.tailoredSummary
        : null;
  return { overallScore: clampedScore, summaryText };
}

function clampAttempts(raw?: number): number {
  if (raw == null || !Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(5, Math.round(raw)));
}

/**
 * Merges per-task overrides into the selected provider/model configuration.
 * Nullish values are ignored so a valid selection or provider default is never
 * replaced with `undefined` / `null` (the latter is how paused jobs persist
 * "no override"). Used by both new executions and consent resumptions.
 */
export function mergeExecutionModelConfig(
  selected: AiModelConfig,
  overrides: {
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number | null;
  },
): AiModelConfig {
  return {
    ...selected,
    temperature: overrides.temperature ?? selected.temperature,
    maxOutputTokens:
      overrides.maxOutputTokens ?? selected.maxOutputTokens,
    timeoutMs: overrides.timeoutMs ?? selected.timeoutMs,
  };
}

/**
 * Orchestrates privacy-mode checks, consent gates, prompt versioning, provider
 * retries, Zod structured validation, and atomic persistence in `ai_analysis_jobs`,
 * `ai_career_analyses`, and `ai_analysis_sources`.
 */
export async function executeAiTask<TSchema extends z.ZodTypeAny>(
  params: ExecuteAiTaskParams<TSchema>,
): Promise<AiTaskExecutionResult<z.infer<TSchema>>> {
  const db = await ensureDbReady();
  const settings = await getUserSettings(params.userId);
  const locale: AiLocale =
    params.locale ?? toAiLocale(settings.preferredLocale);
  const maxAttempts = clampAttempts(params.maxAttempts);
  const containsPrivateDocuments = params.containsPrivateDocuments ?? true;
  const registry = params.registry ?? createDefaultProviderRegistry();

  const { promptVersionId, resolved: promptTemplate } =
    await ensurePromptVersionRecorded(db, params.taskType, locale);

  const selection = await selectAiProvider({
    privacyMode: settings.aiPrivacyMode,
    preferredProvider: settings.aiPreferredProvider,
    requestedProvider: params.requestedProvider,
    requestedModel: params.requestedModel,
    ollamaEndpoint: settings.aiOllamaEndpoint,
    ollamaModel: settings.aiOllamaModel,
    cloudDocumentConsent: settings.aiCloudDocumentConsent,
    containsPrivateDocuments,
    perTaskConsentGranted: params.consentGranted,
    checkAvailability: params.checkAvailability,
    registry,
  });

  const inputHash = canonicalSha256({
    taskType: params.taskType,
    locale,
    promptVersionTag: promptTemplate.tag,
    userPrompt: params.userPrompt,
    sources: params.sources.map((s) => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId ?? null,
      sourceHash: s.sourceHash,
    })),
  });

  const estimatedUsage = selection.provider.estimateUsage({
    systemPrompt: promptTemplate.systemPrompt,
    userPrompt: params.userPrompt,
    modelConfig: selection.modelConfig,
  });

  const pricing = await resolveAiTaskPricingService({
    pricingKey: params.pricingKey,
    taskType: params.taskType,
    locality: selection.locality,
  });

  // Consent Gate: do NOT reserve credits or call any provider without consent
  if (selection.consentRequired && !selection.consentGranted) {
    const reason =
      selection.consentReason ??
      "Explicit user consent is required before executing this AI task.";

    const [pausedJob] = await db.transaction(async (tx) => {
      const [insertedJob] = await tx
        .insert(aiAnalysisJobs)
        .values({
          userId: params.userId,
          taskType: params.taskType,
          provider: selection.providerId,
          locality: selection.locality,
          model: selection.resolvedModel,
          promptVersionId,
          promptVersionTag: promptTemplate.tag,
          locale,
          privacyModeAtRun: settings.aiPrivacyMode,
          containsPrivateDocuments,
          consentRequired: true,
          consentGranted: false,
          inputHash,
          status: "awaiting_consent",
          attempts: 0,
          maxAttempts,
          pricingKey: pricing.pricingKey,
          creditCost: pricing.effectiveCost,
          usageMetadata: estimatedUsage,
          pendingTaskRequest: {
            taskType: params.taskType,
            locale,
            systemPrompt: promptTemplate.systemPrompt,
            outputContractHint: promptTemplate.outputContractHint,
            userPrompt: params.userPrompt,
            temperature: params.temperature ?? 0.2,
            maxOutputTokens: params.maxOutputTokens ?? 2048,
            timeoutMs: params.timeoutMs ?? null,
          },
        })
        .returning();

      if (params.sources.length > 0) {
        await tx.insert(aiAnalysisSources).values(
          params.sources.map((src) => ({
            userId: params.userId,
            jobId: insertedJob.id,
            sourceType: src.sourceType,
            sourceId: src.sourceId ?? null,
            sourceLabel: src.sourceLabel ?? null,
            sourceHash: src.sourceHash,
            isUntrustedExternal: src.isUntrustedExternal ?? false,
            injectionSignalCount: src.injectionSignalCount ?? 0,
          })),
        );
      }

      return [insertedJob];
    });

    if (params.onConsentRequired === "throw") {
      throw new AiProviderError("CONSENT_REQUIRED", reason, {
        provider: selection.providerId,
        retryable: false,
      });
    }

    return {
      status: "awaiting_consent",
      jobId: pausedJob.id,
      provider: selection.providerId,
      locality: selection.locality,
      model: selection.resolvedModel,
      promptVersionTag: promptTemplate.tag,
      consentReason: reason,
      estimatedUsage,
      estimatedCreditCost: pricing.effectiveCost,
      pricingKey: pricing.pricingKey,
    };
  }

  // Reserve credits atomically before executing AI provider (with idempotency check)
  const effectiveIdempotencyKey =
    params.idempotencyKey?.trim() || `ai:${randomUUID()}`;

  const reserveResult = await reserveCreditsForAiTaskService(params.userId, {
    pricingKey: pricing.pricingKey,
    taskType: params.taskType,
    provider: selection.providerId,
    locality: selection.locality,
    amount: pricing.effectiveCost,
    idempotencyKey: effectiveIdempotencyKey,
    metadata: { inputHash, taskType: params.taskType },
  });

  // If duplicate idempotency key already yielded a completed job, return cached analysis safely
  if (reserveResult.deduplicated && reserveResult.reservation) {
    const [existingJob] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(
        and(
          eq(aiAnalysisJobs.creditReservationId, reserveResult.reservation.id),
          eq(aiAnalysisJobs.userId, params.userId),
        ),
      );

    if (existingJob?.status === "completed") {
      const [existingAnalysis] = await db
        .select()
        .from(aiCareerAnalyses)
        .where(
          and(
            eq(aiCareerAnalyses.jobId, existingJob.id),
            eq(aiCareerAnalyses.userId, params.userId),
          ),
        );
      if (existingAnalysis) {
        return {
          status: "completed",
          jobId: existingJob.id,
          analysisId: existingAnalysis.id,
          provider: existingJob.provider,
          locality: existingJob.locality,
          model: existingJob.model,
          promptVersionTag: existingJob.promptVersionTag,
          usage: existingJob.usageMetadata ?? estimatedUsage,
          creditCost: existingJob.creditCost ?? reserveResult.reservation.amount,
          creditReservationId: reserveResult.reservation.id,
          deduplicated: true,
          data: existingAnalysis.resultPayload as z.infer<TSchema>,
        };
      }
    }
  }

  const reservationId = reserveResult.reservation?.id ?? null;

  // Authorized: create active job row (`running`) + sources
  const startedAt = new Date();
  let jobId: string;
  try {
    const [job] = await db.transaction(async (tx) => {
      const [insertedJob] = await tx
        .insert(aiAnalysisJobs)
        .values({
          userId: params.userId,
          taskType: params.taskType,
          provider: selection.providerId,
          locality: selection.locality,
          model: selection.resolvedModel,
          promptVersionId,
          promptVersionTag: promptTemplate.tag,
          locale,
          privacyModeAtRun: settings.aiPrivacyMode,
          containsPrivateDocuments,
          consentRequired: selection.consentRequired,
          consentGranted: true,
          consentGrantedAt: selection.consentRequired ? startedAt : null,
          inputHash,
          status: "running",
          attempts: 0,
          maxAttempts,
          pricingKey: pricing.pricingKey,
          creditCost: pricing.effectiveCost,
          creditReservationId: reservationId,
          startedAt,
        })
        .returning();

      if (params.sources.length > 0) {
        await tx.insert(aiAnalysisSources).values(
          params.sources.map((src) => ({
            userId: params.userId,
            jobId: insertedJob.id,
            sourceType: src.sourceType,
            sourceId: src.sourceId ?? null,
            sourceLabel: src.sourceLabel ?? null,
            sourceHash: src.sourceHash,
            isUntrustedExternal: src.isUntrustedExternal ?? false,
            injectionSignalCount: src.injectionSignalCount ?? 0,
          })),
        );
      }

      return [insertedJob];
    });
    jobId = job.id;
  } catch (err) {
    if (reservationId) {
      await releaseCreditReservationService(params.userId, reservationId, {
        reason: "Released reservation because AI job creation failed",
      }).catch(() => {});
    }
    throw err;
  }

  return runProviderWithRetries({
    userId: params.userId,
    jobId,
    taskType: params.taskType,
    locale,
    provider: selection.provider,
    modelConfig: mergeExecutionModelConfig(selection.modelConfig, {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
      timeoutMs: params.timeoutMs,
    }),
    resolvedModel: selection.resolvedModel,
    promptVersionTag: promptTemplate.tag,
    systemPrompt: promptTemplate.systemPrompt,
    outputContractHint: promptTemplate.outputContractHint,
    userPrompt: params.userPrompt,
    schema: params.schema,
    schemaName: params.schemaName,
    inputHash,
    maxAttempts,
    creditCost: pricing.effectiveCost,
    creditReservationId: reservationId,
    extractSummary: params.extractSummary,
  });
}

async function runProviderWithRetries<TSchema extends z.ZodTypeAny>(params: {
  userId: string;
  jobId: string;
  taskType: AiTaskType;
  locale: AiLocale;
  provider: AiProvider;
  modelConfig: AiModelConfig;
  resolvedModel: string;
  promptVersionTag: string;
  systemPrompt: string;
  outputContractHint: string;
  userPrompt: string;
  schema: TSchema;
  schemaName: string;
  inputHash: string;
  maxAttempts: number;
  creditCost: number;
  creditReservationId: string | null;
  extractSummary?: (data: z.infer<TSchema>) => {
    overallScore?: number | null;
    summaryText?: string | null;
  };
}): Promise<AiTaskExecutionResult<z.infer<TSchema>>> {
  const db = await ensureDbReady();

  let lastError: AiProviderError | null = null;
  let attempts = 0;

  const safeUserPrompt =
    params.provider.locality === "cloud"
      ? minimizeCloudPii(params.userPrompt)
      : params.userPrompt;

  for (let attempt = 1; attempt <= params.maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const response = await params.provider.generateStructured({
        taskType: params.taskType,
        systemPrompt: params.systemPrompt,
        userPrompt: safeUserPrompt,
        schema: params.schema,
        schemaName: params.schemaName,
        outputContractHint: params.outputContractHint,
        modelConfig: params.modelConfig,
      });

      const summary = params.extractSummary
        ? params.extractSummary(response.data)
        : defaultSummaryExtractor(response.data);

      const completedAt = new Date();
      const [analysis] = await db.transaction(async (tx) => {
        const [insertedAnalysis] = await tx
          .insert(aiCareerAnalyses)
          .values({
            userId: params.userId,
            jobId: params.jobId,
            taskType: params.taskType,
            provider: response.provider,
            model: response.model,
            promptVersionTag: params.promptVersionTag,
            locale: params.locale,
            inputHash: params.inputHash,
            schemaVersion: "1.0",
            overallScore: summary.overallScore ?? null,
            summaryText: summary.summaryText ?? null,
            resultPayload: response.data as Record<string, unknown>,
          })
          .returning();

        await tx
          .update(aiAnalysisSources)
          .set({ analysisId: insertedAnalysis.id })
          .where(
            and(
              eq(aiAnalysisSources.jobId, params.jobId),
              eq(aiAnalysisSources.userId, params.userId),
            ),
          );

        await tx
          .update(aiAnalysisJobs)
          .set({
            status: "completed",
            attempts,
            usageMetadata: response.usage,
            errorCode: null,
            errorMessage: null,
            pendingTaskRequest: null,
            completedAt,
            updatedAt: completedAt,
          })
          .where(
            and(
              eq(aiAnalysisJobs.id, params.jobId),
              eq(aiAnalysisJobs.userId, params.userId),
            ),
          );

        await writeAudit(tx, {
          userId: params.userId,
          entityType: "ai_career_analysis",
          entityId: insertedAnalysis.id,
          action: "create",
          summary: `Completed AI task '${params.taskType}' via ${response.provider} (${response.model})`,
          changes: {
            jobId: params.jobId,
            provider: response.provider,
            model: response.model,
            attempts,
          },
        });

        return [insertedAnalysis];
      });

      if (params.creditReservationId) {
        await captureCreditReservationService(
          params.userId,
          params.creditReservationId,
          {
            jobId: params.jobId,
            usageMetadata: response.usage as unknown as Record<string, unknown>,
          },
        );
      }

      return {
        status: "completed",
        jobId: params.jobId,
        analysisId: analysis.id,
        provider: response.provider,
        locality: response.locality,
        model: response.model,
        promptVersionTag: params.promptVersionTag,
        usage: response.usage,
        creditCost: params.creditCost,
        creditReservationId: params.creditReservationId,
        data: response.data,
      };
    } catch (err) {
      const normalized =
        err instanceof AiProviderError
          ? err
          : new AiProviderError(
              "TASK_EXECUTION_FAILED",
              err instanceof Error ? err.message : "AI task execution failed.",
              { provider: params.provider.id, retryable: false, cause: err },
            );

      lastError = normalized;

      if (normalized.retryable && attempt < params.maxAttempts) {
        continue;
      }
      break;
    }
  }

  const failedAt = new Date();
  const finalError =
    lastError ??
    new AiProviderError("TASK_EXECUTION_FAILED", "AI task failed unexpectedly.");

  await db
    .update(aiAnalysisJobs)
    .set({
      status: "failed",
      attempts,
      errorCode: finalError.code,
      errorMessage: finalError.message,
      pendingTaskRequest: null,
      completedAt: failedAt,
      updatedAt: failedAt,
    })
    .where(
      and(
        eq(aiAnalysisJobs.id, params.jobId),
        eq(aiAnalysisJobs.userId, params.userId),
      ),
    );

  await writeAudit(db, {
    userId: params.userId,
    entityType: "ai_analysis_job",
    entityId: params.jobId,
    action: "update",
    summary: `AI task '${params.taskType}' failed (${finalError.code}) after ${attempts} attempt(s)`,
  });

  if (params.creditReservationId) {
    await releaseCreditReservationService(
      params.userId,
      params.creditReservationId,
      {
        jobId: params.jobId,
        reason: `Auto-released after AI task failed (${finalError.code}): ${finalError.message}`,
      },
    );
  }

  throw finalError;
}

/**
 * Grants user consent to an `awaiting_consent` job and executes it atomically.
 * Strictly isolated to `userId`.
 */
export async function approveAndRunAiJobService(
  userId: string,
  jobId: string,
  options?: { registry?: AiProviderRegistry },
) {
  const db = await ensureDbReady();
  const [job] = await db
    .select()
    .from(aiAnalysisJobs)
    .where(
      and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.userId, userId)),
    );

  if (!job) {
    throw new Error("AI analysis job not found.");
  }
  if (job.status !== "awaiting_consent") {
    throw new Error(`AI job cannot be approved from status '${job.status}'.`);
  }
  if (!job.pendingTaskRequest) {
    throw new Error("Pending AI task payload is missing for consent resumption.");
  }

  const settings = await getUserSettings(userId);
  const registry = options?.registry ?? createDefaultProviderRegistry();
  const selection = await selectAiProvider({
    privacyMode: settings.aiPrivacyMode,
    preferredProvider: settings.aiPreferredProvider,
    requestedProvider: job.provider,
    requestedModel: job.model,
    ollamaEndpoint: settings.aiOllamaEndpoint,
    ollamaModel: settings.aiOllamaModel,
    cloudDocumentConsent: settings.aiCloudDocumentConsent,
    containsPrivateDocuments: job.containsPrivateDocuments,
    perTaskConsentGranted: true,
    registry,
  });

  const pricing = await resolveAiTaskPricingService({
    pricingKey: job.pricingKey ?? undefined,
    taskType: job.taskType,
    locality: selection.locality,
  });

  const reserveResult = await reserveCreditsForAiTaskService(userId, {
    pricingKey: pricing.pricingKey,
    taskType: job.taskType,
    jobId: job.id,
    provider: selection.providerId,
    locality: selection.locality,
    amount: pricing.effectiveCost,
    idempotencyKey: `job:${job.id}`,
  });

  const reservationId = reserveResult.reservation?.id ?? null;

  const now = new Date();
  await db
    .update(aiAnalysisJobs)
    .set({
      consentGranted: true,
      consentGrantedAt: now,
      status: "running",
      pricingKey: pricing.pricingKey,
      creditCost: pricing.effectiveCost,
      creditReservationId: reservationId,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.userId, userId)),
    );

  const req = job.pendingTaskRequest as {
    systemPrompt: string;
    outputContractHint: string;
    userPrompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number | null;
  };
  const schemaEntry = SCHEMA_BY_TASK[job.taskType];

  return runProviderWithRetries({
    userId,
    jobId: job.id,
    taskType: job.taskType,
    locale: job.locale,
    provider: selection.provider,
    modelConfig: mergeExecutionModelConfig(selection.modelConfig, {
      temperature: req.temperature,
      maxOutputTokens: req.maxOutputTokens,
      timeoutMs: req.timeoutMs,
    }),
    resolvedModel: selection.resolvedModel,
    promptVersionTag: job.promptVersionTag,
    systemPrompt: req.systemPrompt,
    outputContractHint: req.outputContractHint,
    userPrompt: req.userPrompt,
    schema: schemaEntry.schema,
    schemaName: schemaEntry.name,
    inputHash: job.inputHash,
    maxAttempts: job.maxAttempts,
    creditCost: pricing.effectiveCost,
    creditReservationId: reservationId,
  });
}

export async function cancelAiJobService(userId: string, jobId: string) {
  const db = await ensureDbReady();
  const [job] = await db
    .select()
    .from(aiAnalysisJobs)
    .where(
      and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.userId, userId)),
    );

  if (!job) {
    throw new Error("AI analysis job not found.");
  }
  if (job.status === "completed" || job.status === "cancelled") {
    throw new Error(`AI job is already '${job.status}'.`);
  }

  const now = new Date();
  const [updated] = await db
    .update(aiAnalysisJobs)
    .set({
      status: "cancelled",
      pendingTaskRequest: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.userId, userId)),
    )
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "ai_analysis_job",
    entityId: jobId,
    action: "update",
    summary: `Cancelled AI task '${job.taskType}'`,
  });

  return updated;
}

export const aiFeedbackSchema = z.object({
  analysisId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  helpful: z.boolean().optional().nullable(),
  actionTaken: z
    .enum([
      "accepted",
      "partially_accepted",
      "rejected",
      "edited",
      "reported_hallucination",
      "comment_only",
    ])
    .default("comment_only"),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export async function submitAiFeedbackService(
  userId: string,
  rawInput: z.input<typeof aiFeedbackSchema>,
) {
  const input = aiFeedbackSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [analysis] = await db
    .select({ id: aiCareerAnalyses.id })
    .from(aiCareerAnalyses)
    .where(
      and(
        eq(aiCareerAnalyses.id, input.analysisId),
        eq(aiCareerAnalyses.userId, userId),
      ),
    );

  if (!analysis) {
    throw new Error("AI career analysis not found.");
  }

  const [feedback] = await db
    .insert(aiFeedback)
    .values({
      userId,
      analysisId: input.analysisId,
      rating: input.rating ?? null,
      helpful: input.helpful ?? null,
      actionTaken: input.actionTaken as AiFeedbackAction,
      comment: input.comment ?? null,
    })
    .returning();

  return feedback;
}
