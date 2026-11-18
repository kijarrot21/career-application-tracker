import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { ensureUserInitialized } from "@/db/seed/system";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_VERSION,
  onboardingStateSchema,
  TUTORIAL_SECTIONS,
  type TutorialSection,
} from "@/lib/domain/onboarding";
import { SYNC_ENTITY_TYPES } from "@/lib/domain/sync";
import { detectProgress } from "@/server/services/progress";
import {
  completeTutorialService,
  dismissOnboardingReminderService,
  getOnboardingPreferencesService,
  initializeOnboardingService,
  restartTutorialService,
  resumeGuidedSetupService,
  setOnboardingVersionService,
  skipTutorialSectionService,
  startGuidedSetupService,
  updateTutorialPositionService,
} from "@/server/services/onboarding";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = "user_a";
const USER_B = "user_b";

let db: AppDb;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
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

async function storedState(userId: string) {
  const [row] = await db
    .select({ state: schema.userSettings.onboardingState })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  return row?.state;
}

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
      discoveredOn: "2026-01-01",
    })
    .returning();
  return vacancy;
}

describe("onboarding preferences (integration, in-memory PGlite)", () => {
  it("initializes onboarding for a new user idempotently", async () => {
    const before = await getOnboardingPreferencesService(USER_A);
    expect(before.state).toEqual(DEFAULT_ONBOARDING_STATE);
    expect(before.isOutdated).toBe(false);

    const initialized = await initializeOnboardingService(USER_A);
    expect(initialized.state.lastActivityAt).not.toBeNull();
    const firstTimestamp = initialized.state.lastActivityAt;

    const again = await initializeOnboardingService(USER_A);
    expect(again.state.lastActivityAt).toBe(firstTimestamp);
  });

  it("persists state for an existing user across re-authentication", async () => {
    await startGuidedSetupService(USER_A);
    await skipTutorialSectionService(USER_A, "career_profile");
    const before = await getOnboardingPreferencesService(USER_A);

    // Re-running the sign-in initialiser must not overwrite saved preferences.
    await ensureUserInitialized(db, USER_A);
    const after = await getOnboardingPreferencesService(USER_A);

    expect(after.state).toEqual(before.state);
    expect(await storedState(USER_A)).toEqual(before.state);
  });

  it("resumes guided setup from the saved position", async () => {
    await startGuidedSetupService(USER_A);
    await updateTutorialPositionService(USER_A, "shortlist");
    const resumed = await resumeGuidedSetupService(USER_A);

    expect(resumed.mode).toBe("guided");
    expect(resumed.guidedSetupStarted).toBe(true);
    expect(resumed.currentPosition).toBe("shortlist");
  });

  it("skips sections without treating them as completed", async () => {
    const state = await skipTutorialSectionService(USER_A, "cv_upload");
    expect(state.skippedSections).toContain("cv_upload");
    expect(state.completedSections).not.toContain("cv_upload");
    expect(onboardingStateSchema.safeParse(state).success).toBe(true);
  });

  it("dismisses onboarding reminders", async () => {
    const state = await dismissOnboardingReminderService(USER_A, "tip:profile");
    expect(state.dismissedReminders).toEqual(["tip:profile"]);
    expect((await storedState(USER_A))?.dismissedReminders).toEqual(["tip:profile"]);
  });

  it("restarts the tutorial without resetting application data", async () => {
    const vacancy = await makeVacancy(USER_A);
    await completeTutorialService(USER_A);
    await dismissOnboardingReminderService(USER_A, "tip:profile");

    const restarted = await restartTutorialService(USER_A);
    expect(restarted.completedSections).toEqual([]);
    expect(restarted.skippedSections).toEqual([]);
    expect(restarted.currentPosition).toBe(TUTORIAL_SECTIONS[0]);
    expect(restarted.completedAt).toBeNull();
    expect(restarted.dismissedReminders).toEqual(["tip:profile"]);

    const vacancies = await db
      .select()
      .from(schema.jobVacancies)
      .where(eq(schema.jobVacancies.userId, USER_A));
    expect(vacancies).toHaveLength(1);
    expect(vacancies[0]?.id).toBe(vacancy.id);
  });

  it("updates the onboarding version and detects outdated versions", async () => {
    const updated = await setOnboardingVersionService(USER_A, 2);
    expect(updated.isOutdated).toBe(true);
    expect(updated.state.version).toBe(2);

    const current = await setOnboardingVersionService(USER_A, ONBOARDING_VERSION);
    expect(current.isOutdated).toBe(false);
  });

  it("validates all service inputs", async () => {
    await expect(
      skipTutorialSectionService(USER_A, "nope" as TutorialSection),
    ).rejects.toThrow();
    await expect(
      dismissOnboardingReminderService(USER_A, "   "),
    ).rejects.toThrow();
    await expect(setOnboardingVersionService(USER_A, 0)).rejects.toThrow();
  });

  it("isolates onboarding state between users", async () => {
    await startGuidedSetupService(USER_A);
    await skipTutorialSectionService(USER_A, "career_profile");

    const b = await getOnboardingPreferencesService(USER_B);
    expect(b.state).toEqual(DEFAULT_ONBOARDING_STATE);

    await restartTutorialService(USER_B);
    const a = await getOnboardingPreferencesService(USER_A);
    expect(a.state.skippedSections).toContain("career_profile");
    expect((await storedState(USER_B))?.skippedSections).toEqual([]);
  });

  it("never overrides actual business progress", async () => {
    await makeVacancy(USER_A);
    const before = await detectProgress(USER_A);
    expect(before.completedStages).toContain("job_discovery");

    await completeTutorialService(USER_A);
    await restartTutorialService(USER_A);
    const after = await detectProgress(USER_A);

    expect(after.completedStages).toEqual(before.completedStages);
    expect(after.overall.percentage).toBe(before.overall.percentage);
  });

  it("writes an audit entry for preference changes", async () => {
    await startGuidedSetupService(USER_A);
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.userId, USER_A));
    expect(
      logs.some(
        (log) =>
          log.entityType === "user_onboarding" && log.action === "update",
      ),
    ).toBe(true);
  });

  it("documents local/cloud support without claiming cross-device sync", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "src/db/migrations/0008_dapper_newton_destine.sql"),
      "utf8",
    );
    expect(migration).toContain('ADD COLUMN "onboarding_state" jsonb');
    expect(SYNC_ENTITY_TYPES).not.toContain("user_settings");
    expect(SYNC_ENTITY_TYPES).not.toContain("onboarding");
    expect(SYNC_ENTITY_TYPES).not.toContain("onboarding_state");
  });
});
