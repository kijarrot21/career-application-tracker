import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady, type AppDb } from "@/db";
import {
  applicationArchiveDocuments,
  applicationArchiveSnapshots,
  applicationClosureRecords,
  applicationDocuments,
  applications,
  applicationStages,
  applicationStatusHistory,
  assessments,
  companies,
  documents,
  documentVersions,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobSources,
  jobVacancies,
  suitabilityEvaluations,
  userSettings,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { CURRENCIES, SUBMISSION_METHODS } from "@/lib/constants";
import {
  ARCHIVE_CLOSURE_SOURCES,
  ARCHIVE_OUTCOMES,
  archiveOutcomeToAppOutcome,
  archiveOutcomeToStageType,
  computeRetainUntil,
  mapToArchiveOutcome,
  type ApplicationArchiveSnapshotPayload,
  type ArchiveClosureSource,
  type ArchiveOutcome,
  type SnapshotDocumentItem,
} from "@/lib/domain/archive";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { isTerminal, isVacancyLevel, type Outcome } from "@/lib/domain/stages";
import { getUserSettings, getUserStages } from "@/server/queries/settings";
import { recordSubmissionService } from "./applications";

type DbOrTx = Pick<
  AppDb,
  "select" | "insert" | "update" | "delete"
>;

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) {
        out[key] = canonicalizeJson(v);
      }
    }
    return out;
  }
  return value;
}

