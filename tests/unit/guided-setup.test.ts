import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  WORKFLOW_STAGES,
  type ProgressSnapshot,
  type StageEvaluationInput,
  type WorkflowStageKey,
} from "@/lib/domain/progress";
import {
  GUIDED_SETUP_STEPS,
  getStepBusinessState,
  isStepRouteAvailable,
  nextSetupSection,
  resolveGuidedSetupStep,
} from "@/lib/domain/guided-setup";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@/lib/domain/onboarding";

function progressWith(complete: readonly WorkflowStageKey[] = []): ProgressSnapshot {
  const evaluations: StageEvaluationInput[] = WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    isApplicable: true,
    isComplete: complete.includes(stage.key),
    reason: "test",
    evidence: { recordIds: [], summary: "test" },
  }));
  return aggregateProgress(evaluations, "2026-11-18T00:00:00.000Z");
}

function onboardingWith(
  overrides: Partial<OnboardingState> = {},
): OnboardingState {
  return { ...DEFAULT_ONBOARDING_STATE, ...overrides };
}

function selectStep(
  complete: readonly WorkflowStageKey[] = [],
  onboarding: OnboardingState = DEFAULT_ONBOARDING_STATE,
  recommended: readonly WorkflowStageKey[] = [],
  availableRoutes?: readonly string[],
) {
  return resolveGuidedSetupStep({
    progress: progressWith(complete),
    recommendedNextStages: recommended,
    onboarding,
    ...(availableRoutes ? { availableRoutes } : {}),
  });
}

describe("guided setup step selection", () => {
  it("starts a new user at the first stage", () => {
    expect(selectStep()?.section).toBe("career_profile");
  });

  it("uses workflow recommendations before the static fallback order", () => {
    const step = selectStep(
      ["career_profile", "cv_upload", "job_discovery"],
      DEFAULT_ONBOARDING_STATE,
      ["shortlist"],
    );
    expect(step?.section).toBe("shortlist");
  });

  it("does not repeat a completed business stage", () => {
    const step = selectStep(["career_profile"]);
    expect(step?.section).not.toBe("career_profile");
    expect(getStepBusinessState(progressWith(["career_profile"]), "career_profile")).toBe(
      "complete",
    );
  });

  it("skips tutorial sections marked skipped", () => {
    const step = selectStep(
      [],
      onboardingWith({ skippedSections: ["career_profile", "cv_upload"] }),
    );
    expect(step?.section).toBe("job_discovery");
  });

  it("resumes from the saved position", () => {
    const step = selectStep(
      ["career_profile", "cv_upload"],
      onboardingWith({ currentPosition: "suitability_evaluation" }),
    );
    expect(step?.section).toBe("suitability_evaluation");
  });

  it("returns null when no tutorial step is pending", () => {
    const all = WORKFLOW_STAGES.map((stage) => stage.key);
    expect(selectStep(all)).toBeNull();
  });

  it("treats tutorial completion separately from business completion", () => {
    const onboarding = onboardingWith({
      completedSections: ["career_profile"],
      currentPosition: "career_profile",
    });
    expect(selectStep([], onboarding)?.section).toBe("cv_upload");
    expect(getStepBusinessState(progressWith(), "career_profile")).toBe(
      "incomplete",
    );
  });

  it("surfaces a step with an unavailable destination", () => {
    const step = selectStep(
      [],
      DEFAULT_ONBOARDING_STATE,
      [],
      ["/profile"],
    );
    expect(step?.targetRoute).toBe("/profile");
    expect(isStepRouteAvailable(step!, ["/jobs"])).toBe(false);
  });

  it("finds the next unfinished tutorial section", () => {
    expect(
      nextSetupSection("career_profile", onboardingWith({ skippedSections: ["cv_upload"] })),
    ).toBe("job_discovery");
  });

  it("defines a step for every workflow stage with a verified route", () => {
    expect(GUIDED_SETUP_STEPS).toHaveLength(8);
    for (const step of GUIDED_SETUP_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.expectedOutcome.length).toBeGreaterThan(0);
      expect(isStepRouteAvailable(step)).toBe(true);
    }
  });
});

describe("guided setup UI wiring", () => {
  const wizard = readFileSync(
    resolve(process.cwd(), "src/components/dashboard/guided-setup-wizard.tsx"),
    "utf8",
  );
  const guidance = readFileSync(
    resolve(process.cwd(), "src/components/dashboard/dashboard-guidance.tsx"),
    "utf8",
  );

  it("does not duplicate workflow or recommendation rules", () => {
    expect(wizard).not.toContain("computeNextBestActions");
    expect(wizard).not.toContain("detectProgress");
    expect(wizard).not.toContain("evaluateWorkflow");
  });

  it("offers continue, skip, exit, restart, and resume actions", () => {
    expect(wizard).toContain("Continue");
    expect(wizard).toContain("Skip tutorial section");
    expect(wizard).toContain("Resume later");
    expect(wizard).toContain("Exit");
    expect(wizard).toContain("Restart tutorial");
  });

  it("opens from the dashboard guidance widget", () => {
    expect(guidance).toContain("<GuidedSetupWizard");
    expect(guidance).toContain("handleResume");
  });
});
