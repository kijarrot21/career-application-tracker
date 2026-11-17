import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  applicationArchiveSnapshots,
  applicationClosureRecords,
  applications,
  applicationStatusHistory,
} from "@/db/schema";
import {
  getArchivedApplicationDetail,
  listArchivedApplications,
} from "@/server/queries/archive";
import { getUserStages } from "@/server/queries/settings";
import {
  logCommunicationService,
  moveApplicationStageService,
  recordSubmissionService,
  scheduleInterviewService,
  updateApplicationService,
} from "@/server/services/applications";
import {
  archiveApplicationService,
  deleteArchiveRecordService,
  purgeExpiredArchivesService,
  reapplyFromArchiveService,
  restoreArchivedApplicationService,
  updateClosureRetentionService,
  updateRetentionPolicyService,
} from "@/server/services/archive";
import {
  deleteDocumentService,
  saveAssessmentService,
  uploadOrVersionDocumentService,
} from "@/server/services/career";
import { createVacancyService } from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

describe("Application Archive integration tests (in-memory PGlite)", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "user_a",
      name: "Alice Candidate",
      email: "alice@example.com",
    });
    await createTestUser(db, {
      id: "user_b",
      name: "Bob Other",
      email: "bob@example.com",
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("auto-archives rejected applications, captures full immutable snapshot, and preserves original record", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT Bukalapak",
      title: "Senior Backend Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["Go", "PostgreSQL"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-01",
      submissionMethod: "platform",
      currency: "IDR",
      cvVersionLabel: "CV_Backend_v1.pdf",
      notes: "Original application note",
      isIntentionalReapply: false,
    });

    await logCommunicationService("user_a", {
      applicationId: app.id,
      channel: "email",
      direction: "inbound",
      classification: "interview_invitation",
      sender: "hr@bukalapak.com",
      subject: "Interview Invitation",
      snippet: "Let us schedule your HR interview.",
      occurredAt: "2026-10-03T04:00:00Z",
    });

    await scheduleInterviewService("user_a", {
      applicationId: app.id,
      interviewType: "hr",
      startsAt: "2026-10-05T03:00:00Z",
      durationMinutes: 45,
      interviewerName: "Siti Rahma",
    });

    await saveAssessmentService("user_a", {
      applicationId: app.id,
      assessmentType: "technical",
      title: "Go Concurrency Test",
      score: "85",
      maxScore: "100",
      result: "passed",
    });

    const stages = await getUserStages("user_a");
    const rejectedStage = stages.find((s) => s.key === "rejected")!;

    const moveRes = await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: rejectedStage.id,
      effectiveOn: "2026-10-12",
      source: "manual",
      reason: "Headcount frozen for Q4",
    });

    expect(moveRes.application.outcome).toBe("unsuccessful");
    expect(moveRes.archive).not.toBeNull();
    expect(moveRes.archive?.alreadyArchived).toBe(false);

    const archiveList = await listArchivedApplications("user_a");
    expect(archiveList.items).toHaveLength(1);
    expect(archiveList.items[0].closureOutcome).toBe("rejected");
    expect(archiveList.items[0].snapshot.applicationCode).toBe(app.code);

    const detail = await getArchivedApplicationDetail(
      "user_a",
      archiveList.items[0].id,
    );
    expect(detail).not.toBeNull();
    expect(detail!.integrityVerified).toBe(true);
    expect(detail!.snapshot.snapshotPayload.communications).toHaveLength(1);
    expect(detail!.snapshot.snapshotPayload.interviews).toHaveLength(1);
    expect(detail!.snapshot.snapshotPayload.assessments).toHaveLength(1);
    expect(detail!.snapshot.snapshotPayload.statusHistory.length).toBeGreaterThanOrEqual(4);
    expect(detail!.snapshot.snapshotPayload.application.notes).toBe("Original application note");

    // Mutate the live application notes later — immutable snapshot must remain unchanged
    await updateApplicationService("user_a", app.id, {
      submittedOn: "2026-10-01",
      submissionMethod: "platform",
      currency: "IDR",
      notes: "Modified live note after closure",
    });

    const detailAfterEdit = await getArchivedApplicationDetail(
      "user_a",
      archiveList.items[0].id,
    );
    expect(detailAfterEdit!.snapshot.snapshotPayload.application.notes).toBe(
      "Original application note",
    );
    expect(detailAfterEdit!.integrityVerified).toBe(true);

    // Original application row remains intact
    const [liveApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, app.id));
    expect(liveApp).toBeDefined();
    expect(liveApp.notes).toBe("Modified live note after closure");
  });

  it("supports withdrawn application archival and prevents duplicate active archive creation", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT Dana Indonesia",
      title: "Platform Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "medium",
      triageStatus: "shortlisted",
      skills: ["Kubernetes"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-02",
      submissionMethod: "company_portal",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const stages = await getUserStages("user_a");
    const withdrawnStage = stages.find((s) => s.key === "withdrawn")!;

    const moved = await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: withdrawnStage.id,
      effectiveOn: "2026-10-08",
      source: "manual",
      reason: "Accepted another offer",
    });

    expect(moved.archive?.closureRecord.closureOutcome).toBe("withdrawn");

    // Calling archiveApplicationService again must be idempotent (no duplicate closure/snapshot)
    const secondArchive = await archiveApplicationService("user_a", {
      applicationId: app.id,
      closureOutcome: "withdrawn",
    });
    expect(secondArchive.alreadyArchived).toBe(true);
    expect(secondArchive.closureRecord.id).toBe(moved.archive?.closureRecord.id);

    const rows = await db
      .select()
      .from(applicationClosureRecords)
      .where(eq(applicationClosureRecords.applicationId, app.id));
    expect(rows).toHaveLength(1);
  });

  it("preserves document and document-version references even if the live document is later deleted", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT Traveloka",
      title: "Frontend Architect",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["React", "TypeScript"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-04",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const pdfBytes = Buffer.from("%PDF-1.4\n%sample cv content\n");
    const uploaded = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "custom_cv",
        title: "Traveloka Tailored CV",
        versionLabel: "v2.1",
        notes: "Highlighted micro-frontend migration",
        linkApplicationId: app.id,
        linkRole: "cv",
      },
      file: { buffer: pdfBytes, filename: "traveloka_cv.pdf" },
    });

    const archived = await archiveApplicationService("user_a", {
      applicationId: app.id,
      closureOutcome: "closed",
      closedOn: "2026-10-15",
      closureReason: "Role closed due to reorg",
    });

    // Delete original document from Document Repository
    await deleteDocumentService("user_a", uploaded.documentId);

    const detail = await getArchivedApplicationDetail(
      "user_a",
      archived.closureRecord.id,
    );
    expect(detail!.archiveDocuments).toHaveLength(1);
    expect(detail!.archiveDocuments[0].documentTitle).toBe("Traveloka Tailored CV");
    expect(detail!.archiveDocuments[0].versionLabel).toBe("v2.1");
    expect(detail!.archiveDocuments[0].versionNo).toBe(1);
    expect(detail!.archiveDocuments[0].sha256).toBeTruthy();
    // FK set null cleanly while metadata remains preserved
    expect(detail!.archiveDocuments[0].documentId).toBeNull();
    expect(detail!.archiveDocuments[0].documentVersionId).toBeNull();
  });

  it("supports restoring from incorrect archival while keeping the historical snapshot immutable", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT GoTo",
      title: "Staff Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["Go"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-01",
      submissionMethod: "referral",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const stages = await getUserStages("user_a");
    const hrStage = stages.find((s) => s.key === "hr_interview")!;
    const rejectedStage = stages.find((s) => s.key === "rejected")!;

    await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: hrStage.id,
      effectiveOn: "2026-10-05",
      source: "manual",
    });

    const rejectedMove = await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: rejectedStage.id,
      effectiveOn: "2026-10-09",
      source: "manual",
      reason: "Misread automated email",
    });

    const closureId = rejectedMove.archive!.closureRecord.id;
    const snapshotId = rejectedMove.archive!.snapshot!.id;
    const originalHash = rejectedMove.archive!.snapshot!.contentHash;

    const restored = await restoreArchivedApplicationService("user_a", {
      closureRecordId: closureId,
      reason: "Recruiter clarified candidate advanced to user interview",
    });

    expect(restored.application.outcome).toBe("active");
    expect(restored.application.closedAt).toBeNull();
    expect(restored.restoredToStage.id).toBe(hrStage.id);
    expect(restored.closureRecord.status).toBe("restored");

    // Snapshot remains immutable & verifiable
    const [snap] = await db
      .select()
      .from(applicationArchiveSnapshots)
      .where(eq(applicationArchiveSnapshots.id, snapshotId));
    expect(snap.contentHash).toBe(originalHash);

    // Reopen recorded in status history
    const history = await db
      .select()
      .from(applicationStatusHistory)
      .where(
        and(
          eq(applicationStatusHistory.applicationId, app.id),
          eq(applicationStatusHistory.source, "reopen"),
        ),
      );
    expect(history).toHaveLength(1);
  });

  it("supports intentional re-application from archive as a new attempt", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT Shopee Indonesia",
      title: "Software Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "medium",
      triageStatus: "shortlisted",
      skills: ["Go", "MySQL"],
    });

    const firstApp = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-08-01",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const stages = await getUserStages("user_a");
    const noResponseStage = stages.find((s) => s.key === "no_response")!;
    const closedMove = await moveApplicationStageService("user_a", {
      applicationId: firstApp.id,
      toStageId: noResponseStage.id,
      effectiveOn: "2026-09-15",
      source: "no_response_suggestion",
      reason: "No reply after 45 days",
    });

    const secondApp = await reapplyFromArchiveService("user_a", {
      closureRecordId: closedMove.archive!.closureRecord.id,
      submittedOn: "2026-11-10",
      reapplyReason: "Role re-opened with new hiring manager",
      cvVersionLabel: "CV_v3_Shopee.pdf",
    });

    expect(secondApp.id).not.toBe(firstApp.id);
    expect(secondApp.vacancyId).toBe(vac.id);
    expect(secondApp.attemptNumber).toBe(2);
    expect(secondApp.outcome).toBe("active");
    expect(secondApp.reapplyReason).toBe("Role re-opened with new hiring manager");
  });

  it("enforces retention policy and allows purging expired archive records without deleting live applications", async () => {
    await updateRetentionPolicyService("user_a", {
      autoArchiveOnTerminal: true,
      archiveRetentionDays: 365,
      archiveAutoDeleteExpired: false,
    });

    const vac = await createVacancyService("user_a", {
      companyName: "PT OVO",
      title: "Data Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "low",
      triageStatus: "shortlisted",
      skills: ["Python", "SQL"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2024-01-01",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const archived = await archiveApplicationService("user_a", {
      applicationId: app.id,
      closureOutcome: "closed",
      closedOn: "2024-02-01",
    });

    expect(archived.closureRecord.retainUntil).toBe("2025-01-31");

    const purged = await purgeExpiredArchivesService("user_a");
    expect(purged.purgedCount).toBe(1);

    // Live application remains intact
    const [liveApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, app.id));
    expect(liveApp).toBeDefined();
  });

  it("prevents cross-user access to archive records, snapshots, restore, re-apply, retention, and delete", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "PT Bank Jago",
      title: "Security Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["AppSec"],
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-01",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const archived = await archiveApplicationService("user_a", {
      applicationId: app.id,
      closureOutcome: "rejected",
      closedOn: "2026-10-10",
    });

    const closureId = archived.closureRecord.id;

    // User B cannot see or access User A's archive
    const listB = await listArchivedApplications("user_b");
    expect(listB.items).toHaveLength(0);

    const detailB = await getArchivedApplicationDetail("user_b", closureId);
    expect(detailB).toBeNull();

    await expect(
      restoreArchivedApplicationService("user_b", {
        closureRecordId: closureId,
        reason: "Unauthorized restore",
      }),
    ).rejects.toThrow();

    await expect(
      reapplyFromArchiveService("user_b", {
        closureRecordId: closureId,
        submittedOn: "2026-11-10",
        reapplyReason: "Unauthorized reapply",
      }),
    ).rejects.toThrow();

    await expect(
      updateClosureRetentionService("user_b", {
        closureRecordId: closureId,
        retainUntil: "2027-01-01",
      }),
    ).rejects.toThrow();

    await expect(
      deleteArchiveRecordService("user_b", closureId),
    ).rejects.toThrow();
  });
});