export function computeSnapshotContentHash(
  payload: ApplicationArchiveSnapshotPayload,
): string {
  const canonical = JSON.stringify(canonicalizeJson(payload));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function mapHistorySourceToClosureSource(
  source?: string | null,
): ArchiveClosureSource {
  switch (source) {
    case "email_suggestion":
      return "email_confirmation";
    case "no_response_suggestion":
      return "no_response_confirmation";
    case "sample":
      return "sample";
    default:
      return "auto_stage_transition";
  }
}

export async function archiveApplicationTx(
  dbOrTx: DbOrTx,
  params: {
    userId: string;
    applicationId: string;
    closureOutcome?: ArchiveOutcome;
    closureSource?: ArchiveClosureSource;
    closedOn?: string;
    previousStageId?: string | null;
    previousOutcome?: Outcome;
    closureReason?: string | null;
    closureNote?: string | null;
    isSample?: boolean;
  },
) {
  const { userId, applicationId } = params;

  // 1. Idempotency check: prevent duplicate active archive records
  const [existingActive] = await dbOrTx
    .select()
    .from(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.userId, userId),
        eq(applicationClosureRecords.applicationId, applicationId),
        eq(applicationClosureRecords.status, "archived"),
      ),
    )
    .limit(1);

  if (existingActive) {
    const [existingSnapshot] = await dbOrTx
      .select()
      .from(applicationArchiveSnapshots)
      .where(
        and(
          eq(applicationArchiveSnapshots.userId, userId),
          eq(applicationArchiveSnapshots.closureRecordId, existingActive.id),
        ),
      )
      .limit(1);

    return {
      closureRecord: existingActive,
      snapshot: existingSnapshot ?? null,
      alreadyArchived: true,
    };
  }

  // 2. Load application & related records
  const [appRow] = await dbOrTx
    .select({
      application: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
      platform: jobSources,
    })
    .from(applications)
    .innerJoin(
      jobVacancies,
      and(
        eq(applications.vacancyId, jobVacancies.id),
        eq(jobVacancies.userId, userId),
      ),
    )
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .innerJoin(
      applicationStages,
      and(
        eq(applications.currentStageId, applicationStages.id),
        eq(applicationStages.userId, userId),
      ),
    )
    .leftJoin(jobSources, eq(applications.platformSourceId, jobSources.id))
    .where(
      and(eq(applications.id, applicationId), eq(applications.userId, userId)),
    );

  if (!appRow) {
    throw new Error("Application not found.");
  }

  const [settings] = await dbOrTx
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const timezone = settings?.timezone ?? "Asia/Jakarta";
  const today = todayInTimeZone(timezone);
  const closedOn =
    params.closedOn || appRow.application.closedAt || today;

  const resolvedClosureOutcome = mapToArchiveOutcome({
    stageType: appRow.stage.stageType,
    outcome: appRow.application.outcome,
    explicitOutcome: params.closureOutcome ?? null,
  });

  const resolvedClosureSource: ArchiveClosureSource =
    params.closureSource ??
    (appRow.application.isSample ? "sample" : "manual_archive");

  const allStages = await dbOrTx
    .select()
    .from(applicationStages)
    .where(eq(applicationStages.userId, userId))
    .orderBy(asc(applicationStages.sortOrder));
  const stageMap = new Map(allStages.map((s) => [s.id, s]));

  let currentApp = appRow.application;
  let currentStage = appRow.stage;
  const previousStageId = params.previousStageId ?? currentApp.currentStageId;
  const previousOutcome = params.previousOutcome ?? currentApp.outcome;

  // 3. If the application is still active and was manually archived, transition its live status cleanly
  if (currentApp.outcome === "active") {
    const targetAppOutcome = archiveOutcomeToAppOutcome(resolvedClosureOutcome);
    const targetStageType = archiveOutcomeToStageType(resolvedClosureOutcome);
    const matchingStage = targetStageType
      ? allStages.find((s) => s.stageType === targetStageType)
      : undefined;

    const nextStageId = matchingStage?.id ?? currentApp.currentStageId;
    if (matchingStage) {
      currentStage = matchingStage;
    }

    const [updatedApp] = await dbOrTx
      .update(applications)
      .set({
        currentStageId: nextStageId,
        outcome: targetAppOutcome,
        closedAt: closedOn,
        nextFollowUpOn: null,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(applications.id, currentApp.id), eq(applications.userId, userId)),
      )
      .returning();
    currentApp = updatedApp;

    await dbOrTx
      .update(followUpTasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(followUpTasks.userId, userId),
          eq(followUpTasks.applicationId, currentApp.id),
          eq(followUpTasks.status, "open"),
        ),
      );

    await dbOrTx.insert(applicationStatusHistory).values({
      userId,
      applicationId: currentApp.id,
      fromStageId: previousStageId,
      toStageId: nextStageId,
      effectiveOn: closedOn,
      source: "manual",
      reason: params.closureReason || `Archived (${resolvedClosureOutcome})`,
      note: params.closureNote || null,
    });
  }

  // 4. Load full historical context to freeze into immutable snapshot
  const [suitability] = await dbOrTx
    .select()
    .from(suitabilityEvaluations)
    .where(
      and(
        eq(suitabilityEvaluations.userId, userId),
        eq(suitabilityEvaluations.vacancyId, appRow.vacancy.id),
      ),
    );

  const historyRows = await dbOrTx
    .select()
    .from(applicationStatusHistory)
    .where(
      and(
        eq(applicationStatusHistory.userId, userId),
        eq(applicationStatusHistory.applicationId, currentApp.id),
      ),
    )
    .orderBy(
      asc(applicationStatusHistory.effectiveOn),
      asc(applicationStatusHistory.recordedAt),
    );

  const commRows = await dbOrTx
    .select()
    .from(emailCommunications)
    .where(
      and(
        eq(emailCommunications.userId, userId),
        eq(emailCommunications.applicationId, currentApp.id),
      ),
    )
    .orderBy(asc(emailCommunications.occurredAt));

  const interviewRows = await dbOrTx
    .select()
    .from(interviews)
    .where(
      and(
        eq(interviews.userId, userId),
        eq(interviews.applicationId, currentApp.id),
      ),
    )
    .orderBy(asc(interviews.startsAt));

  const assessmentRows = await dbOrTx
    .select()
    .from(assessments)
    .where(
      and(
        eq(assessments.userId, userId),
        eq(assessments.applicationId, currentApp.id),
      ),
    )
    .orderBy(asc(assessments.createdAt));

  const [offerRow] = await dbOrTx
    .select()
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.userId, userId),
        eq(jobOffers.applicationId, currentApp.id),
      ),
    );

  const followUpRows = await dbOrTx
    .select()
    .from(followUpTasks)
    .where(
      and(
        eq(followUpTasks.userId, userId),
        eq(followUpTasks.applicationId, currentApp.id),
      ),
    )
    .orderBy(asc(followUpTasks.dueOn));

  const attachedDocRows = await dbOrTx
    .select({
      link: applicationDocuments,
      version: documentVersions,
      document: documents,
    })
    .from(applicationDocuments)
    .innerJoin(
      documentVersions,
      and(
        eq(applicationDocuments.documentVersionId, documentVersions.id),
        eq(documentVersions.userId, userId),
      ),
    )
    .innerJoin(
      documents,
      and(eq(documentVersions.documentId, documents.id), eq(documents.userId, userId)),
    )
    .where(
      and(
        eq(applicationDocuments.userId, userId),
        eq(applicationDocuments.applicationId, currentApp.id),
      ),
    );

  // Also capture direct cvVersionId / coverLetterVersionId references if not already in application_documents
  const directVerIds = [
    currentApp.cvVersionId,
    currentApp.coverLetterVersionId,
  ].filter((id): id is string => Boolean(id));

  const seenVersionIds = new Set(attachedDocRows.map((d) => d.version.id));
  const missingDirectIds = directVerIds.filter((id) => !seenVersionIds.has(id));

  const directVerRows =
    missingDirectIds.length > 0
      ? await dbOrTx
          .select({
            version: documentVersions,
            document: documents,
          })
          .from(documentVersions)
          .innerJoin(
            documents,
            and(
              eq(documentVersions.documentId, documents.id),
              eq(documents.userId, userId),
            ),
          )
          .where(
            and(
              eq(documentVersions.userId, userId),
              inArray(documentVersions.id, missingDirectIds),
            ),
          )
      : [];

  type DocCaptureRow = {
    documentId: string | null;
    documentVersionId: string | null;
    role: string;
    documentCategory: string | null;
    documentTitle: string;
    versionNo: number | null;
    versionLabel: string;
    filename: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    sha256: string | null;
    storageKey: string | null;
    notes: string | null;
  };

  const docCaptures: DocCaptureRow[] = [];

  for (const row of attachedDocRows) {
    docCaptures.push({
      documentId: row.document.id,
      documentVersionId: row.version.id,
      role: row.link.role,
      documentCategory: row.document.category,
      documentTitle: row.document.title,
      versionNo: row.version.versionNo,
      versionLabel: row.version.label,
      filename: row.version.filename,
      mimeType: row.version.mimeType,
      sizeBytes: row.version.sizeBytes,
      sha256: row.version.sha256,
      storageKey: row.version.storageKey,
      notes: row.version.notes,
    });
  }

  for (const row of directVerRows) {
    const role =
      row.version.id === currentApp.cvVersionId
        ? "cv"
        : row.version.id === currentApp.coverLetterVersionId
          ? "cover_letter"
          : "other";
    docCaptures.push({
      documentId: row.document.id,
      documentVersionId: row.version.id,
      role,
      documentCategory: row.document.category,
      documentTitle: row.document.title,
      versionNo: row.version.versionNo,
      versionLabel: row.version.label,
      filename: row.version.filename,
      mimeType: row.version.mimeType,
      sizeBytes: row.version.sizeBytes,
      sha256: row.version.sha256,
      storageKey: row.version.storageKey,
      notes: row.version.notes,
    });
  }

  // Fallback for label-only CV/Cover Letter references without uploaded file versions
  const hasCvCapture = docCaptures.some((d) => d.role === "cv");
  if (!hasCvCapture && currentApp.cvVersionLabel) {
    docCaptures.push({
      documentId: null,
      documentVersionId: null,
      role: "cv",
      documentCategory: "custom_cv",
      documentTitle: "Submitted CV Reference",
      versionNo: null,
      versionLabel: currentApp.cvVersionLabel,
      filename: currentApp.cvVersionLabel,
      mimeType: null,
      sizeBytes: null,
      sha256: null,
      storageKey: null,
      notes: "Captured from application CV version label",
    });
  }

  const hasCoverCapture = docCaptures.some((d) => d.role === "cover_letter");
  if (!hasCoverCapture && currentApp.coverLetterVersionLabel) {
    docCaptures.push({
      documentId: null,
      documentVersionId: null,
      role: "cover_letter",
      documentCategory: "cover_letter",
      documentTitle: "Submitted Cover Letter Reference",
      versionNo: null,
      versionLabel: currentApp.coverLetterVersionLabel,
      filename: currentApp.coverLetterVersionLabel,
      mimeType: null,
      sizeBytes: null,
      sha256: null,
      storageKey: null,
      notes: "Captured from application cover letter version label",
    });
  }

  const snapshotDocs: SnapshotDocumentItem[] = docCaptures.map((d) => ({
    documentId: d.documentId,
    documentVersionId: d.documentVersionId,
    role: d.role,
    documentCategory: d.documentCategory,
    documentTitle: d.documentTitle,
    versionNo: d.versionNo,
    versionLabel: d.versionLabel,
    filename: d.filename,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    sha256: d.sha256,
    notes: d.notes,
  }));

  const snapshotPayload: ApplicationArchiveSnapshotPayload = {
    schemaVersion: 1,
    application: {
      id: currentApp.id,
      code: currentApp.code,
      submittedOn: currentApp.submittedOn,
      closedOn,
      outcome: currentApp.outcome,
      closureOutcome: resolvedClosureOutcome,
      submissionMethod: currentApp.submissionMethod,
      platformName: appRow.platform?.name ?? null,
      applicationUrl: currentApp.applicationUrl,
      externalReferenceId: currentApp.externalReferenceId,
      confirmationReference: currentApp.confirmationReference,
      cvVersionLabel: currentApp.cvVersionLabel,
      coverLetterVersionLabel: currentApp.coverLetterVersionLabel,
      recruiterName: currentApp.recruiterName,
      recruiterEmail: currentApp.recruiterEmail,
      recruiterContact: currentApp.recruiterContact,
      expectedSalary: currentApp.expectedSalary,
      currency: currentApp.currency,
      jobCategory: currentApp.jobCategory,
      attemptNumber: currentApp.attemptNumber,
      reapplyReason: currentApp.reapplyReason,
      notes: currentApp.notes,
      stageAtClosure: {
        id: currentStage.id,
        name: currentStage.name,
        stageType: currentStage.stageType,
        color: currentStage.color,
      },
    },
    vacancy: {
      id: appRow.vacancy.id,
      code: appRow.vacancy.code,
      title: appRow.vacancy.title,
      department: appRow.vacancy.department,
      industry: appRow.vacancy.industry,
      location: appRow.vacancy.location,
      employmentType: appRow.vacancy.employmentType,
      workArrangement: appRow.vacancy.workArrangement,
      salaryMin: appRow.vacancy.salaryMin,
      salaryMax: appRow.vacancy.salaryMax,
      currency: appRow.vacancy.currency,
      salaryPeriod: appRow.vacancy.salaryPeriod,
      url: appRow.vacancy.url,
      qualifications: appRow.vacancy.qualifications,
      description: appRow.vacancy.description,
      skills: appRow.vacancy.skills ?? [],
      suitabilityScore: appRow.vacancy.suitabilityScore,
      notes: appRow.vacancy.notes,
    },
    company: {
      id: appRow.company.id,
      name: appRow.company.name,
      industry: appRow.company.industry,
      website: appRow.company.website,
      location: appRow.company.location,
      size: appRow.company.size,
    },
    suitabilityEvaluation: suitability
      ? {
          skillsScore: suitability.skillsScore,
          experienceScore: suitability.experienceScore,
          educationScore: suitability.educationScore,
          salaryScore: suitability.salaryScore,
          locationScore: suitability.locationScore,
          growthScore: suitability.growthScore,
          overallScore: suitability.overallScore,
          notes: suitability.notes,
        }
      : null,
    statusHistory: historyRows.map((h) => {
      const fromSt = h.fromStageId ? stageMap.get(h.fromStageId) : undefined;
      const toSt = stageMap.get(h.toStageId);
      return {
        id: h.id,
        fromStageId: h.fromStageId,
        fromStageName: fromSt?.name ?? null,
        toStageId: h.toStageId,
        toStageName: toSt?.name ?? "Stage",
        toStageType: toSt?.stageType ?? "applied",
        toStageColor: toSt?.color ?? "slate",
        effectiveOn: h.effectiveOn,
        recordedAt: h.recordedAt.toISOString(),
        source: h.source,
        reason: h.reason,
        note: h.note,
      };
    }),
    communications: commRows.map((c) => ({
      id: c.id,
      source: c.source,
      channel: c.channel,
      direction: c.direction,
      sender: c.sender,
      recipient: c.recipient,
      subject: c.subject,
      snippet: c.snippet,
      occurredAt: c.occurredAt.toISOString(),
      classification: c.classification,
      confidence: c.confidence,
    })),
    interviews: interviewRows.map((i) => ({
      id: i.id,
      interviewType: i.interviewType,
      startsAt: i.startsAt.toISOString(),
      durationMinutes: i.durationMinutes,
      timezone: i.timezone,
      location: i.location,
      meetingUrl: i.meetingUrl,
      interviewerName: i.interviewerName,
      interviewerPosition: i.interviewerPosition,
      notes: i.notes,
      questions: i.questions,
      preparationNotes: i.preparationNotes,
      feedback: i.feedback,
      result: i.result,
      status: i.status,
    })),
    assessments: assessmentRows.map((a) => ({
      id: a.id,
      assessmentType: a.assessmentType,
      title: a.title,
      dueAt: a.dueAt ? a.dueAt.toISOString() : null,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      score: a.score,
      maxScore: a.maxScore,
      result: a.result,
      notes: a.notes,
    })),
    offer: offerRow
      ? {
          id: offerRow.id,
          positionTitle: offerRow.positionTitle,
          baseSalary: offerRow.baseSalary,
          currency: offerRow.currency,
          salaryPeriod: offerRow.salaryPeriod,
          benefits: offerRow.benefits,
          joiningDate: offerRow.joiningDate,
          offerReceivedOn: offerRow.offerReceivedOn,
          responseDeadline: offerRow.responseDeadline,
          decision: offerRow.decision,
          decidedOn: offerRow.decidedOn,
          notes: offerRow.notes,
        }
      : null,
    followUpTasks: followUpRows.map((f) => ({
      id: f.id,
      type: f.type,
      title: f.title,
      sequenceNo: f.sequenceNo,
      dueOn: f.dueOn,
      status: f.status,
      completedAt: f.completedAt ? f.completedAt.toISOString() : null,
      note: f.note,
    })),
    documents: snapshotDocs,
  };

  const contentHash = computeSnapshotContentHash(snapshotPayload);

  const [{ snapCount }] = await dbOrTx
    .select({ snapCount: sql<number>`count(*)::int` })
    .from(applicationArchiveSnapshots)
    .where(
      and(
        eq(applicationArchiveSnapshots.userId, userId),
        eq(applicationArchiveSnapshots.applicationId, currentApp.id),
      ),
    );

  const retainUntil = computeRetainUntil(
    closedOn,
    settings?.archiveRetentionDays ?? null,
  );
  const isSample = params.isSample ?? currentApp.isSample;

  const [closureRecord] = await dbOrTx
    .insert(applicationClosureRecords)
    .values({
      userId,
      applicationId: currentApp.id,
      vacancyId: appRow.vacancy.id,
      closureOutcome: resolvedClosureOutcome,
      closureSource: resolvedClosureSource,
      status: "archived",
      closedOn,
      archivedAt: new Date(),
      previousStageId,
      previousOutcome,
      closedStageId: currentStage.id,
      closureReason: params.closureReason || null,
      closureNote: params.closureNote || null,
      retainUntil,
      isSample,
    })
    .returning();

  const [snapshot] = await dbOrTx
    .insert(applicationArchiveSnapshots)
    .values({
      userId,
      closureRecordId: closureRecord.id,
      applicationId: currentApp.id,
      snapshotVersion: snapCount + 1,
      applicationCode: currentApp.code,
      companyName: appRow.company.name,
      jobTitle: appRow.vacancy.title,
      closureOutcome: resolvedClosureOutcome,
      closedOn,
      submittedOn: currentApp.submittedOn,
      attemptNumber: currentApp.attemptNumber,
      contentHash,
      snapshotPayload,
      capturedAt: new Date(),
      isSample,
    })
    .returning();

  if (docCaptures.length > 0) {
    await dbOrTx.insert(applicationArchiveDocuments).values(
      docCaptures.map((d) => ({
        userId,
        closureRecordId: closureRecord.id,
        snapshotId: snapshot.id,
        applicationId: currentApp.id,
        documentId: d.documentId,
        documentVersionId: d.documentVersionId,
        role: d.role,
        documentCategory: d.documentCategory,
        documentTitle: d.documentTitle,
        versionNo: d.versionNo,
        versionLabel: d.versionLabel,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        sha256: d.sha256,
        storageKey: d.storageKey,
        notes: d.notes,
      })),
    );
  }

  await writeAudit(dbOrTx, {
    userId,
    entityType: "application_archive",
    entityId: closureRecord.id,
    action: "create",
    summary: `Archived ${currentApp.code} (${appRow.company.name} — ${appRow.vacancy.title}) as ${resolvedClosureOutcome}`,
    changes: {
      applicationId: currentApp.id,
      snapshotId: snapshot.id,
      snapshotVersion: snapshot.snapshotVersion,
      contentHash,
      closureOutcome: resolvedClosureOutcome,
      closureSource: resolvedClosureSource,
    },
  });

  return {
    closureRecord,
    snapshot,
    alreadyArchived: false,
  };
}

