import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  applicationDocuments,
  applications,
  assessments,
  documents,
  documentVersions,
  interviews,
  jobOffers,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import {
  ASSESSMENT_TYPES,
  CURRENCIES,
  DOCUMENT_CATEGORIES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  OFFER_DECISIONS,
  SALARY_PERIODS,
} from "@/lib/constants";
import {
  deleteDocumentFile,
  getSignedDocumentDownloadUrl,
  readDocumentFile,
  scanDocumentForMalware,
  validateDocumentBuffer,
  writeDocumentFile,
} from "@/lib/storage";
import { getUserStages } from "@/server/queries/settings";
import { moveApplicationStageService } from "./applications";

// ---------------------------------------------------------------------------
// 1. Interview Full Update & Delete
// ---------------------------------------------------------------------------
export const updateInterviewFullSchema = z.object({
  interviewId: z.string().uuid(),
  interviewType: z.enum(INTERVIEW_TYPES),
  startsAt: z.string().trim().min(10),
  durationMinutes: z.number().int().min(10).max(480).default(45),
  location: z.string().trim().max(240).optional().nullable(),
  meetingUrl: z.string().trim().max(300).optional().nullable(),
  interviewerName: z.string().trim().max(160).optional().nullable(),
  interviewerPosition: z.string().trim().max(160).optional().nullable(),
  interviewerContact: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  questions: z.string().trim().max(5000).optional().nullable(),
  preparationNotes: z.string().trim().max(5000).optional().nullable(),
  feedback: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(INTERVIEW_STATUSES),
  result: z.enum(INTERVIEW_RESULTS),
});

export async function updateInterviewFullService(
  userId: string,
  rawInput: z.infer<typeof updateInterviewFullSchema>,
) {
  const input = updateInterviewFullSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(interviews)
    .set({
      interviewType: input.interviewType,
      startsAt: new Date(input.startsAt),
      durationMinutes: input.durationMinutes,
      location: input.location || null,
      meetingUrl: input.meetingUrl || null,
      interviewerName: input.interviewerName || null,
      interviewerPosition: input.interviewerPosition || null,
      interviewerContact: input.interviewerContact || null,
      notes: input.notes || null,
      questions: input.questions || null,
      preparationNotes: input.preparationNotes || null,
      feedback: input.feedback || null,
      status: input.status,
      result: input.result,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(interviews.id, input.interviewId),
        eq(interviews.userId, userId),
      ),
    )
    .returning();

  if (!updated) throw new DomainError("Interview not found.");

  await writeAudit(db, {
    userId,
    entityType: "interview",
    entityId: updated.id,
    action: "update",
    summary: `Updated ${updated.interviewType} interview (${updated.status} / ${updated.result})`,
  });

  return updated;
}

export async function deleteInterviewService(
  userId: string,
  interviewId: string,
) {
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)))
    .returning();
  if (!deleted) throw new DomainError("Interview not found.");
  return deleted;
}

// ---------------------------------------------------------------------------
// 2. Assessments & Technical Tests
// ---------------------------------------------------------------------------
export const assessmentSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  assessmentType: z.enum(ASSESSMENT_TYPES).default("technical"),
  title: z.string().trim().min(1, "Assessment title is required").max(200),
  dueAt: z.string().trim().optional().nullable(),
  completedAt: z.string().trim().optional().nullable(),
  score: z.string().trim().max(60).optional().nullable(),
  maxScore: z.string().trim().max(60).optional().nullable(),
  result: z.enum(INTERVIEW_RESULTS).default("pending"),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export async function saveAssessmentService(
  userId: string,
  rawInput: z.infer<typeof assessmentSchema>,
) {
  const input = assessmentSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [app] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.id, input.applicationId),
        eq(applications.userId, userId),
      ),
    );
  if (!app) throw new DomainError("Application not found.");

  if (input.assessmentId) {
    const [updated] = await db
      .update(assessments)
      .set({
        assessmentType: input.assessmentType,
        title: input.title,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        score: input.score || null,
        maxScore: input.maxScore || null,
        result: input.result,
        notes: input.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assessments.id, input.assessmentId),
          eq(assessments.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new DomainError("Assessment not found.");
    return updated;
  }

  const [created] = await db
    .insert(assessments)
    .values({
      userId,
      applicationId: app.id,
      assessmentType: input.assessmentType,
      title: input.title,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      score: input.score || null,
      maxScore: input.maxScore || null,
      result: input.result,
      notes: input.notes || null,
    })
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "assessment",
    entityId: created.id,
    action: "create",
    summary: `Recorded assessment "${created.title}"`,
  });

  return created;
}

export async function deleteAssessmentService(
  userId: string,
  assessmentId: string,
) {
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(assessments)
    .where(
      and(eq(assessments.id, assessmentId), eq(assessments.userId, userId)),
    )
    .returning();
  if (!deleted) throw new DomainError("Assessment not found.");
  return deleted;
}

