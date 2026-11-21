import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  aiAnalysisJobs,
  careerProfiles,
  documentVersions,
} from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { UnsupportedDocumentFormatError } from "@/server/ai/extractors/document-text-extractor";
import { AiProviderError, type AiProviderRegistry } from "@/server/ai/providers";
import {
  parseCvBufferWithAiService,
  stageAiParsedCvToProfileService,
} from "@/server/ai/services";
import {
  approveAndRunAiJobService,
  cancelAiJobService,
} from "@/server/ai/router/ai-task-router";
import { getDocumentVersionFileForUserService } from "./career";

export class DuplicateCvExtractionError extends DomainError {
  constructor() {
    super("This CV version is already queued, processing, or awaiting review.");
    this.name = "DuplicateCvExtractionError";
  }
}

export type CvExtractionOutcome =
  | { status: "awaiting_consent"; jobId: string }
  | { status: "awaiting_review"; jobId: string; analysisId: string }
  | { status: "failed"; errorCode: string };

export type CvExtractionOptions = {
  registry?: AiProviderRegistry;
  locale?: "id" | "en";
};

/**
 * Attempt-scoped idempotency key. A retry must never reuse the key of a
 * failed attempt: the router caches completed executions by this key.
 */
export function buildCvExtractionIdempotencyKey(params: {
  versionId: string;
  attempt: number;
  sha256: string;
}): string {
  return `cv-parse:${params.versionId}:${params.attempt}:${params.sha256}`;
}

function toProcessingErrorCode(error: unknown): string {
  if (error instanceof AiProviderError) return error.code;
  if (error instanceof UnsupportedDocumentFormatError) {
    return "UNSUPPORTED_DOCUMENT";
  }
  if (error instanceof z.ZodError) return "SCHEMA_MISMATCH";
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) return "TIMEOUT";
    if (message.includes("json")) return "INVALID_JSON";
    if (message.includes("empty")) return "EMPTY_EXTRACTED_TEXT";
  }
  return "EXTRACTION_FAILED";
}

async function patchVersion(
  userId: string,
  versionId: string,
  patch: Partial<typeof documentVersions.$inferSelect>,
) {
  const db = await ensureDbReady();
  const [updated] = await db
    .update(documentVersions)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    )
    .returning();
  if (!updated) throw new DomainError("Document version not found.");
  return updated;
}

async function markFailed(
  userId: string,
  versionId: string,
  errorCode: string,
): Promise<CvExtractionOutcome> {
  await patchVersion(userId, versionId, {
    processingStatus: "failed",
    processingError: errorCode,
    processedAt: new Date(),
  });
  return { status: "failed", errorCode };
}

async function stageCompletedResult(
  userId: string,
  versionId: string,
  result: { jobId: string; analysisId: string },
): Promise<CvExtractionOutcome> {
  try {
    await stageAiParsedCvToProfileService(userId, {
      analysisId: result.analysisId,
      sourceDocumentVersionId: versionId,
    });
  } catch (error) {
    // Never log the CV payload or provider output; only a stable code.
    console.error(
      "[document-processing] staging failed:",
      toProcessingErrorCode(error),
    );
    return markFailed(userId, versionId, "STAGING_FAILED");
  }

  await patchVersion(userId, versionId, {
    processingStatus: "awaiting_review",
    aiJobId: result.jobId,
    aiAnalysisId: result.analysisId,
    processingError: null,
    processedAt: new Date(),
  });
  return {
    status: "awaiting_review",
    jobId: result.jobId,
    analysisId: result.analysisId,
  };
}

type AiExecutionOutcome =
  | { status: "awaiting_consent"; jobId: string }
  | { status: "completed"; jobId: string; analysisId: string };

async function handleExecutionResult(
  userId: string,
  versionId: string,
  result: AiExecutionOutcome,
): Promise<CvExtractionOutcome> {
  if (result.status === "awaiting_consent") {
    await patchVersion(userId, versionId, {
      processingStatus: "queued",
      aiJobId: result.jobId,
      processingError: null,
    });
    return { status: "awaiting_consent", jobId: result.jobId };
  }
  return stageCompletedResult(userId, versionId, result);
}

