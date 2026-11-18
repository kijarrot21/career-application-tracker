import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { addCalendarDays, todayInTimeZone } from "@/lib/domain/business-days";
import { DEFAULT_WEIGHTS } from "@/lib/domain/suitability";
import { dismissOnboardingReminderService } from "@/server/services/onboarding";
import { getDashboardInsights } from "@/server/queries/dashboard-insights";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = "user_a";
const USER_B = "user_b";

let db: AppDb;
let cleanup: () => Promise<void>;
let today: string;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  today = todayInTimeZone("Asia/Jakarta");
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

async function makeVacancy(userId: string) {
  const [company] = await db
    .insert(schema.companies)
    .values({ userId, name: "Acme", normalizedName: "acme" })
    .returning();
  const [vacancy] = await db
    .insert(schema.jobVacancies)
    .values({
      userId,
      companyId: company.id,
      code: "JOB-0001",
      title: "Engineer",
      discoveredOn: today,
    })
    .returning();
  return vacancy;
}

async function getStageId(userId: string, key: string) {
  const [stage] = await db
    .select()
    .from(schema.applicationStages)
    .where(
      eq(schema.applicationStages.key, key),
    )
    .limit(1);
  if (!stage) throw new Error(`Missing ${key}`);
  return stage.id;
}

async function makeApplication(userId: string, vacancyId: string) {
  const [application] = await db
    .insert(schema.applications)
    .values({
      userId,
      code: "APP-0001",
      vacancyId,
      currentStageId: await getStageId(userId, "applied"),
      submittedOn: today,
    })
    .returning();
  return application;
}

async function completeProfile(userId: string) {
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

describe("dashboard insights composition", () => {
  it("returns progress, workflow, recommendations, and onboarding for an empty account", async () => {
    const insights = await getDashboardInsights(USER_A);

    expect(insights.progress.overall.percentage).toBe(0);
    expect(insights.workflow.recommendedNextStages).toEqual(["career_profile"]);
    expect(insights.actions.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(insights.actions.urgent).toEqual([]);
    expect(insights.onboarding.state.welcomeViewed).toBe(false);
  });

  it("reflects a populated account without inventing recommendations", async () => {
    await completeProfile(USER_A);
    const [document] = await db
      .insert(schema.documents)
      .values({ userId: USER_A, category: "master_cv", title: "CV" })
      .returning();
    const [cv] = await db
      .insert(schema.documentVersions)
      .values({
        userId: USER_A,
        documentId: document.id,
        versionNo: 1,
        label: "v1",
        storageKey: "user_a/cv.pdf",
      })
      .returning();
    const vacancy = await makeVacancy(USER_A);
    await db.insert(schema.suitabilityEvaluations).values({
      userId: USER_A,
      vacancyId: vacancy.id,
      weights: DEFAULT_WEIGHTS,
      overallScore: 80,
    });
    await db
      .update(schema.jobVacancies)
      .set({ triageStatus: "shortlisted" })
      .where(eq(schema.jobVacancies.id, vacancy.id));
    await db.insert(schema.applications).values({
      userId: USER_A,
      code: "APP-0001",
      vacancyId: vacancy.id,
      currentStageId: await getStageId(USER_A, "applied"),
      submittedOn: today,
      cvVersionId: cv.id,
    });

    const insights = await getDashboardInsights(USER_A);
    expect(insights.progress.completedStages).toContain("job_application");
    expect(insights.actions.primary).toBeNull();
  });

  it("surfaces urgent actions and secondary recommendations together", async () => {
    const vacancy = await makeVacancy(USER_A);
    const application = await makeApplication(USER_A, vacancy.id);
    await db.insert(schema.followUpTasks).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Overdue follow-up",
      dueOn: addCalendarDays(today, -2),
      status: "open",
    });

    const insights = await getDashboardInsights(USER_A);
    expect(insights.actions.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
    expect(insights.actions.urgent).toHaveLength(1);
    expect(insights.actions.secondary.length).toBeGreaterThan(0);
  });

  it("respects dismissed onboarding preferences", async () => {
    await dismissOnboardingReminderService(USER_A, "dashboard:getting_started");
    const insights = await getDashboardInsights(USER_A);
    expect(
      insights.onboarding.state.dismissedReminders,
    ).toContain("dashboard:getting_started");
  });

  it("recalculates after underlying records change", async () => {
    const vacancy = await makeVacancy(USER_A);
    const application = await makeApplication(USER_A, vacancy.id);
    const [task] = await db
      .insert(schema.followUpTasks)
      .values({
        userId: USER_A,
        applicationId: application.id,
        title: "Follow up",
        dueOn: addCalendarDays(today, -1),
        status: "open",
      })
      .returning();

    expect((await getDashboardInsights(USER_A)).actions.primary?.actionId).toBe(
      "P1-OVERDUE-FOLLOWUP",
    );

    await db
      .update(schema.followUpTasks)
      .set({ status: "done" })
      .where(eq(schema.followUpTasks.id, task.id));
    expect((await getDashboardInsights(USER_A)).actions.urgent).toEqual([]);
  });

  it("isolates dashboard insights between users", async () => {
    const vacancy = await makeVacancy(USER_A);
    await makeApplication(USER_A, vacancy.id);

    const a = await getDashboardInsights(USER_A);
    const b = await getDashboardInsights(USER_B);

    expect(a.progress.completedStages).toContain("job_application");
    expect(b.progress.overall.percentage).toBe(0);
    expect(b.actions.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
  });
});
