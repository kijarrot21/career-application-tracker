/**
 * Recruitment stage model.
 *
 * Every stage (default or custom) has a fixed `stageType`. Outcomes and
 * analytics are derived from the type, so users can rename, reorder, add, or
 * hide stages without breaking calculations.
 */

export const STAGE_TYPES = [
  "sourced",
  "interested",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "no_response",
] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const OUTCOMES = [
  "active",
  "successful",
  "unsuccessful",
  "withdrawn",
  "no_response",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  active: "Active",
  successful: "Successful",
  unsuccessful: "Unsuccessful",
  withdrawn: "Withdrawn",
  no_response: "No Response",
};

/** Stage types that represent a vacancy before any submission exists. */
export const VACANCY_LEVEL_TYPES: readonly StageType[] = ["sourced", "interested"];
/** Stage types that close an application. */
export const TERMINAL_TYPES: readonly StageType[] = [
  "hired",
  "rejected",
  "withdrawn",
  "no_response",
];
/** Types a user may assign to a custom stage (in-progress, application level). */
export const CUSTOM_STAGE_TYPES: readonly StageType[] = [
  "screening",
  "interview",
  "assessment",
];

export const STAGE_COLORS = [
  "slate",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "amber",
  "orange",
  "teal",
  "emerald",
  "rose",
  "zinc",
  "stone",
] as const;
export type StageColor = (typeof STAGE_COLORS)[number];

export interface DefaultStage {
  key: string;
  name: string;
  stageType: StageType;
  color: StageColor;
}

export const DEFAULT_STAGES: readonly DefaultStage[] = [
  { key: "sourced", name: "Sourced", stageType: "sourced", color: "slate" },
  { key: "interested", name: "Interested", stageType: "interested", color: "sky" },
  { key: "applied", name: "Applied", stageType: "applied", color: "blue" },
  { key: "cv_screening", name: "CV Screening", stageType: "screening", color: "indigo" },
  { key: "hr_interview", name: "HR Interview", stageType: "interview", color: "violet" },
  { key: "user_interview", name: "User Interview", stageType: "interview", color: "purple" },
  { key: "assessment", name: "Assessment / Technical Test", stageType: "assessment", color: "amber" },
  { key: "final_interview", name: "Final Interview", stageType: "interview", color: "orange" },
  { key: "offer", name: "Offer", stageType: "offer", color: "teal" },
  { key: "hired", name: "Hired", stageType: "hired", color: "emerald" },
  { key: "rejected", name: "Rejected", stageType: "rejected", color: "rose" },
  { key: "withdrawn", name: "Withdrawn", stageType: "withdrawn", color: "zinc" },
  { key: "no_response", name: "No Response", stageType: "no_response", color: "stone" },
];

export function isTerminal(type: StageType): boolean {
  return TERMINAL_TYPES.includes(type);
}

export function isVacancyLevel(type: StageType): boolean {
  return VACANCY_LEVEL_TYPES.includes(type);
}

export function deriveOutcome(type: StageType): Outcome {
  switch (type) {
    case "hired":
      return "successful";
    case "rejected":
      return "unsuccessful";
    case "withdrawn":
      return "withdrawn";
    case "no_response":
      return "no_response";
    default:
      return "active";
  }
}

export interface StageLike {
  id: string;
  key?: string;
  name: string;
  stageType: StageType;
  sortOrder: number;
  isHidden?: boolean;
}

export type TransitionKind =
  | "same"
  | "forward"
  | "skip"
  | "backward"
  | "terminal"
  | "reopen"
  | "invalid";

export interface TransitionResult {
  kind: TransitionKind;
  /** Visible in-progress stages jumped over by a forward move. */
  skipped: StageLike[];
  /** Human-readable explanation when kind is "invalid". */
  error?: string;
}

/**
 * Classify a stage move for an existing application.
 * - Moving into a vacancy-level stage (Sourced/Interested) is invalid.
 * - Moving into a terminal stage is "terminal" (needs reason/date dialog).
 * - Moving out of a terminal stage into an active stage is "reopen".
 * - Forward moves that jump over visible stages are "skip".
 */
export function classifyTransition(
  from: StageLike,
  to: StageLike,
  allStages: readonly StageLike[],
): TransitionResult {
  if (from.id === to.id) return { kind: "same", skipped: [] };
  if (isVacancyLevel(to.stageType)) {
    return {
      kind: "invalid",
      skipped: [],
      error: `${to.name} is a vacancy stage. Submitted applications cannot move back to it.`,
    };
  }
  if (isTerminal(to.stageType)) return { kind: "terminal", skipped: [] };
  if (isTerminal(from.stageType)) return { kind: "reopen", skipped: [] };

  if (to.sortOrder < from.sortOrder) return { kind: "backward", skipped: [] };

  const skipped = allStages
    .filter(
      (s) =>
        !s.isHidden &&
        !isTerminal(s.stageType) &&
        !isVacancyLevel(s.stageType) &&
        s.sortOrder > from.sortOrder &&
        s.sortOrder < to.sortOrder,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { kind: skipped.length > 0 ? "skip" : "forward", skipped };
}

/** Transitions that require an explicit reason or confirmation from the user. */
export function requiresDialog(kind: TransitionKind): boolean {
  return kind === "terminal" || kind === "reopen" || kind === "backward";
}

/** Ordering used to decide how far an application progressed. */
const PROGRESS_RANK: Record<StageType, number> = {
  sourced: 0,
  interested: 1,
  applied: 2,
  screening: 3,
  assessment: 4,
  interview: 4,
  offer: 6,
  hired: 7,
  rejected: -1,
  withdrawn: -1,
  no_response: -1,
};

export function progressRank(type: StageType): number {
  return PROGRESS_RANK[type];
}