// ---------------------------------------------------------------------------
// 3. Employment Offers (Result Management)
// ---------------------------------------------------------------------------
export const jobOfferSchema = z.object({
  applicationId: z.string().uuid(),
  positionTitle: z.string().trim().min(1, "Position title is required").max(200),
  baseSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).default("IDR"),
  salaryPeriod: z.enum(SALARY_PERIODS).default("month"),
  benefits: z.string().trim().max(5000).optional().nullable(),
  joiningDate: z.string().trim().optional().nullable(),
  offerReceivedOn: z.string().trim().min(10, "Offer received date is required"),
  responseDeadline: z.string().trim().optional().nullable(),
  decision: z.enum(OFFER_DECISIONS).default("pending"),
  decidedOn: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  syncApplicationStage: z.boolean().default(true),
});

export async function upsertJobOfferService(
  userId: string,
  rawInput: z.infer<typeof jobOfferSchema>,
) {
  const input = jobOfferSchema.parse(rawInput);
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
  if (!app) throw new DomainError("Application not found.");

  const decidedOn =
    input.decision !== "pending"
      ? input.decidedOn || new Date().toISOString().slice(0, 10)
      : null;

  const [saved] = await db
    .insert(jobOffers)
    .values({
      userId,
      applicationId: app.id,
      positionTitle: input.positionTitle,
      baseSalary: input.baseSalary ?? null,
      currency: input.currency,
      salaryPeriod: input.salaryPeriod,
      benefits: input.benefits || null,
      joiningDate: input.joiningDate || null,
      offerReceivedOn: input.offerReceivedOn,
      responseDeadline: input.responseDeadline || null,
      decision: input.decision,
      decidedOn,
      notes: input.notes || null,
    })
    .onConflictDoUpdate({
      target: jobOffers.applicationId,
      set: {
        positionTitle: input.positionTitle,
        baseSalary: input.baseSalary ?? null,
        currency: input.currency,
        salaryPeriod: input.salaryPeriod,
        benefits: input.benefits || null,
        joiningDate: input.joiningDate || null,
        offerReceivedOn: input.offerReceivedOn,
        responseDeadline: input.responseDeadline || null,
        decision: input.decision,
        decidedOn,
        notes: input.notes || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (input.syncApplicationStage) {
    const stages = await getUserStages(userId, true);
    if (input.decision === "accepted") {
      const hiredStage = stages.find((s) => s.stageType === "hired");
      if (hiredStage && hiredStage.id !== app.currentStageId) {
        await moveApplicationStageService(userId, {
          applicationId: app.id,
          toStageId: hiredStage.id,
          effectiveOn: decidedOn ?? input.offerReceivedOn,
          source: "manual",
          reason: "Employment offer accepted",
        });
      }
    } else if (input.decision === "declined") {
      const withdrawnStage = stages.find((s) => s.stageType === "withdrawn");
      if (withdrawnStage && withdrawnStage.id !== app.currentStageId) {
        await moveApplicationStageService(userId, {
          applicationId: app.id,
          toStageId: withdrawnStage.id,
          effectiveOn: decidedOn ?? input.offerReceivedOn,
          source: "manual",
          reason: "Candidate declined employment offer",
        });
      }
    } else if (input.decision === "pending") {
      const offerStage = stages.find((s) => s.stageType === "offer");
      if (offerStage && offerStage.id !== app.currentStageId && app.outcome === "active") {
        await moveApplicationStageService(userId, {
          applicationId: app.id,
          toStageId: offerStage.id,
          effectiveOn: input.offerReceivedOn,
          source: "manual",
          reason: "Employment offer received",
        });
      }
    }
  }

  await writeAudit(db, {
    userId,
    entityType: "job_offer",
    entityId: saved.id,
    action: "update",
    summary: `Saved job offer for ${app.code} (decision: ${saved.decision})`,
  });

  return saved;
}

// ---------------------------------------------------------------------------
// 4. Document Repository & Versioning
// ---------------------------------------------------------------------------
export const createDocumentInputSchema = z.object({
  documentId: z.string().uuid().optional().nullable(), // If provided, adds a new version to existing document
  category: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().trim().min(1, "Document title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  versionLabel: z.string().trim().min(1, "Version label is required").max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  linkApplicationId: z.string().uuid().optional().nullable(),
  linkRole: z.enum(["cv", "cover_letter", "other"]).default("cv"),
});

export async function uploadOrVersionDocumentService(
  userId: string,
  params: {
    metadata: z.infer<typeof createDocumentInputSchema>;
    file?: { buffer: Buffer; filename: string } | null;
  },
) {
  const meta = createDocumentInputSchema.parse(params.metadata);
  const db = await ensureDbReady();

  let validatedFile: {
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  } | null = null;

  if (params.file && params.file.buffer.length > 0) {
    const checked = validateDocumentBuffer(
      params.file.buffer,
      params.file.filename,
    );
    const malwareScan = await scanDocumentForMalware(
      params.file.buffer,
      params.file.filename,
    );
    if (!malwareScan.isClean) {
      throw new DomainError(
        `File rejected: Threat "${malwareScan.threatName || "SuspiciousPayload"}" detected by malware scanner.`,
      );
    }
    const storageKey = writeDocumentFile({
      userId,
      mimeType: checked.mimeType,
      buffer: params.file.buffer,
    });
    validatedFile = {
      storageKey,
      filename: checked.sanitizedFilename,
      mimeType: checked.mimeType,
      sizeBytes: checked.sizeBytes,
      sha256: checked.sha256,
    };
  }

  let docId = meta.documentId ?? null;
  let nextVersionNo = 1;

  if (docId) {
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.userId, userId)));
    if (!existingDoc) throw new DomainError("Document not found.");

    const existingVersions = await db
      .select({ versionNo: documentVersions.versionNo })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, docId),
          eq(documentVersions.userId, userId),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1);

    nextVersionNo = (existingVersions[0]?.versionNo ?? 0) + 1;

    await db
      .update(documents)
      .set({ updatedAt: new Date() })
      .where(eq(documents.id, docId));
  } else {
    const [createdDoc] = await db
      .insert(documents)
      .values({
        userId,
        category: meta.category,
        title: meta.title,
        description: meta.description || null,
      })
      .returning();
    docId = createdDoc.id;
  }

  const [createdVersion] = await db
    .insert(documentVersions)
    .values({
      userId,
      documentId: docId,
      versionNo: nextVersionNo,
      label: meta.versionLabel,
      storageKey: validatedFile?.storageKey ?? null,
      filename: validatedFile?.filename ?? null,
      mimeType: validatedFile?.mimeType ?? null,
      sizeBytes: validatedFile?.sizeBytes ?? null,
      sha256: validatedFile?.sha256 ?? null,
      notes: meta.notes || null,
    })
    .returning();

  if (meta.linkApplicationId) {
    await linkDocumentVersionToApplicationService(userId, {
      applicationId: meta.linkApplicationId,
      documentVersionId: createdVersion.id,
      role: meta.linkRole,
    });
  }

  await writeAudit(db, {
    userId,
    entityType: "document_version",
    entityId: createdVersion.id,
    action: "create",
    summary: `Uploaded ${meta.title} (v${nextVersionNo}: ${meta.versionLabel})`,
  });

  return { documentId: docId, version: createdVersion };
}

