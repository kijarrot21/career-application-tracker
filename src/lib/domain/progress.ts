/**
 * Workflow progress detection domain model.
 *
 * Pure, isomorphic types and aggregation rules for deriving a user's actual
 * progress from existing business records. Nothing in this module reads a
 * database or stores state: progress is always recalculated from source data,
 * never from onboarding clicks, tutorial checkboxes, or cached flags.
 */

export const WORKFLOW_STAGE_KEYS = [
  "career_profile",
  "cv_upload",
  "job_discovery",
  "suitability_evaluation",
  "shortlist",
  "job_application",
  "recruitment_tracking",
  "offers_outcomes",
] as const;
export type WorkflowStageKey = (typeof WORKFLOW_STAGE_KEYS)[number];

export const STAGE_COMPLETION_STATES = [
  "complete",
  "incomplete",
  "optional",
  "unavailable",
] as const;
export type StageCompletionState = (typeof STAGE_COMPLETION_STATES)[number];

export const PROGRESS_MODULE_KEYS = [
  "career_profile",
  "cv_upload",
  "job_discovery",
  "suitability_evaluation",
  "shortlist",
  "job_application",
  "recruitment_tracking",
  "offers_outcomes",
] as const;
export type ProgressModuleKey = (typeof PROGRESS_MODULE_KEYS)[number];

export interface WorkflowStageDefinition {
  key: WorkflowStageKey;
  label: string;
  isOptional: boolean;
  module: ProgressModuleKey;
  criteria: string;
}

/**
 * The eight supported workflow stages. Every entry points at a module that is
 * checked for availability before the stage is evaluated.
 */
export const WORKFLOW_STAGES: readonly WorkflowStageDefinition[] = [
  {
    key: "career_profile",
    label: "Career Profile",
    isOptional: false,
    module: "career_profile",
    criteria:
      "Master career profile passes the existing isReadyForAi rule (professional info, at least one experience, and three verified skills).",
  },
  {
    key: "cv_upload",
    label: "CV Upload",
    isOptional: false,
    module: "cv_upload",
    criteria:
      "At least one non-sample CV document version with a stored file key exists.",
  },
  {
    key: "job_discovery",
    label: "Job Discovery",
    isOptional: false,
    module: "job_discovery",
    criteria: "At least one non-sample saved vacancy exists.",
  },
  {
    key: "suitability_evaluation",
    label: "Suitability Evaluation",
    isOptional: true,
    module: "suitability_evaluation",
    criteria:
      "At least one scored suitability evaluation exists for a non-sample vacancy.",
  },
  {
    key: "shortlist",
    label: "Shortlist",
    isOptional: true,
    module: "shortlist",
    criteria:
      "At least one non-sample vacancy has triage status 'shortlisted' or 'interested'.",
  },
  {
    key: "job_application",
    label: "Job Application",
    isOptional: false,
    module: "job_application",
    criteria: "At least one non-sample application exists.",
  },
  {
    key: "recruitment_tracking",
    label: "Recruitment Tracking",
    isOptional: true,
    module: "recruitment_tracking",
    criteria:
      "A non-sample application has real tracking activity: a stage transition beyond submission, an interview, an assessment, a completed follow-up, or a linked recruitment email.",
  },
  {
    key: "offers_outcomes",
    label: "Offers and Outcomes",
    isOptional: true,
    module: "offers_outcomes",
    criteria:
      "A job offer, a completed/closed non-sample application, or an active archive closure record exists.",
  },
];

/**
 * Module availability is explicit so a missing module can never be mistaken
 * for an incomplete stage. All modules exist in the current schema.
 */
export const MODULE_AVAILABILITY: Readonly<Record<ProgressModuleKey, boolean>> = {
  career_profile: true,
  cv_upload: true,
  job_discovery: true,
  suitability_evaluation: true,
  shortlist: true,
  job_application: true,
  recruitment_tracking: true,
  offers_outcomes: true,
};

export function isModuleAvailable(module: ProgressModuleKey): boolean {
  return MODULE_AVAILABILITY[module] === true;
}

export interface StageEvidence {
  /** IDs of the user's own records that support the result. */
  recordIds: string[];
  /** Human-readable summary of the supporting records. */
  summary: string;
}

export interface StageEvaluationInput {
  key: WorkflowStageKey;
  isApplicable: boolean;
  isComplete: boolean;
  reason: string;
  evidence: StageEvidence;
}