export const archiveApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  closureOutcome: z.enum(ARCHIVE_OUTCOMES).optional(),
  closureSource: z.enum(ARCHIVE_CLOSURE_SOURCES).optional(),
  closedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  closureReason: z.string().trim().max(1000).optional().nullable(),
  closureNote: z.string().trim().max(2000).optional().nullable(),
});

export async function archiveApplicationService(
  userId: string,
  rawInput: z.infer<typeof archiveApplicationSchema>,
) {
  const input = archiveApplicationSchema.parse(rawInput);
  const db = await ensureDbReady();

  return db.transaction(async (tx) => {
    return archiveApplicationTx(tx, {
      userId,
      applicationId: input.applicationId,
      closureOutcome: input.closureOutcome,
      closureSource: input.closureSource ?? "manual_archive",
      closedOn: input.closedOn,
      closureReason: input.closureReason,
      closureNote: input.closureNote,
    });
  });
}

export const restoreArchivedApplicationSchema = z.object({
  closureRecordId: z.string().uuid(),
  restoreToStageId: z.string().uuid().optional().nullable(),
  reason: z
    .string()
    .trim()
    .min(1, "Please provide a reason for restoring this application.")
    .max(1000),
});

export async function restoreArchivedApplicationService(
  userId: string,
  rawInput: z.infer<typeof restoreArchivedApplicationSchema>,
) {
  const input = restoreArchivedApplicationSchema.parse(rawInput);
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);
  const allStages = await getUserStages(userId, true);
  const stageMap = new Map(allStages.map((s) => [s.id, s]));

  return db.transaction(async (tx) => {
    const [closure] = await tx
      .select()
      .from(applicationClosureRecords)
      .where(
        and(
          eq(applicationClosureRecords.id, input.closureRecordId),
          eq(applicationClosureRecords.userId, userId),
        ),
      );
    if (!closure) {
      throw new Error("Archive closure record not found.");
    }
    if (closure.status !== "archived") {
      throw new Error("This archive record has already been restored.");
    }

    const [app] = await tx
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.id, closure.applicationId),
          eq(applications.userId, userId),
        ),
      );
    if (!app) {
      throw new Error("Original application record not found.");
    }

    // Ensure restoring won't collide with another active application for the same vacancy
    const [otherActive] = await tx
      .select({ id: applications.id, code: applications.code })
      .from(applications)
      .where(
        and(
          eq(applications.userId, userId),
          eq(applications.vacancyId, app.vacancyId),
          eq(applications.outcome, "active"),
        ),
      )
      .limit(1);

    if (otherActive && otherActive.id !== app.id) {
      throw new Error(
        `Cannot restore because another active application (${otherActive.code}) already exists for this vacancy.`,
      );
    }

    // Resolve target active stage
    let targetStage = input.restoreToStageId
      ? stageMap.get(input.restoreToStageId)
      : undefined;

    if (
      targetStage &&
      (isTerminal(targetStage.stageType) || isVacancyLevel(targetStage.stageType))
    ) {
      throw new Error("Target restore stage must be an active pipeline stage.");
    }

    if (!targetStage && closure.previousStageId) {
      const prev = stageMap.get(closure.previousStageId);
      if (prev && !isTerminal(prev.stageType) && !isVacancyLevel(prev.stageType)) {
        targetStage = prev;
      }
    }

    if (!targetStage) {
      const historyRows = await tx
        .select()
        .from(applicationStatusHistory)
        .where(
          and(
            eq(applicationStatusHistory.userId, userId),
            eq(applicationStatusHistory.applicationId, app.id),
          ),
        )
        .orderBy(
          desc(applicationStatusHistory.effectiveOn),
          desc(applicationStatusHistory.recordedAt),
        );

      for (const h of historyRows) {
        const st = stageMap.get(h.toStageId);
        if (st && !isTerminal(st.stageType) && !isVacancyLevel(st.stageType)) {
          targetStage = st;
          break;
        }
      }
    }

    if (!targetStage) {
      targetStage =
        allStages.find((s) => s.key === "applied") ??
        allStages.find((s) => s.stageType === "applied");
    }

    if (!targetStage) {
      throw new Error("No active pipeline stage available to restore to.");
    }

    const [restoredApp] = await tx
      .update(applications)
      .set({
        currentStageId: targetStage.id,
        outcome: "active",
        closedAt: null,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, app.id), eq(applications.userId, userId)))
      .returning();

    await tx.insert(applicationStatusHistory).values({
      userId,
      applicationId: app.id,
      fromStageId: app.currentStageId,
      toStageId: targetStage.id,
      effectiveOn: today,
      source: "reopen",
      reason: input.reason,
      note: `Restored from archive (${closure.closureOutcome}) to ${targetStage.name}`,
    });

    // Mark closure record restored — immutable snapshot row remains untouched
    const [updatedClosure] = await tx
      .update(applicationClosureRecords)
      .set({
        status: "restored",
        restoredAt: new Date(),
        restoredToStageId: targetStage.id,
        restorationReason: input.reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(applicationClosureRecords.id, closure.id),
          eq(applicationClosureRecords.userId, userId),
        ),
      )
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "application_archive",
      entityId: closure.id,
      action: "update",
      summary: `Restored ${app.code} from archive to ${targetStage.name}`,
      changes: {
        applicationId: app.id,
        restoredToStage: targetStage.name,
        reason: input.reason,
      },
    });

    return {
      closureRecord: updatedClosure,
      application: restoredApp,
      restoredToStage: targetStage,
    };
  });
}

