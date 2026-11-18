import { eq } from "drizzle-orm";
import type { z } from "zod";
import { ensureDbReady } from "@/db";
import { userSettings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { nextSetupSection } from "@/lib/domain/guided-setup";
import {
  completeTutorial as completeTutorialState,
  completeTutorialSection as completeTutorialSectionState,
  createInitialOnboardingState,
  dismissOnboardingReminder as dismissOnboardingReminderState,
  dismissedReminderSchema,
  isOnboardingOutdated,
  markWelcomeViewed as markWelcomeViewedState,
  ONBOARDING_VERSION,
  onboardingVersionSchema,
  restartTutorial as restartTutorialState,
  resumeGuidedSetup as resumeGuidedSetupState,
  setOnboardingVersion as setOnboardingVersionState,
  setTutorialPosition as setTutorialPositionState,
  skipTutorialSection as skipTutorialSectionState,
  startGuidedSetup as startGuidedSetupState,
  tutorialSectionSchema,
  type OnboardingState,
} from "@/lib/domain/onboarding";
import {
  productTourStatusSchema,
  productTourStepIdSchema,
  setProductTourStep,
} from "@/lib/domain/product-tour";
import { getOnboardingState } from "@/server/queries/onboarding";

export interface OnboardingPreferencesResult {
  state: OnboardingState;
  currentVersion: number;
  isOutdated: boolean;
}

type StateUpdate = (
  state: OnboardingState,
  now: string,
) => OnboardingState | null;

/** Persist a preference change, always scoped to the authenticated user. */
async function persistOnboardingState(
  userId: string,
  update: StateUpdate,
  summary: string,
  action: "create" | "update" = "update",
): Promise<OnboardingState> {
  const db = await ensureDbReady();
  const current = await getOnboardingState(userId);
  const next = update(current, new Date().toISOString());
  if (!next) return current;

  await db
    .update(userSettings)
    .set({ onboardingState: next, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));

  await writeAudit(db, {
    userId,
    entityType: "user_onboarding",
    entityId: userId,
    action,
    summary,
  });
  return next;
}

function asResult(state: OnboardingState): OnboardingPreferencesResult {
  return {
    state,
    currentVersion: ONBOARDING_VERSION,
    isOutdated: isOnboardingOutdated(state),
  };
}

/** Idempotent: creates or normalises the user's onboarding preference state. */
export async function initializeOnboardingService(
  userId: string,
): Promise<OnboardingPreferencesResult> {
  const state = await persistOnboardingState(
    userId,
    (current, now) => (current.lastActivityAt ? null : createInitialOnboardingState(now)),
    "Initialized onboarding preferences",
    "create",
  );
  return asResult(state);
}

export async function getOnboardingPreferencesService(
  userId: string,
): Promise<OnboardingPreferencesResult> {
  return asResult(await getOnboardingState(userId));
}

export async function markWelcomeViewedService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    markWelcomeViewedState,
    "Marked onboarding welcome screen as viewed",
  );
}

export async function startGuidedSetupService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    startGuidedSetupState,
    "Started guided onboarding setup",
  );
}

export async function updateTutorialPositionService(
  userId: string,
  rawSection: z.input<typeof tutorialSectionSchema>,
): Promise<OnboardingState> {
  const section = tutorialSectionSchema.parse(rawSection);
  return persistOnboardingState(
    userId,
    (state, now) => setTutorialPositionState(state, section, now),
    `Moved onboarding tutorial position to ${section}`,
  );
}

export async function completeTutorialSectionService(
  userId: string,
  rawSection: z.input<typeof tutorialSectionSchema>,
): Promise<OnboardingState> {
  const section = tutorialSectionSchema.parse(rawSection);
  return persistOnboardingState(
    userId,
    (state, now) => completeTutorialSectionState(state, section, now),
    `Completed onboarding tutorial section ${section}`,
  );
}

/** Marks one tutorial section done and persists the next position. */
export async function advanceGuidedSetupService(
  userId: string,
  rawSection: z.input<typeof tutorialSectionSchema>,
): Promise<OnboardingState> {
  const section = tutorialSectionSchema.parse(rawSection);
  return persistOnboardingState(
    userId,
    (state, now) => {
      const completed = completeTutorialSectionState(state, section, now);
      const next = nextSetupSection(section, state);
      return next
        ? setTutorialPositionState(completed, next, now)
        : { ...completed, currentPosition: null, lastActivityAt: now };
    },
    `Advanced guided setup past ${section}`,
  );
}

export async function skipTutorialSectionService(
  userId: string,
  rawSection: z.input<typeof tutorialSectionSchema>,
): Promise<OnboardingState> {
  const section = tutorialSectionSchema.parse(rawSection);
  return persistOnboardingState(
    userId,
    (state, now) => skipTutorialSectionState(state, section, now),
    `Skipped onboarding tutorial section ${section}`,
  );
}

export async function resumeGuidedSetupService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    resumeGuidedSetupState,
    "Resumed guided onboarding setup",
  );
}

export async function dismissOnboardingReminderService(
  userId: string,
  rawReminderId: z.input<typeof dismissedReminderSchema>,
): Promise<OnboardingState> {
  const reminderId = dismissedReminderSchema.parse(rawReminderId);
  return persistOnboardingState(
    userId,
    (state, now) => dismissOnboardingReminderState(state, reminderId, now),
    `Dismissed onboarding reminder ${reminderId}`,
  );
}

export async function completeTutorialService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    completeTutorialState,
    "Completed onboarding tutorial",
  );
}

export async function restartTutorialService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    restartTutorialState,
    "Restarted onboarding tutorial",
  );
}

export async function dismissOnboardingRemindersService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(
    userId,
    (state, now) =>
      dismissOnboardingReminderState(state, "dashboard:getting_started", now),
    "Dismissed onboarding reminders",
  );
}

/** Clears tour keys and starts again from the first step. */
export async function restartProductTourService(
  userId: string,
): Promise<OnboardingState> {
  return persistOnboardingState(userId, (state, now) => {
    const cleared = setProductTourStep(state, "navigation", "cleared", now);
    return setProductTourStep(cleared, "navigation", "active", now);
  }, "Restarted product tour");
}

/** Persist interactive tour progress without changing workflow completion. */
export async function updateProductTourService(
  userId: string,
  rawStepId: z.input<typeof productTourStepIdSchema>,
  rawStatus: z.input<typeof productTourStatusSchema>,
): Promise<OnboardingState> {
  const stepId = productTourStepIdSchema.parse(rawStepId);
  const status = productTourStatusSchema.parse(rawStatus);
  return persistOnboardingState(
    userId,
    (state, now) => setProductTourStep(state, stepId, status, now),
    `Updated product tour step ${stepId} (${status})`,
  );
}

export async function setOnboardingVersionService(
  userId: string,
  rawVersion: z.input<typeof onboardingVersionSchema>,
): Promise<OnboardingPreferencesResult> {
  const version = onboardingVersionSchema.parse(rawVersion);
  const state = await persistOnboardingState(
    userId,
    (current, now) => setOnboardingVersionState(current, version, now),
    `Updated onboarding version to ${version}`,
  );
  return asResult(state);
}
