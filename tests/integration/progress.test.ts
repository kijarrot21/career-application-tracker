import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { DEFAULT_WEIGHTS } from "@/lib/domain/suitability";
import { detectProgress } from "@/server/services/progress";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = "user_a";
const USER_B = "user_b";

let db: AppDb;
let cleanup: () => Promise<void>;
let seq: number;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  seq = 0;
  await createTestUser(db, {
    id: USER_A,
    name: "Alice",
    email: "alice@example.com",
  });
  await createTestUser(db, {
    id: USER_B,
    name: "Bob",
    email: "bob@example.com",
  });
});

afterEach(async () => {
  await cleanup();
});

async function makeCompany(userId: string) {
  seq += 1;
  const [row] = await db
    .insert(schema.companies)
    .values({
      userId,
      name: `Acme ${seq}`,
      normalizedName: `acme-${seq}`,
    })
    .returning();
  return row;
}

async function makeVacancy(
  userId: string,
  overrides: Partial<typeof schema.jobVacancies.$inferInsert> = {},
) {
  seq += 1;
  const company = await makeCompany(userId);
  const [row] = await db
    .insert(schema.jobVacancies)
    .values({
      userId,
      companyId: company.id,
      code: `JOB-${seq}`,
      title: "Engineer",
      discoveredOn: "2026-01-01",
      ...overrides,
    })
    .returning();
  return row;
}

async function getStageId(userId: string, key: string) {
  const [stage] = await db
    .select()
    .from(schema.applicationStages)
    .where(
      and(
        eq(schema.applicationStages.userId, userId),
        eq(schema.applicationStages.key, key),
      ),
    )
    .limit(1);
  if (!stage) throw new Error(`Missing stage ${key}`);
  return stage.id;
}

async function makeApplication(
  userId: string,
  overrides: Partial<typeof schema.applications.$inferInsert> = {},
) {
  seq += 1;
  const vacancyId = overrides.vacancyId ?? (await makeVacancy(userId)).id;
  const currentStageId =
    overrides.currentStageId ?? (await getStageId(userId, "applied"));
  const [row] = await db
    .insert(schema.applications)
    .values({
      userId,
      code: `APP-${seq}`,
      vacancyId,
      currentStageId,
      submittedOn: "2026-01-02",
      ...overrides,
    })
    .returning();
  return row;
}

async function makeCompleteProfile(userId: string) {
  const [profile] = await db
    .insert(schema.careerProfiles)
    .values({
      userId,
      fullName: "Test User",
      headline: "Software Engineer",
      summary: "Experienced engineer",
      location: "Jakarta",
      targetPositions: ["Engineer"],
      preferredLocations: ["Jakarta"],
      expectedSalaryMin: 1_000,
    })
    .returning();
  await db.insert(schema.careerExperiences).values({
    userId,
    profileId: profile.id,
    companyName: "Acme",
    jobTitle: "Engineer",
    startDate: "2020-01-01",
  });
  for (let i = 0; i < 3; i += 1) {
    await db.insert(schema.careerSkills).values({
      userId,
      profileId: profile.id,
      skillName: `Skill ${i}`,
      normalizedName: `skill-${i}`,
      isUserVerified: true,
      verificationStatus: "verified",
    });
  }
  return profile;
}

async function makeCv(
  userId: string,
  options: { isSample?: boolean; storageKey?: string | null } = {},
) {
  const [document] = await db
    .insert(schema.documents)
    .values({
      userId,
      category: "master_cv",
      title: "Master CV",
      isSample: options.isSample ?? false,
    })
    .returning();
  const [version] = await db
    .insert(schema.documentVersions)
    .values({
      userId,
      documentId: document.id,
      versionNo: 1,
      label: "v1",
      storageKey:
        options.storageKey === undefined ? `${userId}/cv.pdf` : options.storageKey,
    })
    .returning();
  return { document, version };
}

function stageStatus(snapshot: Awaited<ReturnType<typeof detectProgress>>, key: string) {
  const stage = snapshot.stages.find((s) => s.key === key);
  if (!stage) throw new Error(`Missing stage ${key}`);
  return stage;
}