export const reapplyFromArchiveSchema = z.object({
  closureRecordId: z.string().uuid(),
  submittedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Submission date is required (YYYY-MM-DD)"),
  reapplyReason: z
    .string()
    .trim()
    .min(1, "Please explain why you are re-applying to this position.")
    .max(1000),
  submissionMethod: z.enum(SUBMISSION_METHODS).optional(),
  cvVersionLabel: z.string().trim().max(160).optional().nullable(),
  coverLetterVersionLabel: z.string().trim().max(160).optional().nullable(),
  expectedSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).optional(),
  notes: z.string().trim().max(10000).optional().nullable(),
});

export async function reapplyFromArchiveService(
  userId: string,
  rawInput: z.infer<typeof reapplyFromArchiveSchema>,
) {
  const input = reapplyFromArchiveSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [closure] = await db
    .select()
    .from(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.id, input.closureRecordId),
        eq(applicationClosureRecords.userId, userId),
      ),
    );
  if (!closure) {
    throw new Error("Archive closure record not found.");
  }

  const [prevApp] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, closure.applicationId),
        eq(applications.userId, userId),
      ),
    );
  if (!prevApp) {
    throw new Error("Original application record not found.");
  }

  return recordSubmissionService(userId, {
    vacancyId: prevApp.vacancyId,
    submittedOn: input.submittedOn,
    platformSourceId: prevApp.platformSourceId,
    submissionMethod: input.submissionMethod ?? prevApp.submissionMethod,
    applicationUrl: prevApp.applicationUrl,
    cvVersionLabel: input.cvVersionLabel ?? prevApp.cvVersionLabel,
    coverLetterVersionLabel:
      input.coverLetterVersionLabel ?? prevApp.coverLetterVersionLabel,
    recruiterName: prevApp.recruiterName,
    recruiterEmail: prevApp.recruiterEmail,
    recruiterContact: prevApp.recruiterContact,
    expectedSalary: input.expectedSalary ?? prevApp.expectedSalary,
    currency: (input.currency ?? prevApp.currency) as (typeof CURRENCIES)[number],
    jobCategory: prevApp.jobCategory,
    notes: input.notes ?? null,
    isIntentionalReapply: true,
    reapplyReason: input.reapplyReason,
  });
}

