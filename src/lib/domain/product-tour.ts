/**
 * Interactive product tour definitions.
 *
 * Tour progress is stored in onboarding preferences as reminder-style keys.
 * It never represents workflow completion.
 */

import { z } from "zod";
import type { OnboardingState } from "./onboarding";
import { isRouteAvailable } from "./recommendations";

export const PRODUCT_TOUR_STEP_IDS = [
  "navigation",
  "global_search",
  "getting_started",
  "next_best_action",
  "add_vacancy",
] as const;
export type ProductTourStepId = (typeof PRODUCT_TOUR_STEP_IDS)[number];

export const PRODUCT_TOUR_STATUSES = [
  "active",
  "done",
  "skipped",
  "cleared",
] as const;
export type ProductTourStatus = (typeof PRODUCT_TOUR_STATUSES)[number];

export const productTourStepIdSchema = z.enum([...PRODUCT_TOUR_STEP_IDS]);
export const productTourStatusSchema = z.enum([...PRODUCT_TOUR_STATUSES]);

export interface ProductTourStep {
  id: ProductTourStepId;
  route: string;
  /** CSS selectors of real elements, tried in order. */
  selectors: readonly string[];
  title: string;
  description: string;
  requiresInteraction: boolean;
}

export const PRODUCT_TOUR_STEPS: readonly ProductTourStep[] = [
  {
    id: "navigation",
    route: "/dashboard",
    selectors: ['[data-tour="sidebar-nav"]', '[data-tour="mobile-nav"]'],
    title: "Navigate the workspace",
    description:
      "Pipeline and career asset modules live here. Each module stays independently accessible.",
    requiresInteraction: false,
  },
  {
    id: "global_search",
    route: "/dashboard",
    selectors: ['[data-tour="global-search"]'],
    title: "Find anything quickly",
    description: "Global search opens the command menu from any page.",
    requiresInteraction: true,
  },
  {
    id: "getting_started",
    route: "/dashboard",
    selectors: ['[data-tour="getting-started"]'],
    title: "Track real progress",
    description:
      "Getting Started is calculated from your records. Tutorial checkboxes never count as progress.",
    requiresInteraction: false,
  },
  {
    id: "next_best_action",
    route: "/dashboard",
    selectors: ['[data-tour="next-best-action"]'],
    title: "Act on the next best action",
    description:
      "Urgent deadlines rank above setup and workflow steps. Each action links to a verified route.",
    requiresInteraction: true,
  },
  {
    id: "add_vacancy",
    route: "/jobs",
    selectors: ['[data-tour="add-job"]'],
    title: "Save job opportunities",
    description:
      "Add a vacancy here to start evaluation, shortlisting, and application tracking.",
    requiresInteraction: true,
  },
];

const TOUR_KEY_PREFIX = "product_tour:";

export function tourStatusKey(
  stepId: ProductTourStepId,
  status: Exclude<ProductTourStatus, "cleared">,
): string {
  return `${TOUR_KEY_PREFIX}${status}:${stepId}`;
}

export function isTourKey(key: string): boolean {
  return key.startsWith(TOUR_KEY_PREFIX);
}

export function getProductTourState(state: OnboardingState): {
  activeStepId: ProductTourStepId | null;
  completedStepIds: ProductTourStepId[];
  skippedStepIds: ProductTourStepId[];
} {
  const keys = state.dismissedReminders.filter(isTourKey);
  const forStatus = (status: "active" | "done" | "skipped") =>
    PRODUCT_TOUR_STEP_IDS.filter((id) =>
      keys.includes(tourStatusKey(id, status)),
    );
  return {
    activeStepId: forStatus("active")[0] ?? null,
    completedStepIds: forStatus("done"),
    skippedStepIds: forStatus("skipped"),
  };
}

export function setProductTourStep(
  state: OnboardingState,
  stepId: ProductTourStepId,
  status: ProductTourStatus,
  now: string,
): OnboardingState {
  const preserved =
    status === "cleared"
      ? state.dismissedReminders.filter((key) => !isTourKey(key))
      : state.dismissedReminders.filter((key) => {
          if (!isTourKey(key)) return true;
          if (
            key.startsWith(`${TOUR_KEY_PREFIX}active:`) &&
            key.endsWith(`:${stepId}`)
          ) {
            return false;
          }
          return !key.endsWith(`:${stepId}`);
        });
  const nextKeys =
    status === "cleared"
      ? []
      : [tourStatusKey(stepId, status as Exclude<ProductTourStatus, "cleared">)];
  return {
    ...state,
    dismissedReminders: [...preserved, ...nextKeys],
    lastActivityAt: now,
  };
}

export function isTourRouteAvailable(step: ProductTourStep): boolean {
  return isRouteAvailable(step.route);
}

export function findTourStep(
  id: ProductTourStepId,
): ProductTourStep | undefined {
  return PRODUCT_TOUR_STEPS.find((step) => step.id === id);
}

export function nextTourStepId(
  id: ProductTourStepId,
  state: OnboardingState,
): ProductTourStepId | null {
  const done = new Set(getProductTourState(state).completedStepIds);
  const skipped = new Set(getProductTourState(state).skippedStepIds);
  const index = PRODUCT_TOUR_STEPS.findIndex((step) => step.id === id);
  for (const step of PRODUCT_TOUR_STEPS.slice(index + 1)) {
    if (!done.has(step.id) && !skipped.has(step.id)) return step.id;
  }
  return null;
}