export async function linkDocumentVersionToApplicationService(
  userId: string,
  params: {
    applicationId: string;
    documentVersionId: string;
    role: "cv" | "cover_letter" | "other";
  },
) {
  const db = await ensureDbReady();

  const [ver] = await db
    .select({
      version: documentVersions,
      docTitle: documents.title,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(
      and(
        eq(documentVersions.id, params.documentVersionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!ver) throw new DomainError("Document version not found.");

  const [app] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, params.applicationId),
        eq(applications.userId, userId),
      ),
    );
  if (!app) throw new DomainError("Application not found.");

  const [link] = await db
    .insert(applicationDocuments)
    .values({
      userId,
      applicationId: app.id,
      documentVersionId: ver.version.id,
      role: params.role,
    })
    .onConflictDoUpdate({
      target: [
        applicationDocuments.applicationId,
        applicationDocuments.documentVersionId,
      ],
      set: {
        role: params.role,
        updatedAt: new Date(),
      },
    })
    .returning();

  const displayLabel = `${ver.docTitle} (${ver.version.label})`;
  if (params.role === "cv") {
    await db
      .update(applications)
      .set({
        cvVersionId: ver.version.id,
        cvVersionLabel: displayLabel,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, app.id));
  } else if (params.role === "cover_letter") {
    await db
      .update(applications)
      .set({
        coverLetterVersionId: ver.version.id,
        coverLetterVersionLabel: displayLabel,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, app.id));
  }

  return link;
}

export async function unlinkDocumentVersionFromApplicationService(
  userId: string,
  linkId: string,
) {
  const db = await ensureDbReady();
  await db
    .delete(applicationDocuments)
    .where(
      and(
        eq(applicationDocuments.id, linkId),
        eq(applicationDocuments.userId, userId),
      ),
    );
}

export async function deleteDocumentService(
  userId: string,
  documentId: string,
) {
  const db = await ensureDbReady();
  const versions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.userId, userId),
      ),
    );

  const [deleted] = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning();

  if (!deleted) throw new DomainError("Document not found.");

  for (const v of versions) {
    deleteDocumentFile(v.storageKey);
  }

  await writeAudit(db, {
    userId,
    entityType: "document",
    entityId: documentId,
    action: "delete",
    summary: `Deleted document "${deleted.title}" and ${versions.length} version(s)`,
  });

  return deleted;
}

export async function getDocumentVersionFileForUserService(
  userId: string,
  versionId: string,
) {
  const db = await ensureDbReady();
  const [ver] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!ver || !ver.storageKey) return null;
  const buffer = readDocumentFile(ver.storageKey);
  if (!buffer) return null;

  return {
    version: ver,
    buffer,
  };
}

export async function getSignedDocumentUrlForUserService(
  userId: string,
  versionId: string,
  options?: { expiresInSeconds?: number; download?: boolean },
) {
  const db = await ensureDbReady();
  const [ver] = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    );
  if (!ver) throw new DomainError("Document version not found.");

  return getSignedDocumentDownloadUrl({
    userId,
    versionId,
    expiresInSeconds: options?.expiresInSeconds ?? 300,
    download: options?.download,
  });
}
