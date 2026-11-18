/**
 * Onboarding preferences domain model.
 *
 * This state stores UX preferences only. It never represents workflow
 * completion: actual progress is always derived by the Stage 1 Progress
 * Detection Service from business records.
 */

import { z } from "zod";

export const ONBOARDING_VERSION = 1;

export const ONBOARDING_MODES = ["guided", "self_paced"] as const;
export type OnboardingMode = (typeof ONBOARDING_MODES)[number];

export const TUTORIAL_SECTIONS = [
  "career_profile",
  "cv_upload",
  "job_discovery",
  "suitability_evaluation",
  "shortlist",
  "job_application",
  "recruitment_tracking",
  "offers_outcomes",
] as const;
export type TutorialSection = (typeof TUTORIAL_SECTIONS)[number];

export const onboardingModeSchema = z.enum([...ONBOARDING_MODES]);
export const tutorialSectionSchema = z.enum(
  [...TUTORIAL_SECTIONS] as [TutorialSection, ...TutorialSection[]],
);
export const onboardingVersionSchema = z.number().int().min(1).max(999);
export const dismissedReminderSchema = z.string().trim().min(1).max(120);

const isoInstantSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp");

export const onboardingStateSchema = z.object({
  version: onboardingVersionSchema,
  mode: onboardingModeSchema,
  welcomeViewed: z.boolean(),
  guidedSetupStarted: z.boolean(),
  currentPosition: tutorialSectionSchema.nullable(),
  completedSections: z.array(tutorialSectionSchema),
  skippedSections: z.array(tutorialSectionSchema),
  dismissedReminders: z.array(dismissedReminderSchema),
  lastActivityAt: isoInstantSchema.nullable(),
  completedAt: isoInstantSchema.nullable(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

/** Stable default used as the database column default for existing users. */
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  version: ONBOARDING_VERSION,
  mode: "self_paced",
  welcomeViewed: false,
  guidedSetupStarted: false,
  currentPosition: null,
  completedSections: [],
  skippedSections: [],
  dismissedReminders: [],
  lastActivityAt: null,
  completedAt: null,
};

export function createInitialOnboardingState(now: string): OnboardingState {
  return { ...DEFAULT_ONBOARDING_STATE, lastActivityAt: now };
}

export function isOnboardingOutdated(
  state: OnboardingState,
  currentVersion: number = ONBOARDING_VERSION,
): boolean {
  return state.version !== currentVersion;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function nextUnfinishedSection(
  state: OnboardingState,
  after: TutorialSection | null = null,
): TutorialSection | null {
  const done = new Set([...state.completedSections, ...state.skippedSections]);
  const sections = after
    ? TUTORIAL_SECTIONS.slice(TUTORIAL_SECTIONS.indexOf(after) + 1)
    : TUTORIAL_SECTIONS;
  return sections.find((section) => !done.has(section)) ?? null;
}

export function markWelcomeViewed(
  state: OnboardingState,
  now: string,
): OnboardingState {
  return { ...state, welcomeViewed: true, lastActivityAt: now };
}

export function startGuidedSetup(
  state: OnboardingState,
  now: string,
): OnboardingState {
  return {
    ...state,
    version: ONBOARDING_VERSION,
    mode: "guided",
    guidedSetupStarted: true,
    currentPosition: nextUnfinishedSection(state),
    lastActivityAt: now,
  };
}

export function setTutorialPosition(
  state: OnboardingState,
  section: TutorialSection,
  now: string,
): OnboardingState {
  return { ...state, currentPosition: section, lastActivityAt: now };
}

export function skipTutorialSection(
  state: OnboardingState,
  section: TutorialSection,
  now: string,
): OnboardingState {
  const nextState: OnboardingState = {
    ...state,
    skippedSections: unique([...state.skippedSections, section]),
    completedSections: state.completedSections.filter((s) => s !== section),
    lastActivityAt: now,
  };
  return {
    ...nextState,
    currentPosition: nextUnfinishedSection(nextState, section),
  };
}

export function completeTutorialSection(
  state: OnboardingState,
  section: TutorialSection,
  now: string,
): OnboardingState {
  const nextState: OnboardingState = {
    ...state,
    completedSections: unique([...state.completedSections, section]),
    skippedSections: state.skippedSections.filter((s) => s !== section),
    lastActivityAt: now,
  };
  return {
    ...nextState,
    currentPosition: nextUnfinishedSection(nextState, section),
  };
}

export function resumeGuidedSetup(
  state: OnboardingState,
  now: string,
): OnboardingState {
  if (!state.guidedSetupStarted) return startGuidedSetup(state, now);
  return {
    ...state,
    mode: "guided",
    currentPosition: state.currentPosition ?? nextUnfinishedSection(state),
    lastActivityAt: now,
  };
}

export function dismissOnboardingReminder(
  state: OnboardingState,
  reminderId: string,
  now: string,
): OnboardingState {
  const id = dismissedReminderSchema.parse(reminderId);
  return {
    ...state,
    dismissedReminders: unique([...state.dismissedReminders, id]),
    lastActivityAt: now,
  };
}

export function completeTutorial(
  state: OnboardingState,
  now: string,
): OnboardingState {
  return {
    ...state,
    mode: "guided",
    guidedSetupStarted: true,
    completedSections: [...TUTORIAL_SECTIONS],
    skippedSections: [],
    currentPosition: null,
    completedAt: now,
    lastActivityAt: now,
  };
}

/**
 * Restart only resets tutorial UX state. Dismissed reminders and any business
 * records are untouched by design.
 */
export function restartTutorial(
  state: OnboardingState,
  now: string,
): OnboardingState {
  return {
    ...state,
    version: ONBOARDING_VERSION,
    mode: "guided",
    guidedSetupStarted: true,
    currentPosition: TUTORIAL_SECTIONS[0],
    completedSections: [],
    skippedSections: [],
    completedAt: null,
    lastActivityAt: now,
  };
}

export function setOnboardingVersion(
  state: OnboardingState,
  version: number,
  now: string,
): OnboardingState {
  return {
    ...state,
    version: onboardingVersionSchema.parse(version),
    lastActivityAt: now,
  };
}
