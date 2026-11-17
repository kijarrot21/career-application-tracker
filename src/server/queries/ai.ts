import { and, desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  aiAnalysisJobs,
  aiAnalysisSources,
  aiCareerAnalyses,
  aiFeedback,
} from "@/db/schema";
import type { AiJobStatus, AiTaskType } from "@/lib/domain/ai";

export async function listAiJobsForUser(
  userId: string,
  options?: { status?: AiJobStatus; taskType?: AiTaskType; limit?: number },
) {
  const db = await ensureDbReady();
  const conditions = [eq(aiAnalysisJobs.userId, userId)];
  if (options?.status) {
    conditions.push(eq(aiAnalysisJobs.status, options.status));
  }
  if (options?.taskType) {
    conditions.push(eq(aiAnalysisJobs.taskType, options.taskType));
  }

  return db
    .select({
      id: aiAnalysisJobs.id,
      userId: aiAnalysisJobs.userId,
      taskType: aiAnalysisJobs.taskType,
      provider: aiAnalysisJobs.provider,
      locality: aiAnalysisJobs.locality,
      model: aiAnalysisJobs.model,
      promptVersionId: aiAnalysisJobs.promptVersionId,
      promptVersionTag: aiAnalysisJobs.promptVersionTag,
      locale: aiAnalysisJobs.locale,
      privacyModeAtRun: aiAnalysisJobs.privacyModeAtRun,
      containsPrivateDocuments: aiAnalysisJobs.containsPrivateDocuments,
      consentRequired: aiAnalysisJobs.consentRequired,
      consentGranted: aiAnalysisJobs.consentGranted,
      consentGrantedAt: aiAnalysisJobs.consentGrantedAt,
      inputHash: aiAnalysisJobs.inputHash,
      status: aiAnalysisJobs.status,
      attempts: aiAnalysisJobs.attempts,
      maxAttempts: aiAnalysisJobs.maxAttempts,
      errorCode: aiAnalysisJobs.errorCode,
      errorMessage: aiAnalysisJobs.errorMessage,
      usageMetadata: aiAnalysisJobs.usageMetadata,
      startedAt: aiAnalysisJobs.startedAt,
      completedAt: aiAnalysisJobs.completedAt,
      createdAt: aiAnalysisJobs.createdAt,
      updatedAt: aiAnalysisJobs.updatedAt,
    })
    .from(aiAnalysisJobs)
    .where(and(...conditions))
    .orderBy(desc(aiAnalysisJobs.createdAt))
    .limit(options?.limit ?? 50);
}

export async function getAiAnalysisDetailForUser(
  userId: string,
  analysisId: string,
) {
  const db = await ensureDbReady();

  const [analysis] = await db
    .select()
    .from(aiCareerAnalyses)
    .where(
      and(
        eq(aiCareerAnalyses.id, analysisId),
        eq(aiCareerAnalyses.userId, userId),
      ),
    );

  if (!analysis) return null;

  const [[job], sources, feedbackEntries] = await Promise.all([
    db
      .select({
        id: aiAnalysisJobs.id,
        taskType: aiAnalysisJobs.taskType,
        provider: aiAnalysisJobs.provider,
        locality: aiAnalysisJobs.locality,
        model: aiAnalysisJobs.model,
        status: aiAnalysisJobs.status,
        attempts: aiAnalysisJobs.attempts,
        usageMetadata: aiAnalysisJobs.usageMetadata,
        consentRequired: aiAnalysisJobs.consentRequired,
        consentGranted: aiAnalysisJobs.consentGranted,
        consentGrantedAt: aiAnalysisJobs.consentGrantedAt,
        startedAt: aiAnalysisJobs.startedAt,
        completedAt: aiAnalysisJobs.completedAt,
      })
      .from(aiAnalysisJobs)
      .where(
        and(
          eq(aiAnalysisJobs.id, analysis.jobId),
          eq(aiAnalysisJobs.userId, userId),
        ),
      ),
    db
      .select()
      .from(aiAnalysisSources)
      .where(
        and(
          eq(aiAnalysisSources.analysisId, analysis.id),
          eq(aiAnalysisSources.userId, userId),
        ),
      ),
    db
      .select()
      .from(aiFeedback)
      .where(
        and(
          eq(aiFeedback.analysisId, analysis.id),
          eq(aiFeedback.userId, userId),
        ),
      )
      .orderBy(desc(aiFeedback.createdAt)),
  ]);

  return {
    analysis,
    job: job ?? null,
    sources,
    feedback: feedbackEntries,
  };
}

export async function listAiAnalysesForUser(
  userId: string,
  options?: { taskType?: AiTaskType; limit?: number },
) {
  const db = await ensureDbReady();
  const conditions = [eq(aiCareerAnalyses.userId, userId)];
  if (options?.taskType) {
    conditions.push(eq(aiCareerAnalyses.taskType, options.taskType));
  }

  return db
    .select()
    .from(aiCareerAnalyses)
    .where(and(...conditions))
    .orderBy(desc(aiCareerAnalyses.createdAt))
    .limit(options?.limit ?? 50);
}

export async function getAiJobDetailForUser(userId: string, jobId: string) {
  const db = await ensureDbReady();

  const [job] = await db
    .select({
      id: aiAnalysisJobs.id,
      userId: aiAnalysisJobs.userId,
      taskType: aiAnalysisJobs.taskType,
      provider: aiAnalysisJobs.provider,
      locality: aiAnalysisJobs.locality,
      model: aiAnalysisJobs.model,
      promptVersionId: aiAnalysisJobs.promptVersionId,
      promptVersionTag: aiAnalysisJobs.promptVersionTag,
      locale: aiAnalysisJobs.locale,
      privacyModeAtRun: aiAnalysisJobs.privacyModeAtRun,
      containsPrivateDocuments: aiAnalysisJobs.containsPrivateDocuments,
      consentRequired: aiAnalysisJobs.consentRequired,
      consentGranted: aiAnalysisJobs.consentGranted,
      consentGrantedAt: aiAnalysisJobs.consentGrantedAt,
      inputHash: aiAnalysisJobs.inputHash,
      status: aiAnalysisJobs.status,
      attempts: aiAnalysisJobs.attempts,
      maxAttempts: aiAnalysisJobs.maxAttempts,
      errorCode: aiAnalysisJobs.errorCode,
      errorMessage: aiAnalysisJobs.errorMessage,
      usageMetadata: aiAnalysisJobs.usageMetadata,
      startedAt: aiAnalysisJobs.startedAt,
      completedAt: aiAnalysisJobs.completedAt,
      createdAt: aiAnalysisJobs.createdAt,
      updatedAt: aiAnalysisJobs.updatedAt,
    })
    .from(aiAnalysisJobs)
    .where(
      and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.userId, userId)),
    );

  if (!job) return null;

  const [analysis] = await db
    .select()
    .from(aiCareerAnalyses)
    .where(
      and(
        eq(aiCareerAnalyses.jobId, job.id),
        eq(aiCareerAnalyses.userId, userId),
      ),
    );

  const sources = analysis
    ? await db
        .select()
        .from(aiAnalysisSources)
        .where(
          and(
            eq(aiAnalysisSources.analysisId, analysis.id),
            eq(aiAnalysisSources.userId, userId),
          ),
        )
    : [];

  return {
    job,
    analysis: analysis ?? null,
    sources,
  };
}
