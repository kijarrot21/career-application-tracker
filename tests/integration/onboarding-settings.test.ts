import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  dismissOnboardingReminderService,
  dismissOnboardingRemindersService,
  getOnboardingPreferencesService,
  restartProductTourService,
  restartTutorialService,
  resumeGuidedSetupService,
  startGuidedSetupService,
} from "@/server/services/onboarding";
import { getProductTourState } from "@/lib/domain/product-tour";
import { detectProgress } from "@/server/services/progress";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

let db: AppDb;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  for (const [id, name, email] of [
    ["user_a", "Alice", "alice@example.com"],
    ["user_b", "Bob", "bob@example.com"],
  ] as const) {
    await createTestUser(db, { id, name, email });
  }
});

afterEach(async () => {
  await cleanup();
});

describe("onboarding settings services", () => {
  it("resumes guided setup for an existing user", async () => {
    await startGuidedSetupService("user_a");
    const state = await resumeGuidedSetupService("user_a");
    expect(state.mode).toBe("guided");
    expect(state.guidedSetupStarted).toBe(true);
  });

  it("restarts guided setup without touching business progress", async () => {
    await startGuidedSetupService("user_a");
    const before = await detectProgress("user_a");

    const restarted = await restartTutorialService("user_a");
    expect(restarted.completedSections).toEqual([]);
    expect(restarted.currentPosition).toBe("career_profile");

    const after = await detectProgress("user_a");
    expect(after.completedStages).toEqual(before.completedStages);
    expect(after.overall.percentage).toBe(before.overall.percentage);
  });

  it("restarts the product tour from the first step", async () => {
    await restartProductTourService("user_a");
    const state = (await getOnboardingPreferencesService("user_a")).state;
    expect(getProductTourState(state).activeStepId).toBe("navigation");
  });

  it("dismisses onboarding reminders while keeping recommendations available", async () => {
    await dismissOnboardingRemindersService("user_a");
    const state = (await getOnboardingPreferencesService("user_a")).state;
    expect(state.dismissedReminders).toContain("dashboard:getting_started");

    const insights = await detectProgress("user_a");
    expect(insights.overall.percentage).toBe(0);
    await dismissOnboardingReminderService("user_a", "dashboard:getting_started");
  });

  it("isolates onboarding settings between users", async () => {
    await startGuidedSetupService("user_a");
    await restartTutorialService("user_a");
    const b = await getOnboardingPreferencesService("user_b");
    expect(b.state.completedSections).toEqual([]);
    expect(b.state.guidedSetupStarted).toBe(false);
  });
});