/**
 * Starts or resumes CV extraction for one document version.
 * Upload persistence is independent: callers schedule this after the upload
 * response and any failure here is recorded on the version, never propagated
 * to the upload result.
 */
export async function startCvExtractionService(
  userId: string,
  versionId: string,
  options: CvExtractionOptions = {},
): Promise<CvExtractionOutcome> {
  const db = await ensureDbReady();
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!version) throw new DomainError("Document version not found.");

  if (
    version.processingStatus === "queued" ||
    version.processingStatus === "processing" ||
    version.processingStatus === "awaiting_review"
  ) {
    throw new DuplicateCvExtractionError();
  }

  const [profile] = await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId));
  if (
    profile?.pendingReviewPayload?.sourceDocumentVersionId &&
    profile.pendingReviewPayload.sourceDocumentVersionId !== versionId
  ) {
    return markFailed(userId, versionId, "PENDING_REVIEW_EXISTS");
  }

  const attempt = version.processingAttempts + 1;
  await patchVersion(userId, versionId, {
    processingStatus: "queued",
    processingAttempts: attempt,
    aiJobId: null,
    aiAnalysisId: null,
    processingError: null,
    processedAt: null,
  });

  const stored = await getDocumentVersionFileForUserService(userId, versionId);
  if (!stored) return markFailed(userId, versionId, "NO_FILE");

  const sha256 =
    version.sha256 ?? createHash("sha256").update(stored.buffer).digest("hex");
  const idempotencyKey = buildCvExtractionIdempotencyKey({
    versionId,
    attempt,
    sha256,
  });

  await patchVersion(userId, versionId, { processingStatus: "processing" });

  try {
    const result = await parseCvBufferWithAiService(
      userId,
      {
        buffer: stored.buffer,
        filename: stored.version.filename ?? "cv",
        documentVersionId: versionId,
        locale: options.locale,
        idempotencyKey,
        onConsentRequired: "pause",
      },
      options.registry ? { registry: options.registry } : undefined,
    );
    return await handleExecutionResult(userId, versionId, result);
  } catch (error) {
    // Only stable error codes leave this boundary.
    const code = toProcessingErrorCode(error);
    console.error("[document-processing] extraction failed:", code);
    return markFailed(userId, versionId, code);
  }
}

/** Approves a consent-paused job and stages its completed extraction. */
export async function approveCvExtractionService(
  userId: string,
  versionId: string,
  options: CvExtractionOptions = {},
): Promise<CvExtractionOutcome> {
  const db = await ensureDbReady();
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!version) throw new DomainError("Document version not found.");
  if (!version.aiJobId) {
    throw new DomainError("No AI job is awaiting consent for this version.");
  }

  await patchVersion(userId, versionId, {
    processingStatus: "processing",
    processingError: null,
  });

  try {
    const result = await approveAndRunAiJobService(
      userId,
      version.aiJobId,
      options.registry ? { registry: options.registry } : undefined,
    );
    return await handleExecutionResult(userId, versionId, result);
  } catch (error) {
    const code = toProcessingErrorCode(error);
    console.error("[document-processing] approval failed:", code);
    return markFailed(userId, versionId, code);
  }
}

/** Records a scheduling failure on the version without touching the upload result. */
export async function markCvExtractionFailedService(
  userId: string,
  versionId: string,
  code: string,
): Promise<void> {
  await markFailed(userId, versionId, code);
}

/** Cancels a consent-paused or running job; the uploaded file stays intact. */
export async function cancelCvExtractionService(
  userId: string,
  versionId: string,
): Promise<void> {
  const db = await ensureDbReady();
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!version) throw new DomainError("Document version not found.");

  if (version.aiJobId) {
    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(
        and(
          eq(aiAnalysisJobs.id, version.aiJobId),
          eq(aiAnalysisJobs.userId, userId),
        ),
      );
    if (job?.status === "awaiting_consent" || job?.status === "running") {
      await cancelAiJobService(userId, job.id);
    }
  }

  await patchVersion(userId, versionId, {
    processingStatus: "failed",
    processingError: "CANCELLED",
    processedAt: new Date(),
  });
}

