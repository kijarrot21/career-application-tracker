import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { getApplicationDetail, listApplications } from "@/server/queries/applications";
import { getDashboardData } from "@/server/queries/dashboard";
import { getEmailCenterData } from "@/server/queries/emails";
import { getUserStages } from "@/server/queries/settings";
import { getVacancyDetail, listVacancies } from "@/server/queries/vacancies";
import {
  completeFollowUpTaskService,
  moveApplicationStageService,
  recordSubmissionService,
} from "@/server/services/applications";
import {
  confirmEmailStageTransitionService,
  ingestEmailMessageService,
  linkEmailToApplicationService,
} from "@/server/services/emails";
import {
  deleteDocumentService,
  getDocumentVersionFileForUserService,
  saveAssessmentService,
  uploadOrVersionDocumentService,
  upsertJobOfferService,
} from "@/server/services/career";
import { getDocumentsModuleData, getInterviewsModuleData } from "@/server/queries/career";
import { getAnalyticsData } from "@/server/queries/analytics";
import {
  loadSampleDataService,
  removeSampleDataService,
} from "@/server/services/settings";
import {
  createVacancyService,
  deleteVacancyService,
  saveSuitabilityService,
} from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

describe("Personal ATS integration tests (in-memory PGlite)", () => {
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

  it("enforces strict per-user data isolation across vacancies and applications", async () => {
    const vacA = await createVacancyService("user_a", {
      companyName: "PT Tokopedia",
      title: "Backend Engineer",
      url: "https://www.linkedin.com/jobs/view/1234567890",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["Go", "PostgreSQL"],
    });

    const appA = await recordSubmissionService("user_a", {
      vacancyId: vacA.id,
      submittedOn: "2026-11-10",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    // User B cannot see User A's records
    expect(await listVacancies("user_b")).toHaveLength(0);
    expect(await getVacancyDetail("user_b", vacA.id)).toBeNull();
    expect(await listApplications("user_b")).toHaveLength(0);
    expect(await getApplicationDetail("user_b", appA.id)).toBeNull();

    // User B cannot delete or transition User A's records
    await expect(deleteVacancyService("user_b", vacA.id)).rejects.toThrow();
    const stagesB = await getUserStages("user_b");
    await expect(
      moveApplicationStageService("user_b", {
        applicationId: appA.id,
        toStageId: stagesB[3].id,
        source: "manual",
      }),
    ).rejects.toThrow();
  });

  it("blocks accidental duplicate active submissions and supports intentional re-application", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "Traveloka",
      title: "Product Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "medium",
      triageStatus: "interested",
      skills: ["TypeScript"],
    });

    const firstApp = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-10-01",
      submissionMethod: "company_portal",
      currency: "IDR",
      isIntentionalReapply: false,
    });
    expect(firstApp.code).toBe("APP-0001");
    expect(firstApp.attemptNumber).toBe(1);

    // Second active submission to the same vacancy must be rejected
    await expect(
      recordSubmissionService("user_a", {
        vacancyId: vac.id,
        submittedOn: "2026-10-05",
        submissionMethod: "platform",
        currency: "IDR",
        isIntentionalReapply: false,
      }),
    ).rejects.toThrow(/active application/i);

    // Move first application to Rejected (terminal)
    const stages = await getUserStages("user_a");
    const rejectedStage = stages.find((s) => s.stageType === "rejected")!;
    await moveApplicationStageService("user_a", {
      applicationId: firstApp.id,
      toStageId: rejectedStage.id,
      effectiveOn: "2026-10-20",
      source: "manual",
      reason: "Role put on hold",
    });

    // Re-applying without intentional confirmation fails
    await expect(
      recordSubmissionService("user_a", {
        vacancyId: vac.id,
        submittedOn: "2026-11-15",
        submissionMethod: "referral",
        currency: "IDR",
        isIntentionalReapply: false,
      }),
    ).rejects.toThrow(/intentional re-application/i);

    // Re-applying with confirmation and reason succeeds as attempt #2
    const secondApp = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-11-15",
      submissionMethod: "referral",
      currency: "IDR",
      isIntentionalReapply: true,
      reapplyReason: "Hiring manager reopened the role and invited me to reapply.",
    });
    expect(secondApp.code).toBe("APP-0002");
    expect(secondApp.attemptNumber).toBe(2);
  });

  it("maintains append-only status history, records skipped stages, and cancels follow-ups on close", async () => {
    const vac = await createVacancyService("user_a", {
      companyName: "Bank Jago",
      title: "Senior Web Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["React", "TypeScript"],
    });

    await saveSuitabilityService("user_a", vac.id, {
      skills: 90,
      experience: 85,
      education: 100,
      salary: 95,
      location: 100,
      growth: 90,
      notes: "Strong fit",
    });

    const app = await recordSubmissionService("user_a", {
      vacancyId: vac.id,
      submittedOn: "2026-11-01",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const stages = await getUserStages("user_a");
    const userInterviewStage = stages.find((s) => s.key === "user_interview")!;
    const hiredStage = stages.find((s) => s.key === "hired")!;

    // Skip CV Screening and HR Interview directly to User Interview
    const moveRes = await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: userInterviewStage.id,
      effectiveOn: "2026-11-08",
      source: "kanban",
    });
    expect(moveRes.transition.kind).toBe("skip");
    expect(moveRes.transition.skipped.map((s) => s.key)).toEqual([
      "cv_screening",
      "hr_interview",
    ]);

    // Move to Hired
    await moveApplicationStageService("user_a", {
      applicationId: app.id,
      toStageId: hiredStage.id,
      effectiveOn: "2026-11-16",
      source: "manual",
      reason: "Signed employment offer",
    });

    const detail = await getApplicationDetail("user_a", app.id);
    expect(detail?.outcome).toBe("successful");
    expect(detail?.closedAt).toBe("2026-11-16");
    // Initial 3 (Sourced, Interested, Applied) + User Interview + Hired = 5 history entries
    expect(detail?.history).toHaveLength(5);
    // Open follow-up task was cancelled when application closed
    expect(detail?.followUps.every((f) => f.status === "cancelled")).toBe(true);
  });

  it("loads sample data, automatically excludes it once real applications exist, and cleanly removes it", async () => {
    await loadSampleDataService("user_a");
    const dashWithSampleOnly = await getDashboardData("user_a");
    expect(dashWithSampleOnly.sampleStatus.hasSampleData).toBe(true);
    expect(dashWithSampleOnly.includeSample).toBe(true);
    expect(dashWithSampleOnly.kpi.totalApplicationsSubmitted).toBe(4);

    // Add 1 real application
    await recordSubmissionService("user_a", {
      companyName: "Real Corp Indonesia",
      title: "Principal Engineer",
      submittedOn: "2026-11-15",
      submissionMethod: "company_portal",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const dashWithReal = await getDashboardData("user_a");
    // Sample data is automatically excluded from KPIs once real applications exist
    expect(dashWithReal.includeSample).toBe(false);
    expect(dashWithReal.kpi.totalApplicationsSubmitted).toBe(1);

    // Removing sample data leaves the real application intact
    await removeSampleDataService("user_a");
    const afterRemove = await getDashboardData("user_a");
    expect(afterRemove.sampleStatus.hasSampleData).toBe(false);
    expect(afterRemove.kpi.totalApplicationsSubmitted).toBe(1);
  });

  it("Phase 3: classifies and matches recruitment emails, prevents duplicates, requires user confirmation before stage changes, and advances follow-up sequences", async () => {
    const app = await recordSubmissionService("user_a", {
      companyName: "Xendit",
      title: "Staff Payments Engineer",
      submittedOn: "2026-11-02",
      submissionMethod: "company_portal",
      recruiterName: "Sari Recruiter",
      recruiterEmail: "sari@xendit.co",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    // 1. Ingest an interview invitation email from the recruiter
    const firstIngest = await ingestEmailMessageService("user_a", {
      source: "gmail",
      channel: "email",
      direction: "inbound",
      providerMessageId: "gmail-msg-001",
      sender: "Sari Recruiter <sari@xendit.co>",
      subject: "Interview Invitation for Staff Payments Engineer at Xendit",
      snippet:
        "We would like to invite you to an HR interview this Friday at 14:00 WIB.",
      occurredAt: "2026-11-10T04:00:00Z",
    });

    expect(firstIngest.deduplicated).toBe(false);
    expect(firstIngest.email.classification).toBe("interview_invitation");
    expect(firstIngest.email.applicationId).toBe(app.id);
    expect(firstIngest.email.linkStatus).toBe("suggested");

    // 2. Re-ingesting the same providerMessageId is deduplicated
    const dupIngest = await ingestEmailMessageService("user_a", {
      source: "gmail",
      channel: "email",
      direction: "inbound",
      providerMessageId: "gmail-msg-001",
      sender: "Sari Recruiter <sari@xendit.co>",
      subject: "Interview Invitation for Staff Payments Engineer at Xendit",
    });
    expect(dupIngest.deduplicated).toBe(true);

    // 3. Application stage must NOT have changed automatically before user confirmation
    const beforeConfirm = await getApplicationDetail("user_a", app.id);
    expect(beforeConfirm?.stage.stageType).toBe("applied");

    // 4. Email Center surfaces a suggestedStage for user confirmation
    const center = await getEmailCenterData("user_a");
    const emailRow = center.emails.find((e) => e.id === firstIngest.email.id);
    expect(emailRow?.suggestedStage?.stageType).toBe("interview");

    // 5. User confirms stage update from the email suggestion
    await confirmEmailStageTransitionService("user_a", {
      emailId: firstIngest.email.id,
      applicationId: app.id,
      toStageId: emailRow!.suggestedStage!.id,
    });

    const afterConfirm = await getApplicationDetail("user_a", app.id);
    expect(afterConfirm?.stage.stageType).toBe("interview");
    expect(afterConfirm?.communications[0]?.linkStatus).toBe("confirmed");

    // 6. Manual unlink and re-link works
    await linkEmailToApplicationService("user_a", {
      emailId: firstIngest.email.id,
      applicationId: null,
      linkStatus: "unlinked",
    });
    const unlinked = await getApplicationDetail("user_a", app.id);
    expect(unlinked?.communications).toHaveLength(0);

    await linkEmailToApplicationService("user_a", {
      emailId: firstIngest.email.id,
      applicationId: app.id,
      linkStatus: "confirmed",
    });

    // 7. Completing the 1st follow-up schedules the 2nd follow-up in sequence
    const firstTask = afterConfirm!.followUps.find((f) => f.sequenceNo === 1)!;
    await completeFollowUpTaskService("user_a", firstTask.id, true);
    const withSecondTask = await getApplicationDetail("user_a", app.id);
    expect(withSecondTask?.followUps.some((f) => f.sequenceNo === 2)).toBe(true);
  });

  it("Phase 4: manages assessments, document versioning, per-user file isolation, and job offer outcome synchronization", async () => {
    const app = await recordSubmissionService("user_a", {
      companyName: "Mekari",
      title: "Lead Product Engineer",
      submittedOn: "2026-11-05",
      submissionMethod: "company_portal",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    // 1. Upload v1 of a CV and associate with the application
    const pdfBufferV1 = Buffer.from("%PDF-1.7\nMaster CV v1", "utf8");
    const v1 = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Master CV - Lead Engineer",
        versionLabel: "v1.0",
        linkApplicationId: app.id,
        linkRole: "cv",
      },
      file: { buffer: pdfBufferV1, filename: "Master_CV_v1.pdf" },
    });
    expect(v1.version.versionNo).toBe(1);

    // 2. Upload v2 to the same document and associate with the application
    const pdfBufferV2 = Buffer.from("%PDF-1.7\nMaster CV v2 Tailored", "utf8");
    const v2 = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        documentId: v1.documentId,
        category: "master_cv",
        title: "Master CV - Lead Engineer",
        versionLabel: "v2.0 (SaaS Tailored)",
        linkApplicationId: app.id,
        linkRole: "cv",
      },
      file: { buffer: pdfBufferV2, filename: "Master_CV_v2.pdf" },
    });
    expect(v2.version.versionNo).toBe(2);

    const docsData = await getDocumentsModuleData("user_a");
    expect(docsData.documents).toHaveLength(1);
    expect(docsData.documents[0]?.versions).toHaveLength(2);

    const updatedApp = await getApplicationDetail("user_a", app.id);
    expect(updatedApp?.cvVersionLabel).toContain("v2.0 (SaaS Tailored)");

    // 3. Enforce per-user isolation on file download
    const userAFile = await getDocumentVersionFileForUserService(
      "user_a",
      v2.version.id,
    );
    expect(userAFile?.buffer.equals(pdfBufferV2)).toBe(true);

    const userBFile = await getDocumentVersionFileForUserService(
      "user_b",
      v2.version.id,
    );
    expect(userBFile).toBeNull();

    // 4. Record an assessment and verify Interviews module data
    await saveAssessmentService("user_a", {
      applicationId: app.id,
      assessmentType: "case_study",
      title: "SaaS Multi-Tenant Architecture Case Study",
      score: "95",
      maxScore: "100",
      result: "passed",
    });
    const intData = await getInterviewsModuleData("user_a");
    expect(intData.assessments).toHaveLength(1);

    // 5. Record an accepted employment offer and verify application transitions to Hired (successful)
    await upsertJobOfferService("user_a", {
      applicationId: app.id,
      positionTitle: "Lead Product Engineer",
      baseSalary: 36_000_000,
      currency: "IDR",
      salaryPeriod: "month",
      offerReceivedOn: "2026-11-15",
      joiningDate: "2026-12-01",
      decision: "accepted",
      syncApplicationStage: true,
    });

    const hiredApp = await getApplicationDetail("user_a", app.id);
    expect(hiredApp?.outcome).toBe("successful");
    expect(hiredApp?.stage.stageType).toBe("hired");
    expect(hiredApp?.offer?.baseSalary).toBe(36_000_000);

    // Cleanup stored files
    await deleteDocumentService("user_a", v1.documentId);
  });

  it("Phase 5: computes date-filtered analytics, platform/industry/company breakdowns, and excludes sample records cleanly", async () => {
    await loadSampleDataService("user_a");

    await recordSubmissionService("user_a", {
      companyName: "GoTo Financial",
      title: "Senior Platform Engineer",
      submittedOn: "2026-11-12",
      submissionMethod: "company_portal",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    // Default auto mode excludes sample data when a real application exists
    const autoAnalytics = await getAnalyticsData("user_a");
    expect(autoAnalytics.includeSample).toBe(false);
    expect(autoAnalytics.kpi.totalApplicationsSubmitted).toBe(1);
    expect(autoAnalytics.companyResponseRates[0]?.companyName).toBe(
      "GoTo Financial",
    );

    // Explicit sampleMode='include' includes both real + sample records
    const combinedAnalytics = await getAnalyticsData("user_a", {
      sampleMode: "include",
    });
    expect(combinedAnalytics.includeSample).toBe(true);
    expect(combinedAnalytics.kpi.totalApplicationsSubmitted).toBe(5);
    expect(combinedAnalytics.platformDistribution.length).toBeGreaterThanOrEqual(
      2,
    );

    // Date-range filtering works accurately
    const octOnly = await getAnalyticsData("user_a", {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      sampleMode: "include",
    });
    expect(octOnly.monthlyPerformance.every((m) => m.month === "2026-10")).toBe(
      true,
    );
  });
});
