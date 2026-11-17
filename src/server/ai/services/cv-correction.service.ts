import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import { aiCareerAnalyses, aiFeedback } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { uploadOrVersionDocumentService } from "@/server/services/career";
import { executeAiTask } from "../router/ai-task-router";
import { correctionResultSchema, type AiCorrectionResult } from "../schemas";
import { wrapUntrustedDataBlock } from "../security/prompt-guard";
import {
  aiExecutionOptionsSchema,
  loadGroundedProfileContext,
  loadUntrustedVacancyContext,
  resolveDocumentTextInput,
  type AiServiceRuntimeOptions,
} from "./_context";

export const cvCorrectionInputSchema = aiExecutionOptionsSchema.extend({
  vacancyId: z.string().uuid().optional(),
  documentVersionId: z.string().uuid().optional().nullable(),
  cvText: z.string().trim().max(40000).optional(),
});

export async function suggestCvCorrectionsWithAiService(
  userId: string,
  rawInput: z.input<typeof cvCorrectionInputSchema> = {},
  runtimeOptions?: Pick<AiServiceRuntimeOptions, "registry">,
) {
  const input = cvCorrectionInputSchema.parse(rawInput);
  const profileCtx = await loadGroundedProfileContext(userId);
  const sources = [profileCtx.source];

  const promptParts = [
    "Provide before-and-after CV improvement comparisons across grammar, professional_wording, achievement_improvement, readability, keyword_alignment, section_hierarchy, and repetition_reduction.",
    "Every suggestion MUST cite a groundedInProfileFact and require explicit user approval (requiresUserReview: true).",
    "Verified Master Career Profile:",
    profileCtx.serializedJson,
  ];

  if (input.documentVersionId || input.cvText) {
    const resolvedDoc = await resolveDocumentTextInput(userId, {
      documentVersionId: input.documentVersionId,
      rawText: input.cvText,
    });
    const guardedCv = wrapUntrustedDataBlock(
      "cv_draft_text",
      resolvedDoc.rawText,
    );
    promptParts.push("Candidate CV Text to review:", guardedCv.wrapped);
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
    promptParts.push(
      "Target Job Vacancy Context (untrusted external text):",
      vacancyCtx.guarded.wrapped,
    );
    sources.push(vacancyCtx.source);
  }

  return executeAiTask({
    userId,
    taskType: "cv_correction",
    locale: input.locale,
    schema: correctionResultSchema,
    schemaName: "CorrectionResult",
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
    extractSummary: (data: AiCorrectionResult) => ({
      overallScore: data.overallScore,
      summaryText: data.summary,
    }),
  });
}

export const applyApprovedCvCorrectionsSchema = z.object({
  analysisId: z.string().uuid(),
  approvedIndexes: z
    .array(z.number().int().min(0))
    .min(1, "Select at least one correction to approve before applying."),
  baseText: z.string().trim().max(40000).optional(),
  saveAsNewDocumentVersion: z.boolean().default(false),
  documentId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  versionLabel: z.string().trim().min(1).max(120).optional(),
});

/**
 * Applies only user-approved before->after CV corrections to a derived text copy
 * and optionally saves it as a NEW `document_versions` row (never overwriting
 * original documents or mutating verified Master Career Profile rows silently).
 */
export async function applyApprovedCvCorrectionsService(
  userId: string,
  rawInput: z.input<typeof applyApprovedCvCorrectionsSchema>,
) {
  const input = applyApprovedCvCorrectionsSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [analysis] = await db
    .select()
    .from(aiCareerAnalyses)
    .where(
      and(
        eq(aiCareerAnalyses.id, input.analysisId),
        eq(aiCareerAnalyses.userId, userId),
        eq(aiCareerAnalyses.taskType, "cv_correction"),
      ),
    );

  if (!analysis) {
    throw new Error("CV correction analysis not found.");
  }

  const parsed = correctionResultSchema.parse(analysis.resultPayload);
  const uniqueIndexes = [...new Set(input.approvedIndexes)];
  for (const idx of uniqueIndexes) {
    if (idx < 0 || idx >= parsed.suggestions.length) {
      throw new Error(`Correction index ${idx} is out of range.`);
    }
  }

  const approvedSuggestions = uniqueIndexes.map((idx) => parsed.suggestions[idx]);
  let revisedText =
    input.baseText?.trim() ||
    parsed.suggestions.map((s) => s.originalText).join("\n\n");

  for (const item of approvedSuggestions) {
    if (revisedText.includes(item.originalText)) {
      revisedText = revisedText.replace(item.originalText, item.suggestedText);
    } else {
      revisedText = `${revisedText}\n\n[${item.section}] ${item.suggestedText}`;
    }
  }

  const isFullAcceptance = uniqueIndexes.length === parsed.suggestions.length;
  await db.insert(aiFeedback).values({
    userId,
    analysisId: analysis.id,
    helpful: true,
    actionTaken: isFullAcceptance ? "accepted" : "partially_accepted",
    comment: `User approved ${uniqueIndexes.length} of ${parsed.suggestions.length} CV correction suggestion(s).`,
  });

  let createdVersion: { documentId: string; versionId: string; versionNo: number } | null =
    null;

  if (input.saveAsNewDocumentVersion) {
    const versionResult = await uploadOrVersionDocumentService(userId, {
      metadata: {
        documentId: input.documentId ?? undefined,
        category: "custom_cv",
        title: input.title ?? "AI-Reviewed CV Draft",
        versionLabel: input.versionLabel ?? "AI Corrected Copy",
        notes: `Approved ${uniqueIndexes.length} AI wording/ATS suggestion(s) from analysis ${analysis.id}.`,
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from(revisedText, "utf8"),
        filename: "cv-corrected-draft.md",
      },
    });
    createdVersion = {
      documentId: versionResult.documentId,
      versionId: versionResult.version.id,
      versionNo: versionResult.version.versionNo,
    };
  }

  await writeAudit(db, {
    userId,
    entityType: "ai_cv_correction_approval",
    entityId: analysis.id,
    action: "update",
    summary: `Approved ${uniqueIndexes.length} CV correction suggestion(s)`,
    changes: {
      approvedCount: uniqueIndexes.length,
      totalSuggestions: parsed.suggestions.length,
      savedNewVersionId: createdVersion?.versionId ?? null,
    },
  });

  return {
    analysisId: analysis.id,
    approvedCount: approvedSuggestions.length,
    approvedSuggestions,
    revisedText,
    createdVersion,
  };
}