export interface StageProgressResult extends StageEvaluationInput {
  label: string;
  isOptional: boolean;
  status: StageCompletionState;
}

export interface ProgressOverall {
  completedCount: number;
  totalApplicableStages: number;
  requiredApplicableCount: number;
  optionalApplicableCount: number;
  completedRequiredCount: number;
  completedOptionalCount: number;
  percentage: number;
  formula: string;
}

export interface ProgressSnapshot {
  overall: ProgressOverall;
  stages: StageProgressResult[];
  completedStages: WorkflowStageKey[];
  incompleteStages: WorkflowStageKey[];
  optionalStages: WorkflowStageKey[];
  unavailableStages: WorkflowStageKey[];
  /** ISO-8601 timestamp of when this snapshot was calculated. */
  calculatedAt: string;
}

/**
 * completedStages / (requiredApplicableStages + completedOptionalStages) * 100,
 * rounded to one decimal. Optional stages that are not complete are excluded
 * from the denominator, so skipping them never lowers the percentage.
 * Unavailable stages are excluded from both numerator and denominator.
 * A zero denominator yields 0%.
 */
export const PROGRESS_PERCENTAGE_FORMULA =
  "completedStages / (requiredApplicableStages + completedOptionalStages) * 100, rounded to one decimal; unavailable stages are excluded; zero denominator yields 0%";

export function computeProgressPercentage(params: {
  completedCount: number;
  requiredApplicableCount: number;
  completedOptionalCount: number;
}): number {
  const denominator =
    params.requiredApplicableCount + params.completedOptionalCount;
  if (denominator <= 0) return 0;
  const numerator = Math.min(Math.max(params.completedCount, 0), denominator);
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Combine raw stage evaluations into a stable, ordered, fully typed snapshot.
 * Evaluations are matched by key; missing evaluations are treated as
 * unavailable rather than silently dropped.
 */
export function aggregateProgress(
  evaluations: readonly StageEvaluationInput[],
  calculatedAt: string,
): ProgressSnapshot {
  const byKey = new Map(evaluations.map((e) => [e.key, e]));
  const stages: StageProgressResult[] = WORKFLOW_STAGES.map((definition) => {
    const evaluation = byKey.get(definition.key);
    const isApplicable =
      evaluation?.isApplicable === true && isModuleAvailable(definition.module);
    const isComplete = isApplicable && evaluation?.isComplete === true;

    let status: StageCompletionState;
    if (!isApplicable) status = "unavailable";
    else if (isComplete) status = "complete";
    else if (definition.isOptional) status = "optional";
    else status = "incomplete";

    return {
      key: definition.key,
      label: definition.label,
      isOptional: definition.isOptional,
      isApplicable,
      isComplete,
      status,
      reason: evaluation?.reason ?? "This stage could not be evaluated.",
      evidence: evaluation?.evidence ?? { recordIds: [], summary: "No records" },
    };
  });

  const completedStages = stages
    .filter((s) => s.status === "complete")
    .map((s) => s.key);
  const incompleteStages = stages
    .filter((s) => s.status === "incomplete")
    .map((s) => s.key);
  const optionalStages = stages
    .filter((s) => s.status === "optional")
    .map((s) => s.key);
  const unavailableStages = stages
    .filter((s) => s.status === "unavailable")
    .map((s) => s.key);

  const applicableStages = stages.filter((s) => s.isApplicable);
  const requiredApplicableCount = applicableStages.filter(
    (s) => !s.isOptional,
  ).length;
  const optionalApplicableCount = applicableStages.filter(
    (s) => s.isOptional,
  ).length;
  const completedRequiredCount = stages.filter(
    (s) => s.status === "complete" && !s.isOptional,
  ).length;
  const completedOptionalCount = stages.filter(
    (s) => s.status === "complete" && s.isOptional,
  ).length;
  const completedCount = completedStages.length;

  return {
    overall: {
      completedCount,
      totalApplicableStages: applicableStages.length,
      requiredApplicableCount,
      optionalApplicableCount,
      completedRequiredCount,
      completedOptionalCount,
      percentage: computeProgressPercentage({
        completedCount,
        requiredApplicableCount,
        completedOptionalCount,
      }),
      formula: PROGRESS_PERCENTAGE_FORMULA,
    },
    stages,
    completedStages,
    incompleteStages,
    optionalStages,
    unavailableStages,
    calculatedAt,
  };
}
