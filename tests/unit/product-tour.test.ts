import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  onboardingStateSchema,
} from "@/lib/domain/onboarding";
import {
  findTourStep,
  getProductTourState,
  isTourRouteAvailable,
  nextTourStepId,
  PRODUCT_TOUR_STEPS,
  productTourStatusSchema,
  productTourStepIdSchema,
  setProductTourStep,
} from "@/lib/domain/product-tour";

const NOW = "2026-11-18T04:00:00.000Z";

describe("product tour steps", () => {
  it("defines real routes, selectors, and verified steps", () => {
    expect(PRODUCT_TOUR_STEPS.length).toBeGreaterThan(0);
    for (const step of PRODUCT_TOUR_STEPS) {
      expect(isTourRouteAvailable(step)).toBe(true);
      expect(step.selectors.length).toBeGreaterThan(0);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(findTourStep(step.id)).toBe(step);
    }
  });

  it("validates step IDs and statuses", () => {
    expect(productTourStepIdSchema.safeParse("navigation").success).toBe(true);
    expect(productTourStepIdSchema.safeParse("fake").success).toBe(false);
    expect(productTourStatusSchema.safeParse("active").success).toBe(true);
    expect(productTourStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("persists active, done, and skipped progress in onboarding preferences", () => {
    let state = setProductTourStep(
      DEFAULT_ONBOARDING_STATE,
      "navigation",
      "done",
      NOW,
    );
    state = setProductTourStep(state, "global_search", "active", NOW);
    state = setProductTourStep(state, "getting_started", "skipped", NOW);

    expect(onboardingStateSchema.safeParse(state).success).toBe(true);
    const tour = getProductTourState(state);
    expect(tour.completedStepIds).toEqual(["navigation"]);
    expect(tour.activeStepId).toBe("global_search");
    expect(tour.skippedStepIds).toEqual(["getting_started"]);
  });

  it("replaces prior tour keys for the same step", () => {
    let state = setProductTourStep(
      DEFAULT_ONBOARDING_STATE,
      "navigation",
      "active",
      NOW,
    );
    state = setProductTourStep(state, "navigation", "done", NOW);
    expect(getProductTourState(state).activeStepId).toBeNull();
    expect(getProductTourState(state).completedStepIds).toEqual(["navigation"]);
  });

  it("clears all tour keys without touching other preferences", () => {
    const withReminder = {
      ...DEFAULT_ONBOARDING_STATE,
      dismissedReminders: ["dashboard:getting_started"],
    };
    let state = setProductTourStep(withReminder, "navigation", "active", NOW);
    state = setProductTourStep(state, "navigation", "cleared", NOW);
    expect(state.dismissedReminders).toEqual(["dashboard:getting_started"]);
  });

  it("advances to the next unfinished step", () => {
    const state = setProductTourStep(
      DEFAULT_ONBOARDING_STATE,
      "navigation",
      "skipped",
      NOW,
    );
    expect(nextTourStepId("navigation", state)).toBe("global_search");
    expect(nextTourStepId("add_vacancy", state)).toBeNull();
  });
});

describe("product tour target wiring", () => {
  const read = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

  it("adds data-tour anchors only to existing elements", () => {
    const sources = [
      read("src/components/layout/app-shell.tsx"),
      read("src/components/layout/app-sidebar.tsx"),
      read("src/components/dashboard/dashboard-guidance.tsx"),
      read("src/components/jobs/jobs-list-client.tsx"),
    ].join("\n");

    for (const step of PRODUCT_TOUR_STEPS) {
      for (const selector of step.selectors) {
        const anchor = selector.match(/data-tour="([^"]+)"/)?.[1];
        expect(anchor).toBeTruthy();
        expect(sources).toContain(`data-tour="${anchor}"`);
      }
    }
  });

  it("provides accessible tour controls and no focus trap", () => {
    const source = read("src/components/layout/product-tour.tsx");
    expect(source).toContain('aria-modal="false"');
    expect(source).toContain('aria-labelledby="product-tour-title"');
    expect(source).toContain('aria-label="Exit product tour"');
    expect(source).toContain('aria-label="Product tour progress"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key === "ArrowRight"');
    expect(source).toContain('event.key === "ArrowLeft"');
    expect(source).toContain("restore?.focus()");
    expect(source).not.toContain("focusTrap");
  });

  it("supports missing targets and a settings-based entry point", () => {
    const tour = read("src/components/layout/product-tour.tsx");
    const settings = read("src/components/settings/onboarding-settings-card.tsx");
    expect(tour).toContain("MAX_TARGET_ATTEMPTS");
    expect(tour).toContain("This UI element is not available here");
    expect(tour).toContain("router.push(step.route)");
    expect(settings).toContain('new Event("product-tour:start")');
  });
});
