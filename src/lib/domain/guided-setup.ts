/**
 * Guided setup step selection.
 *
 * Step metadata lives here; the order and current step come from Stage 1
 * progress, Stage 2 workflow recommendations, Stage 3 actions, and Stage 4
 * onboarding state. Tutorial steps never change actual business completion.
 */

import type { OnboardingState, TutorialSection } from "./onboarding";
import {
  isRouteAvailable,
  DEFAULT_AVAILABLE_ROUTES,
} from "./recommendations";
import type { ProgressSnapshot, WorkflowStageKey } from "./progress";

export interface GuidedSetupStep {
  section: TutorialSection;
  stage: WorkflowStageKey;
  title: string;
  description: string;
  expectedOutcome: string;
  moduleLabel: string;
  targetRoute: string;
}

export const GUIDED_SETUP_STEPS: readonly GuidedSetupStep[] = [
  {
    section: "career_profile",
    stage: "career_profile",
    title: "Complete your career profile",
    description:
      "Record your professional details, experience, education, and verified skills.",
    expectedOutcome:
      "Your profile passes the existing isReadyForAi rule and can ground job matching.",
    moduleLabel: "Career Profile",
    targetRoute: "/profile",
  },
  {
    section: "cv_upload",
    stage: "cv_upload",
    title: "Upload a CV",
    description: "Store a master CV version with a real file attachment.",
    expectedOutcome: "At least one stored CV is available for applications.",
    moduleLabel: "Documents",
    targetRoute: "/documents",
  },
  {
    section: "job_discovery",
    stage: "job_discovery",
    title: "Discover job opportunities",
    description: "Save vacancies you are interested in from job boards.",
    expectedOutcome: "A saved vacancy appears in your job pipeline.",
    moduleLabel: "Find Jobs",
    targetRoute: "/jobs/new",
  },
  {
    section: "suitability_evaluation",
    stage: "suitability_evaluation",
    title: "Evaluate job compatibility",
    description: "Score a saved vacancy against your profile and preferences.",
    expectedOutcome: "A scored suitability evaluation is stored for a vacancy.",
    moduleLabel: "Job Detail / Suitability",
    targetRoute: "/jobs",
  },
  {
    section: "shortlist",
    stage: "shortlist",
    title: "Build your shortlist",
    description: "Mark the most promising vacancies as interested or shortlisted.",
    expectedOutcome: "At least one vacancy is shortlisted or marked interested.",
    moduleLabel: "Job Shortlist",
    targetRoute: "/shortlist",
  },
  {
    section: "job_application",
    stage: "job_application",
    title: "Create a job application",
    description: "Record the submission date, method, and CV version for a role.",
    expectedOutcome: "An application exists in your pipeline.",
    moduleLabel: "Applications",
    targetRoute: "/applications",
  },
  {
    section: "recruitment_tracking",
    stage: "recruitment_tracking",
    title: "Track recruitment progress",
    description:
      "Record stage changes, interviews, assessments, and follow-up tasks.",
    expectedOutcome: "A real tracking activity is recorded on an application.",
    moduleLabel: "Applications / Interviews",
    targetRoute: "/interviews",
  },
  {
    section: "offers_outcomes",
    stage: "offers_outcomes",
    title: "Manage offers and outcomes",
    description: "Record an offer decision or close an application outcome.",
    expectedOutcome: "An offer or completed application outcome is recorded.",
    moduleLabel: "Applications / Archive",
    targetRoute: "/applications",
  },
];

const STEP_BY_SECTION = new Map(
  GUIDED_SETUP_STEPS.map((step) => [step.section, step]),
);

export type TutorialBusinessState = "complete" | "incomplete" | "unavailable";

export function getStepBusinessState(
  progress: ProgressSnapshot,
  section: TutorialSection,
): TutorialBusinessState {
  const stage = progress.stages.find(
    (candidate) => candidate.key === STEP_BY_SECTION.get(section)?.stage,
  );
  if (!stage || stage.status === "unavailable") return "unavailable";
  return stage.status === "complete" ? "complete" : "incomplete";
}

export function resolveGuidedSetupStep(input: {
  progress: ProgressSnapshot;
  recommendedNextStages: readonly WorkflowStageKey[];
  onboarding: OnboardingState;
  availableRoutes?: readonly string[];
}): GuidedSetupStep | null {
  const skipped = new Set(input.onboarding.skippedSections);
  const tutorialDone = new Set(input.onboarding.completedSections);
  const businessComplete = new Set(input.progress.completedStages);
  const isEligible = (section: TutorialSection) =>
    !skipped.has(section) &&
    !tutorialDone.has(section) &&
    !businessComplete.has(section);

  const candidates: TutorialSection[] = [
    input.onboarding.currentPosition,
    ...input.recommendedNextStages,
    ...GUIDED_SETUP_STEPS.map((step) => step.section),
  ].filter((section): section is TutorialSection => Boolean(section));

  for (const section of candidates) {
    if (!isEligible(section)) continue;
    const step = STEP_BY_SECTION.get(section);
    if (!step) continue;
    if (getStepBusinessState(input.progress, section) === "unavailable") {
      continue;
    }
    return step;
  }
  return null;
}

export function isStepRouteAvailable(
  step: GuidedSetupStep,
  availableRoutes: readonly string[] = DEFAULT_AVAILABLE_ROUTES,
): boolean {
  return isRouteAvailable(step.targetRoute, availableRoutes);
}

export function nextSetupSection(
  section: TutorialSection,
  onboarding: OnboardingState,
): TutorialSection | null {
  const start = GUIDED_SETUP_STEPS.findIndex((step) => step.section === section);
  const skipped = new Set(onboarding.skippedSections);
  const tutorialDone = new Set([...onboarding.completedSections, section]);
  for (const step of GUIDED_SETUP_STEPS.slice(start + 1)) {
    if (!skipped.has(step.section) && !tutorialDone.has(step.section)) {
      return step.section;
    }
  }
  return null;
}
