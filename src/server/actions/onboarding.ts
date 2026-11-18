"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
  dismissedReminderSchema,
  onboardingVersionSchema,
  tutorialSectionSchema,
} from "@/lib/domain/onboarding";
import {
  productTourStatusSchema,
  productTourStepIdSchema,
} from "@/lib/domain/product-tour";
import { requireUser } from "@/lib/session";
import {
  advanceGuidedSetupService,
  completeTutorialService,
  dismissOnboardingRemindersService,
  dismissOnboardingReminderService,
  getOnboardingPreferencesService,
  initializeOnboardingService,
  markWelcomeViewedService,
  restartProductTourService,
  restartTutorialService,
  resumeGuidedSetupService,
  setOnboardingVersionService,
  skipTutorialSectionService,
  startGuidedSetupService,
  updateProductTourService,
  updateTutorialPositionService,
} from "@/server/services/onboarding";

function revalidateOnboarding() {
  revalidatePath("/dashboard");
}

export async function initializeOnboardingAction() {
  const user = await requireUser();
  const result = await initializeOnboardingService(user.id);
  revalidateOnboarding();
  return result;
}

export async function getOnboardingPreferencesAction() {
  const user = await requireUser();
  return getOnboardingPreferencesService(user.id);
}

export async function markWelcomeViewedAction() {
  const user = await requireUser();
  const state = await markWelcomeViewedService(user.id);
  revalidateOnboarding();
  return state;
}

export async function startGuidedSetupAction() {
  const user = await requireUser();
  const state = await startGuidedSetupService(user.id);
  revalidateOnboarding();
  return state;
}

export async function updateTutorialPositionAction(
  section: z.input<typeof tutorialSectionSchema>,
) {
  const user = await requireUser();
  const state = await updateTutorialPositionService(user.id, section);
  revalidateOnboarding();
  return state;
}

export async function advanceGuidedSetupAction(
  section: z.input<typeof tutorialSectionSchema>,
) {
  const user = await requireUser();
  const state = await advanceGuidedSetupService(user.id, section);
  revalidateOnboarding();
  return state;
}

export async function skipTutorialSectionAction(
  section: z.input<typeof tutorialSectionSchema>,
) {
  const user = await requireUser();
  const state = await skipTutorialSectionService(user.id, section);
  revalidateOnboarding();
  return state;
}

export async function resumeGuidedSetupAction() {
  const user = await requireUser();
  const state = await resumeGuidedSetupService(user.id);
  revalidateOnboarding();
  return state;
}

export async function dismissOnboardingReminderAction(
  reminderId: z.input<typeof dismissedReminderSchema>,
) {
  const user = await requireUser();
  const state = await dismissOnboardingReminderService(user.id, reminderId);
  revalidateOnboarding();
  return state;
}

export async function completeTutorialAction() {
  const user = await requireUser();
  const state = await completeTutorialService(user.id);
  revalidateOnboarding();
  return state;
}

export async function restartTutorialAction() {
  const user = await requireUser();
  const state = await restartTutorialService(user.id);
  revalidateOnboarding();
  return state;
}

export async function dismissOnboardingRemindersAction() {
  const user = await requireUser();
  const state = await dismissOnboardingRemindersService(user.id);
  revalidateOnboarding();
  return state;
}

export async function restartProductTourAction() {
  const user = await requireUser();
  const state = await restartProductTourService(user.id);
  revalidateOnboarding();
  return state;
}

export async function updateProductTourAction(
  stepId: z.input<typeof productTourStepIdSchema>,
  status: z.input<typeof productTourStatusSchema>,
) {
  const user = await requireUser();
  const state = await updateProductTourService(user.id, stepId, status);
  revalidateOnboarding();
  return state;
}

export async function setOnboardingVersionAction(
  version: z.input<typeof onboardingVersionSchema>,
) {
  const user = await requireUser();
  const result = await setOnboardingVersionService(user.id, version);
  revalidateOnboarding();
  return result;
}