export const retentionPolicySchema = z.object({
  autoArchiveOnTerminal: z.boolean(),
  archiveRetentionDays: z
    .number()
    .int()
    .min(30, "Minimum retention period is 30 days")
    .max(3650, "Maximum retention period is 3650 days (10 years)")
    .nullable(),
  archiveAutoDeleteExpired: z.boolean(),
});

export async function updateRetentionPolicyService(
  userId: string,
  rawInput: z.infer<typeof retentionPolicySchema>,
) {
  const input = retentionPolicySchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(userSettings)
    .set({
      autoArchiveOnTerminal: input.autoArchiveOnTerminal,
      archiveRetentionDays: input.archiveRetentionDays,
      archiveAutoDeleteExpired: input.archiveAutoDeleteExpired,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "user_settings",
    entityId: userId,
    action: "update",
    summary: "Updated application archive & retention policy",
    changes: {
      autoArchiveOnTerminal: input.autoArchiveOnTerminal,
      archiveRetentionDays: input.archiveRetentionDays,
      archiveAutoDeleteExpired: input.archiveAutoDeleteExpired,
    },
  });

  return updated;
}

export const updateClosureRetentionSchema = z.object({
  closureRecordId: z.string().uuid(),
  retainUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .nullable(),
});

export async function updateClosureRetentionService(
  userId: string,
  rawInput: z.infer<typeof updateClosureRetentionSchema>,
) {
  const input = updateClosureRetentionSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(applicationClosureRecords)
    .set({
      retainUntil: input.retainUntil,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applicationClosureRecords.id, input.closureRecordId),
        eq(applicationClosureRecords.userId, userId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Archive closure record not found.");
  }

  await writeAudit(db, {
    userId,
    entityType: "application_archive",
    entityId: updated.id,
    action: "update",
    summary: `Updated archive retention date to ${input.retainUntil ?? "indefinite"}`,
  });

  return updated;
}

export async function deleteArchiveRecordService(
  userId: string,
  closureRecordId: string,
) {
  const parsedId = z.string().uuid().parse(closureRecordId);
  const db = await ensureDbReady();

  const [deleted] = await db
    .delete(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.id, parsedId),
        eq(applicationClosureRecords.userId, userId),
      ),
    )
    .returning();

  if (!deleted) {
    throw new Error("Archive closure record not found.");
  }

  await writeAudit(db, {
    userId,
    entityType: "application_archive",
    entityId: deleted.id,
    action: "delete",
    summary: `Deleted archive record for application ${deleted.applicationId} (original application preserved)`,
  });

  return deleted;
}

export async function purgeExpiredArchivesService(userId: string) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const deleted = await db
    .delete(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.userId, userId),
        eq(applicationClosureRecords.status, "archived"),
        lt(applicationClosureRecords.retainUntil, today),
      ),
    )
    .returning();

  if (deleted.length > 0) {
    await writeAudit(db, {
      userId,
      entityType: "application_archive",
      entityId: userId,
      action: "delete",
      summary: `Purged ${deleted.length} expired archive record(s) per retention policy`,
    });
  }

  return { purgedCount: deleted.length };
}

export { mapHistorySourceToClosureSource };
