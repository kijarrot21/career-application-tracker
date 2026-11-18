import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { DEFAULT_WEIGHTS } from "@/lib/domain/suitability";
import { getWorkflowPlan } from "@/server/services/workflow";
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
  for (const [id, name, email] of [
    [USER_A, "Alice", "alice@example.com"],
    [USER_B, "Bob", "bob@example.com"],
  ] as const) {
    await createTestUser(db, { id, name, email });
  }
});

afterEach(async () => {
  await cleanup();
});

async function makeVacancy(
  userId: string,
  overrides: Partial<typeof schema.jobVacancies.$inferInsert> = {},
) {
  seq += 1;
  const [company] = await db
    .insert(schema.companies)
    .values({
      userId,
      name: `Acme ${seq}`,
      normalizedName: `acme-${seq}`,
    })
    .returning();
  const [vacancy] = await db
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
  return vacancy;
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
  const [application] = await db
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
  return application;
}

async function makeCompleteProfile(userId: string) {
  const [profile] = await db
    .insert(schema.careerProfiles)
    .values({
      userId,
      fullName: "Test User",
      headline: "Engineer",
      summary: "Summary",
      location: "Jakarta",
      targetPositions: ["Engineer"],
      preferredLocations: ["Jakarta"],
      expectedSalaryMin: 1000,
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
}

async function makeCv(userId: string) {
  const [document] = await db
    .insert(schema.documents)
    .values({ userId, category: "master_cv", title: "CV" })
    .returning();
  const [version] = await db
    .insert(schema.documentVersions)
    .values({
      userId,
      documentId: document.id,
      versionNo: 1,
      label: "v1",
      storageKey: `${userId}/cv.pdf`,
    })
    .returning();
  return version;
}

async function makeTrackingActivity(userId: string, applicationId: string) {
  await db.insert(schema.applicationStatusHistory).values({
    userId,
    applicationId,
    toStageId: await getStageId(userId, "cv_screening"),
    effectiveOn: "2026-01-05",
    source: "kanban",
  });
}

describe("workflow rules engine (integration, in-memory PGlite)", () => {
  it("recommends the first advisory step on a new account", async () => {
    const plan = await getWorkflowPlan(USER_A);

    expect(plan.recommendedNextStages).toEqual(["career_profile"]);
    expect(plan.blockedActions.map((a) => a.id).sort()).toEqual(
      [
        "add_assessment",
        "close_application",
        "evaluate_job",
        "record_offer",
        "schedule_interview",
        "shortlist_vacancy",
      ].sort(),
    );
    expect(plan.availableActions.length).toBeGreaterThan(0);
    expect(plan.unavailableStages).toEqual([]);
  });

  it("has no recommendations or blocked actions for a fully populated user", async () => {
    await makeCompleteProfile(USER_A);
    await makeCv(USER_A);
    const vacancy = await makeVacancy(USER_A, { triageStatus: "shortlisted" });
    await db.insert(schema.suitabilityEvaluations).values({
      userId: USER_A,
      vacancyId: vacancy.id,
      weights: DEFAULT_WEIGHTS,
      overallScore: 85,
    });
    const application = await makeApplication(USER_A, { vacancyId: vacancy.id });
    await makeTrackingActivity(USER_A, application.id);
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: "2026-03-01",
    });

    const plan = await getWorkflowPlan(USER_A);
    expect(plan.progress.overall.percentage).toBe(100);
    expect(plan.recommendedNextStages).toEqual([]);
    expect(plan.blockedActions).toEqual([]);
    expect(plan.availableActions).toHaveLength(12);
  });

  it("handles an existing user with applications but no onboarding history", async () => {
    const application = await makeApplication(USER_A);

    const plan = await getWorkflowPlan(USER_A);
    expect(plan.progress.completedStages).toContain("job_application");
    expect(plan.recommendedNextStages).toContain("career_profile");
    expect(plan.recommendedNextStages).toContain("recruitment_tracking");
    expect(plan.blockedActions).toEqual([]);
    expect(
      plan.availableActions.some((action) => action.id === "schedule_interview"),
    ).toBe(true);
    expect(application.id).toBeTruthy();
  });

  it("supports skipped evaluation and shortlist stages", async () => {
    await makeCompleteProfile(USER_A);
    await makeCv(USER_A);
    await makeVacancy(USER_A);
    await makeApplication(USER_A);

    const plan = await getWorkflowPlan(USER_A);
    expect(plan.recommendedNextStages).toEqual(["recruitment_tracking"]);
    expect(plan.blockedActions).toEqual([]);
    expect(plan.availableActions).toHaveLength(12);
  });

  it("keeps independent modules accessible on an empty account", async () => {
    const plan = await getWorkflowPlan(USER_A);
    const availableIds = plan.availableActions.map((a) => a.id);

    expect(availableIds).toEqual(
      expect.arrayContaining([
        "edit_career_profile",
        "upload_cv",
        "add_vacancy",
        "record_application",
        "log_follow_up",
        "log_communication",
      ]),
    );
    expect(plan.optionalStages).toEqual([
      "suitability_evaluation",
      "shortlist",
      "recruitment_tracking",
      "offers_outcomes",
    ]);
  });

  it("does not block actions because optional stages are incomplete", async () => {
    await makeCompleteProfile(USER_A);
    await makeCv(USER_A);
    await makeVacancy(USER_A);
    await makeApplication(USER_A);

    const plan = await getWorkflowPlan(USER_A);
    expect(plan.blockedActions).toEqual([]);
    expect(plan.dependencyExplanations.some((e) => e.dependencyType === "optional_prerequisite" && e.isActive)).toBe(true);
  });

  it("recommends uploading a CV again after its only version is deleted", async () => {
    await makeCompleteProfile(USER_A);
    const version = await makeCv(USER_A);
    await makeVacancy(USER_A);
    await makeApplication(USER_A);

    const before = await getWorkflowPlan(USER_A);
    expect(before.recommendedNextStages).not.toContain("cv_upload");

    await db
      .delete(schema.documentVersions)
      .where(eq(schema.documentVersions.id, version.id));
    const after = await getWorkflowPlan(USER_A);
    expect(after.recommendedNextStages).toContain("cv_upload");
  });

  it("does not re-recommend archived outcomes and reacts to a restored archive", async () => {
    await makeCompleteProfile(USER_A);
    await makeCv(USER_A);
    const vacancy = await makeVacancy(USER_A);
    const application = await makeApplication(USER_A, { vacancyId: vacancy.id });
    await makeTrackingActivity(USER_A, application.id);
    const [closure] = await db
      .insert(schema.applicationClosureRecords)
      .values({
        userId: USER_A,
        applicationId: application.id,
        vacancyId: vacancy.id,
        closureOutcome: "rejected",
        status: "archived",
        closedOn: "2026-03-03",
      })
      .returning();

    const archived = await getWorkflowPlan(USER_A);
    expect(archived.progress.completedStages).toContain("offers_outcomes");
    expect(archived.recommendedNextStages).not.toContain("offers_outcomes");

    await db
      .update(schema.applicationClosureRecords)
      .set({ status: "restored" })
      .where(eq(schema.applicationClosureRecords.id, closure.id));
    const restored = await getWorkflowPlan(USER_A);
    expect(restored.progress.completedStages).not.toContain("offers_outcomes");
    expect(restored.recommendedNextStages).toContain("offers_outcomes");
  });

  it("isolates plans between users", async () => {
    await makeCompleteProfile(USER_A);
    await makeCv(USER_A);
    await makeVacancy(USER_A);
    await makeApplication(USER_A);

    const a = await getWorkflowPlan(USER_A);
    const b = await getWorkflowPlan(USER_B);

    expect(a.recommendedNextStages).toEqual(["recruitment_tracking"]);
    expect(b.recommendedNextStages).toEqual(["career_profile"]);
    expect(b.progress.overall.percentage).toBe(0);
  });

  it("produces a stable, evaluable plan for every data state without circular errors", async () => {
    const empty = await getWorkflowPlan(USER_B);
    await makeCompleteProfile(USER_A);
    const populated = await getWorkflowPlan(USER_A);

    for (const plan of [empty, populated]) {
      expect(plan.dependencyExplanations.length).toBeGreaterThan(0);
      expect(new Set(plan.dependencyExplanations.map((e) => e.ruleId)).size).toBe(
        plan.dependencyExplanations.length,
      );
      expect(new Date(plan.evaluatedAt).toISOString()).toBe(plan.evaluatedAt);
    }
  });
});
