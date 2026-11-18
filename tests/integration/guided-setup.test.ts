import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { resolveGuidedSetupStep } from "@/lib/domain/guided-setup";
import { getDashboardInsights } from "@/server/queries/dashboard-insights";
import {
  advanceGuidedSetupService,
  getOnboardingPreferencesService,
  restartTutorialService,
  skipTutorialSectionService,
  startGuidedSetupService,
  updateTutorialPositionService,
} from "@/server/services/onboarding";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = "user_a";
let db: AppDb;
let cleanup: () => Promise<void>;
let today: string;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  today = todayInTimeZone("Asia/Jakarta");
  await createTestUser(db, { id: USER_A, name: "Alice", email: "alice@example.com" });
});

afterEach(async () => {
  await cleanup();
});

async function currentSection() {
  const insights = await getDashboardInsights(USER_A);
  return resolveGuidedSetupStep({
    progress: insights.progress,
    recommendedNextStages: insights.workflow.recommendedNextStages,
    onboarding: insights.onboarding.state,
  })?.section;
}

describe("guided setup persistence (integration, in-memory PGlite)", () => {
  it("recommends the first step for a new user and persists advancement", async () => {
    expect(await currentSection()).toBe("career_profile");
    await startGuidedSetupService(USER_A);

    const advanced = await advanceGuidedSetupService(USER_A, "career_profile");
    expect(advanced.completedSections).toEqual(["career_profile"]);
    expect(advanced.currentPosition).toBe("cv_upload");
    expect(await currentSection()).toBe("cv_upload");
  });

  it("skips a section and moves past it", async () => {
    const skipped = await skipTutorialSectionService(USER_A, "cv_upload");
    expect(skipped.skippedSections).toContain("cv_upload");
    expect(skipped.currentPosition).toBe("job_discovery");
    expect((await getOnboardingPreferencesService(USER_A)).state.skippedSections).toContain(
      "cv_upload",
    );
  });

  it("resumes from a saved position", async () => {
    await startGuidedSetupService(USER_A);
    await updateTutorialPositionService(USER_A, "shortlist");
    expect(await currentSection()).toBe("shortlist");
  });

  it("changes the active step when actual progress changes", async () => {
    await startGuidedSetupService(USER_A);
    expect(await currentSection()).toBe("career_profile");

    const [profile] = await db
      .insert(schema.careerProfiles)
      .values({
        userId: USER_A,
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
      userId: USER_A,
      profileId: profile.id,
      companyName: "Acme",
      jobTitle: "Engineer",
      startDate: "2020-01-01",
    });
    for (let i = 0; i < 3; i += 1) {
      await db.insert(schema.careerSkills).values({
        userId: USER_A,
        profileId: profile.id,
        skillName: `Skill ${i}`,
        normalizedName: `skill-${i}`,
        isUserVerified: true,
        verificationStatus: "verified",
      });
    }

    const stage = await currentSection();
    expect(stage).not.toBe("career_profile");
  });

  it("restarts tutorial state without touching business records", async () => {
    const [company] = await db
      .insert(schema.companies)
      .values({ userId: USER_A, name: "Acme", normalizedName: "acme" })
      .returning();
    await db.insert(schema.jobVacancies).values({
      userId: USER_A,
      companyId: company.id,
      code: "JOB-0001",
      title: "Engineer",
      discoveredOn: today,
    });
    await advanceGuidedSetupService(USER_A, "career_profile");

    const restarted = await restartTutorialService(USER_A);
    expect(restarted.completedSections).toEqual([]);
    expect(restarted.currentPosition).toBe("career_profile");

    const vacancies = await db
      .select()
      .from(schema.jobVacancies)
      .where(eq(schema.jobVacancies.userId, USER_A));
    expect(vacancies).toHaveLength(1);
  });

  it("separates tutorial completion from business completion", async () => {
    await advanceGuidedSetupService(USER_A, "career_profile");
    const state = (await getOnboardingPreferencesService(USER_A)).state;
    const insights = await getDashboardInsights(USER_A);

    expect(state.completedSections).toContain("career_profile");
    expect(insights.progress.completedStages).not.toContain("career_profile");
  });
});
