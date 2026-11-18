import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { DEFAULT_ONBOARDING_STATE } from "@/lib/domain/onboarding";
import { getProductTourState } from "@/lib/domain/product-tour";
import { detectProgress } from "@/server/services/progress";
import {
  getOnboardingPreferencesService,
  updateProductTourService,
} from "@/server/services/onboarding";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

let db: AppDb;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  await createTestUser(db, {
    id: "user_a",
    name: "Alice",
    email: "alice@example.com",
  });
});

afterEach(async () => {
  await cleanup();
});

describe("product tour persistence", () => {
  it("starts empty for a new user", async () => {
    const state = (await getOnboardingPreferencesService("user_a")).state;
    expect(state).toEqual(DEFAULT_ONBOARDING_STATE);
    expect(getProductTourState(state).activeStepId).toBeNull();
  });

  it("saves active, skipped, and done steps across reads", async () => {
    await updateProductTourService("user_a", "navigation", "active");
    await updateProductTourService("user_a", "global_search", "skipped");
    await updateProductTourService("user_a", "add_vacancy", "done");

    const state = (await getOnboardingPreferencesService("user_a")).state;
    const tour = getProductTourState(state);
    expect(tour.activeStepId).toBe("navigation");
    expect(tour.skippedStepIds).toContain("global_search");
    expect(tour.completedStepIds).toContain("add_vacancy");
  });

  it("resumes by replacing the active step", async () => {
    await updateProductTourService("user_a", "navigation", "active");
    await updateProductTourService("user_a", "navigation", "done");
    await updateProductTourService("user_a", "getting_started", "active");

    const tour = getProductTourState(
      (await getOnboardingPreferencesService("user_a")).state,
    );
    expect(tour.activeStepId).toBe("getting_started");
    expect(tour.completedStepIds).toContain("navigation");
  });

  it("clears only tour keys", async () => {
    await updateProductTourService("user_a", "navigation", "active");
    await updateProductTourService("user_a", "navigation", "cleared");
    const state = (await getOnboardingPreferencesService("user_a")).state;
    expect(state.dismissedReminders).toEqual([]);
  });

  it("rejects invalid step IDs and statuses", async () => {
    await expect(
      updateProductTourService("user_a", "fake" as never, "active"),
    ).rejects.toThrow();
    await expect(
      updateProductTourService("user_a", "navigation", "fake" as never),
    ).rejects.toThrow();
  });

  it("never changes actual business progress", async () => {
    const before = await detectProgress("user_a");
    await updateProductTourService("user_a", "navigation", "done");
    await updateProductTourService("user_a", "add_vacancy", "skipped");
    const after = await detectProgress("user_a");

    expect(after.completedStages).toEqual(before.completedStages);
    expect(after.overall.percentage).toBe(before.overall.percentage);
  });
});
