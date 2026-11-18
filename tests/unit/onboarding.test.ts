import { describe, expect, it } from "vitest";
import {
  completeTutorial,
  completeTutorialSection,
  createInitialOnboardingState,
  DEFAULT_ONBOARDING_STATE,
  dismissOnboardingReminder,
  dismissedReminderSchema,
  isOnboardingOutdated,
  markWelcomeViewed,
  ONBOARDING_VERSION,
  onboardingStateSchema,
  onboardingVersionSchema,
  restartTutorial,
  resumeGuidedSetup,
  setOnboardingVersion,
  setTutorialPosition,
  skipTutorialSection,
  startGuidedSetup,
  TUTORIAL_SECTIONS,
  tutorialSectionSchema,
} from "@/lib/domain/onboarding";

const NOW = "2026-11-18T03:00:00.000Z";

describe("onboarding domain model", () => {
  it("persists only the documented preference fields", () => {
    expect(Object.keys(DEFAULT_ONBOARDING_STATE).sort()).toEqual(
      [
        "version",
        "mode",
        "welcomeViewed",
        "guidedSetupStarted",
        "currentPosition",
        "completedSections",
        "skippedSections",
        "dismissedReminders",
        "lastActivityAt",
        "completedAt",
      ].sort(),
    );
    expect(onboardingStateSchema.safeParse(DEFAULT_ONBOARDING_STATE).success).toBe(
      true,
    );
  });

  it("creates an initial state with an activity timestamp", () => {
    const state = createInitialOnboardingState(NOW);
    expect(state.lastActivityAt).toBe(NOW);
    expect(state.mode).toBe("self_paced");
    expect(state.guidedSetupStarted).toBe(false);
    expect(state.version).toBe(ONBOARDING_VERSION);
  });

  it("validates all inputs", () => {
    expect(tutorialSectionSchema.safeParse("career_profile").success).toBe(true);
    expect(tutorialSectionSchema.safeParse("unknown_section").success).toBe(false);
    expect(dismissedReminderSchema.safeParse("   ").success).toBe(false);
    expect(dismissedReminderSchema.safeParse("reminder:cv").success).toBe(true);
    expect(onboardingVersionSchema.safeParse(0).success).toBe(false);
    expect(onboardingVersionSchema.safeParse(2).success).toBe(true);
  });

  it("detects outdated onboarding versions", () => {
    expect(isOnboardingOutdated(DEFAULT_ONBOARDING_STATE)).toBe(false);
    expect(
      isOnboardingOutdated({ ...DEFAULT_ONBOARDING_STATE, version: 0 }),
    ).toBe(true);
  });
});

describe("tutorial state transitions", () => {
  it("marks the welcome screen viewed", () => {
    const state = markWelcomeViewed(DEFAULT_ONBOARDING_STATE, NOW);
    expect(state.welcomeViewed).toBe(true);
    expect(state.lastActivityAt).toBe(NOW);
  });

  it("starts guided setup at the first section", () => {
    const state = startGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW);
    expect(state.mode).toBe("guided");
    expect(state.guidedSetupStarted).toBe(true);
    expect(state.currentPosition).toBe(TUTORIAL_SECTIONS[0]);
  });

  it("updates the current position", () => {
    const state = setTutorialPosition(
      startGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW),
      "cv_upload",
      NOW,
    );
    expect(state.currentPosition).toBe("cv_upload");
  });

  it("skips a section and advances to the next unfinished one", () => {
    let state = startGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW);
    state = skipTutorialSection(state, "career_profile", NOW);
    expect(state.skippedSections).toContain("career_profile");
    expect(state.currentPosition).toBe("cv_upload");
    expect(state.completedSections).not.toContain("career_profile");
  });

  it("completes a section and removes it from skipped sections", () => {
    let state = skipTutorialSection(
      startGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW),
      "career_profile",
      NOW,
    );
    state = completeTutorialSection(state, "career_profile", NOW);
    expect(state.completedSections).toContain("career_profile");
    expect(state.skippedSections).not.toContain("career_profile");
    expect(state.currentPosition).toBe("cv_upload");
  });

  it("resumes from the saved position or starts when not started", () => {
    const paused = setTutorialPosition(
      startGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW),
      "shortlist",
      NOW,
    );
    expect(resumeGuidedSetup(paused, NOW).currentPosition).toBe("shortlist");
    expect(resumeGuidedSetup(DEFAULT_ONBOARDING_STATE, NOW).guidedSetupStarted).toBe(
      true,
    );
  });

  it("dismisses reminders without duplicates", () => {
    let state = dismissOnboardingReminder(DEFAULT_ONBOARDING_STATE, "tip:cv", NOW);
    state = dismissOnboardingReminder(state, "tip:cv", NOW);
    expect(state.dismissedReminders).toEqual(["tip:cv"]);
  });

  it("marks the whole tutorial complete", () => {
    const state = completeTutorial(DEFAULT_ONBOARDING_STATE, NOW);
    expect(state.completedSections).toEqual([...TUTORIAL_SECTIONS]);
    expect(state.skippedSections).toEqual([]);
    expect(state.currentPosition).toBeNull();
    expect(state.completedAt).toBe(NOW);
  });

  it("restarts only tutorial state and keeps UX preferences", () => {
    const state = completeTutorial(
      setTutorialPosition(
        startGuidedSetup(markWelcomeViewed(DEFAULT_ONBOARDING_STATE, NOW), NOW),
        "shortlist",
        NOW,
      ),
      NOW,
    );
    const withReminder = dismissOnboardingReminder(state, "tip:cv", NOW);
    const restarted = restartTutorial(withReminder, NOW);

    expect(restarted.completedSections).toEqual([]);
    expect(restarted.skippedSections).toEqual([]);
    expect(restarted.completedAt).toBeNull();
    expect(restarted.currentPosition).toBe(TUTORIAL_SECTIONS[0]);
    expect(restarted.dismissedReminders).toEqual(["tip:cv"]);
    expect(restarted.welcomeViewed).toBe(true);
    expect(onboardingStateSchema.safeParse(restarted).success).toBe(true);
  });

  it("updates the onboarding version", () => {
    const state = setOnboardingVersion(DEFAULT_ONBOARDING_STATE, 2, NOW);
    expect(state.version).toBe(2);
    expect(isOnboardingOutdated(state)).toBe(true);
  });

  it("is deterministic", () => {
    expect(skipTutorialSection(DEFAULT_ONBOARDING_STATE, "cv_upload", NOW)).toEqual(
      skipTutorialSection(DEFAULT_ONBOARDING_STATE, "cv_upload", NOW),
    );
  });
});