describe("progress detection (integration, in-memory PGlite)", () => {
  it("reports an empty account with no progress and no mutation of business records", async () => {
    const snapshot = await detectProgress(USER_B);

    expect(snapshot.overall.percentage).toBe(0);
    expect(snapshot.overall.completedCount).toBe(0);
    expect(snapshot.completedStages).toEqual([]);
    expect(snapshot.incompleteStages).toHaveLength(4);
    expect(snapshot.optionalStages).toHaveLength(4);
    expect(snapshot.overall.formula).toContain("completedStages");
    expect(new Date(snapshot.calculatedAt).toISOString()).toBe(snapshot.calculatedAt);

    const profiles = await db
      .select()
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, USER_B));
    expect(profiles).toHaveLength(0);
  });

  it("leaves an incomplete profile incomplete", async () => {
    await db.insert(schema.careerProfiles).values({
      userId: USER_A,
      fullName: "Only Name",
    });

    const snapshot = await detectProgress(USER_A);
    expect(stageStatus(snapshot, "career_profile").isComplete).toBe(false);
    expect(stageStatus(snapshot, "career_profile").evidence.recordIds).toHaveLength(1);
  });

  it("completes the career profile stage via the existing isReadyForAi rule", async () => {
    const profile = await makeCompleteProfile(USER_A);

    const snapshot = await detectProgress(USER_A);
    const stage = stageStatus(snapshot, "career_profile");
    expect(stage.isComplete).toBe(true);
    expect(stage.evidence.recordIds).toContain(profile.id);
    expect(snapshot.overall.percentage).toBe(25);
  });

  it("completes CV upload when a valid stored CV exists", async () => {
    const { version } = await makeCv(USER_A);

    const snapshot = await detectProgress(USER_A);
    const stage = stageStatus(snapshot, "cv_upload");
    expect(stage.isComplete).toBe(true);
    expect(stage.evidence.recordIds).toContain(`cv_version:${version.id}`);
  });

  it("does not complete CV upload for a deleted or file-less CV", async () => {
    const { version } = await makeCv(USER_A, { storageKey: null });
    expect(stageStatus(await detectProgress(USER_A), "cv_upload").isComplete).toBe(false);

    await db
      .update(schema.documentVersions)
      .set({ storageKey: "user_a/cv.pdf" })
      .where(eq(schema.documentVersions.id, version.id));
    expect(stageStatus(await detectProgress(USER_A), "cv_upload").isComplete).toBe(true);

    await db
      .delete(schema.documentVersions)
      .where(eq(schema.documentVersions.id, version.id));
    expect(stageStatus(await detectProgress(USER_A), "cv_upload").isComplete).toBe(false);
  });

  it("completes job discovery for saved vacancies but not sample vacancies", async () => {
    await makeVacancy(USER_A, { isSample: true });
    expect(stageStatus(await detectProgress(USER_A), "job_discovery").isComplete).toBe(false);

    const vacancy = await makeVacancy(USER_A);
    const snapshot = await detectProgress(USER_A);
    expect(stageStatus(snapshot, "job_discovery").isComplete).toBe(true);
    expect(stageStatus(snapshot, "job_discovery").evidence.recordIds).toContain(
      `vacancy:${vacancy.id}`,
    );
  });

  it("completes suitability evaluation only for scored evaluations on real vacancies", async () => {
    const vacancy = await makeVacancy(USER_A);
    await db.insert(schema.suitabilityEvaluations).values({
      userId: USER_A,
      vacancyId: vacancy.id,
      weights: DEFAULT_WEIGHTS,
      overallScore: null,
    });
    expect(
      stageStatus(await detectProgress(USER_A), "suitability_evaluation").isComplete,
    ).toBe(false);

    await db
      .update(schema.suitabilityEvaluations)
      .set({ overallScore: 80 })
      .where(eq(schema.suitabilityEvaluations.vacancyId, vacancy.id));
    expect(
      stageStatus(await detectProgress(USER_A), "suitability_evaluation").isComplete,
    ).toBe(true);
  });

  it("completes shortlist for shortlisted or interested vacancies only", async () => {
    await makeVacancy(USER_A, { triageStatus: "new" });
    expect(stageStatus(await detectProgress(USER_A), "shortlist").isComplete).toBe(false);

    await makeVacancy(USER_A, { triageStatus: "shortlisted" });
    expect(stageStatus(await detectProgress(USER_A), "shortlist").isComplete).toBe(true);
  });

  it("completes job application for real applications", async () => {
    const application = await makeApplication(USER_A);
    const snapshot = await detectProgress(USER_A);
    expect(stageStatus(snapshot, "job_application").isComplete).toBe(true);
    expect(stageStatus(snapshot, "job_application").evidence.recordIds).toContain(
      `application:${application.id}`,
    );
  });

  it("does not treat the initial submission history as tracking activity", async () => {
    const application = await makeApplication(USER_A);
    const appliedStageId = await getStageId(USER_A, "applied");
    await db.insert(schema.applicationStatusHistory).values({
      userId: USER_A,
      applicationId: application.id,
      toStageId: appliedStageId,
      effectiveOn: "2026-01-02",
      source: "submission",
    });

    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(false);
  });

  it("counts a stage transition beyond submission as tracking activity", async () => {
    const application = await makeApplication(USER_A);
    const screeningStageId = await getStageId(USER_A, "cv_screening");
    await db.insert(schema.applicationStatusHistory).values({
      userId: USER_A,
      applicationId: application.id,
      toStageId: screeningStageId,
      effectiveOn: "2026-01-05",
      source: "kanban",
    });

    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(true);
  });

  it("counts interviews, assessments, done follow-ups, and recruitment emails as tracking", async () => {
    const application = await makeApplication(USER_A);

    await db.insert(schema.interviews).values({
      userId: USER_A,
      applicationId: application.id,
      startsAt: new Date("2026-02-01T09:00:00.000Z"),
    });
    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(true);

    await db.delete(schema.interviews);
    await db.insert(schema.assessments).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Technical test",
    });
    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(true);

    await db.delete(schema.assessments);
    await db.insert(schema.followUpTasks).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Follow up",
      dueOn: "2026-02-10",
      status: "done",
    });
    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(true);

    await db.delete(schema.followUpTasks);
    await db.insert(schema.emailCommunications).values({
      userId: USER_A,
      applicationId: application.id,
      subject: "Interview invitation",
      occurredAt: new Date("2026-02-01T08:00:00.000Z"),
      classification: "interview_invitation",
    });
    expect(
      stageStatus(await detectProgress(USER_A), "recruitment_tracking").isComplete,
    ).toBe(true);
  });

  it("completes offers and outcomes for a recorded offer", async () => {
    const application = await makeApplication(USER_A);
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: "2026-03-01",
      decision: "pending",
    });

    expect(
      stageStatus(await detectProgress(USER_A), "offers_outcomes").isComplete,
    ).toBe(true);
  });

  it("completes offers and outcomes for a closed application", async () => {
    await makeApplication(USER_A, {
      outcome: "unsuccessful",
      closedAt: "2026-03-02",
    });

    expect(
      stageStatus(await detectProgress(USER_A), "offers_outcomes").isComplete,
    ).toBe(true);
  });

  it("handles archived records and excludes restored archives", async () => {
    const vacancy = await makeVacancy(USER_A);
    const application = await makeApplication(USER_A, { vacancyId: vacancy.id });
    const [closure] = await db
      .insert(schema.applicationClosureRecords)
      .values({
        userId: USER_A,
        applicationId: application.id,
        vacancyId: vacancy.id,
        closureOutcome: "rejected",
        closureSource: "manual_archive",
        status: "archived",
        closedOn: "2026-03-03",
      })
      .returning();

    expect(
      stageStatus(await detectProgress(USER_A), "offers_outcomes").isComplete,
    ).toBe(true);

    await db
      .update(schema.applicationClosureRecords)
      .set({ status: "restored" })
      .where(eq(schema.applicationClosureRecords.id, closure.id));
    expect(
      stageStatus(await detectProgress(USER_A), "offers_outcomes").isComplete,
    ).toBe(false);
  });

  it("isolates users and never exposes another user's record IDs", async () => {
    const vacancy = await makeVacancy(USER_A);
    const application = await makeApplication(USER_A, { vacancyId: vacancy.id });
    await makeCompleteProfile(USER_A);
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: "2026-03-01",
    });

    const a = await detectProgress(USER_A);
    const b = await detectProgress(USER_B);

    expect(a.completedStages.length).toBeGreaterThan(0);
    expect(b.overall.percentage).toBe(0);
    const allEvidenceIds = b.stages.flatMap((s) => s.evidence.recordIds);
    expect(allEvidenceIds).not.toContain(`vacancy:${vacancy.id}`);
    expect(allEvidenceIds).not.toContain(`application:${application.id}`);
    expect(allEvidenceIds).toHaveLength(0);
  });

  it("excludes all sample records from progress", async () => {
    await db.insert(schema.careerProfiles).values({
      userId: USER_A,
      fullName: "Test User",
    });
    const sampleVacancy = await makeVacancy(USER_A, {
      isSample: true,
      triageStatus: "shortlisted",
    });
    const application = await makeApplication(USER_A, {
      isSample: true,
      vacancyId: sampleVacancy.id,
    });
    await makeCv(USER_A, { isSample: true });
    await db.insert(schema.interviews).values({
      userId: USER_A,
      applicationId: application.id,
      startsAt: new Date("2026-02-01T09:00:00.000Z"),
      isSample: true,
    });
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: "2026-03-01",
    });

    const snapshot = await detectProgress(USER_A);
    expect(stageStatus(snapshot, "job_discovery").isComplete).toBe(false);
    expect(stageStatus(snapshot, "shortlist").isComplete).toBe(false);
    expect(stageStatus(snapshot, "job_application").isComplete).toBe(false);
    expect(stageStatus(snapshot, "cv_upload").isComplete).toBe(false);
    // Offers have no isSample column; they are validated through the parent application.
    expect(stageStatus(snapshot, "offers_outcomes").isComplete).toBe(false);
  });
});
