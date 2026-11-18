/**
 * Workflow dependency and rules engine.
 *
 * Pure, deterministic rules that interpret a Stage 1 ProgressSnapshot. The
 * workflow is advisory: it recommends an order but never hides or disables
 * modules that users can already access independently. Only prerequisites that
 * existing business rules genuinely enforce produce blocked actions.
 */

import {
  WORKFLOW_STAGES,
  type ProgressSnapshot,
  type StageCompletionState,
  type WorkflowStageKey,
} from "./progress";

export const WORKFLOW_DEPENDENCY_TYPES = [
  "required_prerequisite",
  "recommended_prerequisite",
  "optional_prerequisite",
  "independent_action",
  "unavailable_functionality",
] as const;
export type WorkflowDependencyType =
  (typeof WORKFLOW_DEPENDENCY_TYPES)[number];

export const WORKFLOW_DEPENDENCY_LABELS: Record<
  WorkflowDependencyType,
  string
> = {
  required_prerequisite: "Required prerequisite",
  recommended_prerequisite: "Recommended prerequisite",
  optional_prerequisite: "Optional prerequisite",
  independent_action: "Independent action",
  unavailable_functionality: "Unavailable functionality",
};

/** Declarative, deterministic conditions over a progress snapshot. */
export type WorkflowCondition =
  | { type: "always" }
  | {
      type: "stage_status";
      stage: WorkflowStageKey;
      statuses: readonly StageCompletionState[];
    }
  | { type: "stage_complete"; stage: WorkflowStageKey }
  | { type: "stage_not_complete"; stage: WorkflowStageKey }
  | { type: "stage_available"; stage: WorkflowStageKey }
  | { type: "stage_unavailable"; stage: WorkflowStageKey }
  | { type: "any_complete"; stages: readonly WorkflowStageKey[] }
  | { type: "all_complete"; stages: readonly WorkflowStageKey[] }
  | { type: "all"; conditions: readonly WorkflowCondition[] }
  | { type: "any"; conditions: readonly WorkflowCondition[] };

export interface WorkflowRule {
  id: string;
  source: WorkflowStageKey;
  target: WorkflowStageKey;
  dependencyType: WorkflowDependencyType;
  activation: WorkflowCondition;
  availability: WorkflowCondition;
  explanation: string;
  /** Actions that genuinely cannot run while this rule is active. */
  blockedActionIds?: readonly string[];
}

/**
 * Rules are ordered deliberately so output is stable. Required rules mirror
 * real FK/service checks; recommended rules encode the advisory workflow;
 * optional rules influence ordering without blocking anything.
 */
export const WORKFLOW_RULES: readonly WorkflowRule[] = [
  {
    id: "RQ-001",
    source: "job_discovery",
    target: "suitability_evaluation",
    dependencyType: "required_prerequisite",
    activation: { type: "stage_not_complete", stage: "job_discovery" },
    availability: {
      type: "all",
      conditions: [
        { type: "stage_available", stage: "job_discovery" },
        { type: "stage_available", stage: "suitability_evaluation" },
      ],
    },
    explanation:
      "A suitability evaluation is stored against a saved vacancy, so save a vacancy before evaluating one.",
    blockedActionIds: ["evaluate_job"],
  },
  {
    id: "RQ-002",
    source: "job_discovery",
    target: "shortlist",
    dependencyType: "required_prerequisite",
    activation: { type: "stage_not_complete", stage: "job_discovery" },
    availability: {
      type: "all",
      conditions: [
        { type: "stage_available", stage: "job_discovery" },
        { type: "stage_available", stage: "shortlist" },
      ],
    },
    explanation:
      "Shortlisting changes a saved vacancy's triage status, so a vacancy must exist first.",
    blockedActionIds: ["shortlist_vacancy"],
  },
  {
    id: "RQ-003",
    source: "job_application",
    target: "recruitment_tracking",
    dependencyType: "required_prerequisite",
    activation: { type: "stage_not_complete", stage: "job_application" },
    availability: {
      type: "all",
      conditions: [
        { type: "stage_available", stage: "job_application" },
        { type: "stage_available", stage: "recruitment_tracking" },
      ],
    },
    explanation:
      "Interviews and assessments are attached to an existing application.",
    blockedActionIds: ["schedule_interview", "add_assessment"],
  },
  {
    id: "RQ-004",
    source: "job_application",
    target: "offers_outcomes",
    dependencyType: "required_prerequisite",
    activation: { type: "stage_not_complete", stage: "job_application" },
    availability: {
      type: "all",
      conditions: [
        { type: "stage_available", stage: "job_application" },
        { type: "stage_available", stage: "offers_outcomes" },
      ],
    },
    explanation:
      "Offers and closure outcomes are recorded against an existing application.",
    blockedActionIds: ["record_offer", "close_application"],
  },
  {
    id: "RC-001",
    source: "career_profile",
    target: "cv_upload",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "career_profile" },
    availability: { type: "stage_available", stage: "cv_upload" },
    explanation:
      "With your career profile in place, uploading a CV is the natural next step.",
  },
  {
    id: "RC-002",
    source: "cv_upload",
    target: "job_discovery",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "cv_upload" },
    availability: { type: "stage_available", stage: "job_discovery" },
    explanation:
      "Once a CV is stored, discovering and saving vacancies is recommended.",
  },
  {
    id: "RC-003",
    source: "job_discovery",
    target: "suitability_evaluation",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "job_discovery" },
    availability: { type: "stage_available", stage: "suitability_evaluation" },
    explanation:
      "Evaluate compatibility for the vacancies you have saved to focus your effort.",
  },
  {
    id: "RC-004",
    source: "job_discovery",
    target: "shortlist",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "job_discovery" },
    availability: { type: "stage_available", stage: "shortlist" },
    explanation:
      "Shortlist the most promising saved vacancies before applying.",
  },
  {
    id: "RC-005",
    source: "shortlist",
    target: "job_application",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "shortlist" },
    availability: { type: "stage_available", stage: "job_application" },
    explanation:
      "Your shortlist is ready, so recording applications for those roles is recommended.",
  },
  {
    id: "RC-006",
    source: "job_application",
    target: "recruitment_tracking",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "job_application" },
    availability: { type: "stage_available", stage: "recruitment_tracking" },
    explanation:
      "Track stage changes, interviews, assessments, and follow-ups for your applications.",
  },
  {
    id: "RC-007",
    source: "recruitment_tracking",
    target: "offers_outcomes",
    dependencyType: "recommended_prerequisite",
    activation: { type: "stage_complete", stage: "recruitment_tracking" },
    availability: { type: "stage_available", stage: "offers_outcomes" },
    explanation:
      "Track recruitment progress so offers and final outcomes are captured in context.",
  },
  {
    id: "RO-001",
    source: "career_profile",
    target: "suitability_evaluation",
    dependencyType: "optional_prerequisite",
    activation: { type: "stage_complete", stage: "career_profile" },
    availability: { type: "stage_available", stage: "suitability_evaluation" },
    explanation:
      "A complete career profile makes suitability scores more accurate, but evaluations work without it.",
  },
  {
    id: "RO-002",
    source: "suitability_evaluation",
    target: "shortlist",
    dependencyType: "optional_prerequisite",
    activation: { type: "stage_complete", stage: "suitability_evaluation" },
    availability: { type: "stage_available", stage: "shortlist" },
    explanation:
      "Evaluation scores can inform your shortlist, but shortlisting does not require them.",
  },
  {
    id: "RO-003",
    source: "job_discovery",
    target: "job_application",
    dependencyType: "optional_prerequisite",
    activation: { type: "stage_complete", stage: "job_discovery" },
    availability: { type: "stage_available", stage: "job_application" },
    explanation:
      "You may apply directly to a saved vacancy without evaluating or shortlisting it first.",
  },
  {
    id: "RI-001",
    source: "career_profile",
    target: "career_profile",
    dependencyType: "independent_action",
    activation: { type: "always" },
    availability: { type: "stage_available", stage: "career_profile" },
    explanation: "Your career profile can be edited at any time.",
  },
  {
    id: "RI-002",
    source: "cv_upload",
    target: "cv_upload",
    dependencyType: "independent_action",
    activation: { type: "always" },
    availability: { type: "stage_available", stage: "cv_upload" },
    explanation: "CV documents can be managed at any time.",
  },
  {
    id: "RI-003",
    source: "job_discovery",
    target: "job_discovery",
    dependencyType: "independent_action",
    activation: { type: "always" },
    availability: { type: "stage_available", stage: "job_discovery" },
    explanation: "Vacancies can be saved at any time.",
  },
  {
    id: "RI-004",
    source: "job_application",
    target: "job_application",
    dependencyType: "independent_action",
    activation: { type: "always" },
    availability: { type: "stage_available", stage: "job_application" },
    explanation:
      "Applications can be recorded at any time; a vacancy may be created as part of recording one.",
  },
];

export interface WorkflowActionDefinition {
  id: string;
  label: string;
  stage: WorkflowStageKey;
}

/** Concrete user actions, grouped by the stage module that owns them. */
export const WORKFLOW_ACTIONS: readonly WorkflowActionDefinition[] = [
  { id: "edit_career_profile", label: "Edit career profile", stage: "career_profile" },
  { id: "upload_cv", label: "Upload or replace a CV", stage: "cv_upload" },
  { id: "add_vacancy", label: "Save a job vacancy", stage: "job_discovery" },
  { id: "evaluate_job", label: "Evaluate job compatibility", stage: "suitability_evaluation" },
  { id: "shortlist_vacancy", label: "Shortlist a vacancy", stage: "shortlist" },
  { id: "record_application", label: "Record a job application", stage: "job_application" },
  { id: "log_follow_up", label: "Log a follow-up task", stage: "recruitment_tracking" },
  { id: "log_communication", label: "Log a recruitment communication", stage: "recruitment_tracking" },
  { id: "schedule_interview", label: "Schedule an interview", stage: "recruitment_tracking" },
  { id: "add_assessment", label: "Add an assessment", stage: "recruitment_tracking" },
  { id: "record_offer", label: "Record a job offer", stage: "offers_outcomes" },
  { id: "close_application", label: "Close or archive an application", stage: "offers_outcomes" },
];

export interface WorkflowActionResult extends WorkflowActionDefinition {
  status: "available" | "blocked";
  reason: string;
  blockedByRuleIds: string[];
}

export interface DependencyExplanation {
  ruleId: string;
  source: WorkflowStageKey;
  target: WorkflowStageKey;
  dependencyType: WorkflowDependencyType;
  explanation: string;
  isActive: boolean;
}

export interface WorkflowPlan {
  progress: ProgressSnapshot;
  availableActions: WorkflowActionResult[];
  recommendedNextStages: WorkflowStageKey[];
  blockedActions: WorkflowActionResult[];
  optionalStages: WorkflowStageKey[];
  unavailableStages: WorkflowStageKey[];
  dependencyExplanations: DependencyExplanation[];
  evaluatedAt: string;
}

function stageOf(progress: ProgressSnapshot, key: WorkflowStageKey) {
  const stage = progress.stages.find((s) => s.key === key);
  if (!stage) throw new Error(`Unknown workflow stage: ${key}`);
  return stage;
}

/** Evaluate a declarative condition against a Stage 1 progress snapshot. */
export function evaluateCondition(
  condition: WorkflowCondition,
  progress: ProgressSnapshot,
): boolean {
  switch (condition.type) {
    case "always":
      return true;
    case "stage_status":
      return condition.statuses.includes(stageOf(progress, condition.stage).status);
    case "stage_complete":
      return stageOf(progress, condition.stage).status === "complete";
    case "stage_not_complete":
      return stageOf(progress, condition.stage).status !== "complete";
    case "stage_available":
      return stageOf(progress, condition.stage).status !== "unavailable";
    case "stage_unavailable":
      return stageOf(progress, condition.stage).status === "unavailable";
    case "any_complete":
      return condition.stages.some(
        (stage) => stageOf(progress, stage).status === "complete",
      );
    case "all_complete":
      return condition.stages.every(
        (stage) => stageOf(progress, stage).status === "complete",
      );
    case "all":
      return condition.conditions.every((c) => evaluateCondition(c, progress));
    case "any":
      return condition.conditions.some((c) => evaluateCondition(c, progress));
  }
}

/**
 * Adds an explicit rule for every unavailable module so missing functionality
 * is reported through the same typed rule model as other dependencies.
 */
export function resolveWorkflowRules(
  progress: ProgressSnapshot,
): WorkflowRule[] {
  const unavailableRules: WorkflowRule[] = progress.unavailableStages.map(
    (key) => ({
      id: `RU-${key.toUpperCase()}`,
      source: key,
      target: key,
      dependencyType: "unavailable_functionality",
      activation: { type: "stage_unavailable", stage: key },
      availability: { type: "always" },
      explanation: `The ${stageOf(progress, key).label} module is unavailable in this installation.`,
    }),
  );
  return [...WORKFLOW_RULES, ...unavailableRules];
}

/**
 * Return a human-readable cycle for any supplied rule set. Self-referencing
 * independent/unavailable rules are intentionally ignored.
 */
export function findCircularDependencies(
  rules: readonly WorkflowRule[],
): string[] {
  const adjacency = new Map<WorkflowStageKey, WorkflowStageKey[]>();
  for (const rule of rules) {
    if (
      rule.source === rule.target ||
      rule.dependencyType === "independent_action" ||
      rule.dependencyType === "unavailable_functionality"
    ) {
      continue;
    }
    const list = adjacency.get(rule.source) ?? [];
    if (!list.includes(rule.target)) list.push(rule.target);
    adjacency.set(rule.source, list);
  }

  const visiting = new Set<WorkflowStageKey>();
  const visited = new Set<WorkflowStageKey>();
  const cycles: string[] = [];

  const visit = (node: WorkflowStageKey, path: WorkflowStageKey[]): void => {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      cycles.push([...path.slice(start), node].join(" -> "));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      visit(next, [...path, next]);
    }
    visiting.delete(node);
    visited.add(node);
  };

  for (const stage of WORKFLOW_STAGES) {
    visit(stage.key, [stage.key]);
  }
  return cycles;
}

/** Fail fast if a future edit introduces a circular prerequisite. */
export function assertAcyclicWorkflowRules(
  rules: readonly WorkflowRule[] = WORKFLOW_RULES,
): void {
  const cycles = findCircularDependencies(rules);
  if (cycles.length > 0) {
    throw new Error(`Circular workflow dependency: ${cycles.join("; ")}`);
  }
}

/**
 * Interpret a progress snapshot into advisory actions and recommendations.
 * Incomplete stages remain available; only genuine business prerequisites
 * produce blocked actions.
 */
export function evaluateWorkflow(
  progress: ProgressSnapshot,
  evaluatedAt: string,
): WorkflowPlan {
  assertAcyclicWorkflowRules();
  const rules = resolveWorkflowRules(progress);
  const activeRuleIds = new Set(
    rules
      .filter(
        (rule) =>
          evaluateCondition(rule.activation, progress) &&
          evaluateCondition(rule.availability, progress),
      )
      .map((rule) => rule.id),
  );
  const activeRules = rules.filter((rule) => activeRuleIds.has(rule.id));

  const blockingRuleByAction = new Map<string, WorkflowRule>();
  for (const rule of activeRules) {
    if (rule.dependencyType !== "required_prerequisite") continue;
    for (const actionId of rule.blockedActionIds ?? []) {
      if (!blockingRuleByAction.has(actionId)) {
        blockingRuleByAction.set(actionId, rule);
      }
    }
  }

  const availableActions: WorkflowActionResult[] = [];
  const blockedActions: WorkflowActionResult[] = [];
  for (const action of WORKFLOW_ACTIONS) {
    if (stageOf(progress, action.stage).status === "unavailable") continue;
    const blockingRule = blockingRuleByAction.get(action.id);
    if (blockingRule) {
      blockedActions.push({
        ...action,
        status: "blocked",
        reason: blockingRule.explanation,
        blockedByRuleIds: [blockingRule.id],
      });
    } else {
      availableActions.push({
        ...action,
        status: "available",
        reason: "No business rule requires a prerequisite for this action.",
        blockedByRuleIds: [],
      });
    }
  }

  const recommendedNextStages = WORKFLOW_STAGES.filter((definition, index) => {
    const stage = stageOf(progress, definition.key);
    if (stage.status === "unavailable" || stage.status === "complete") {
      return false;
    }
    // An optional stage the user has already moved past is not nagged about
    // again. Required stages stay recommended until they are actually done.
    if (
      definition.isOptional &&
      WORKFLOW_STAGES.some(
        (later, laterIndex) =>
          laterIndex > index &&
          stageOf(progress, later.key).status === "complete",
      )
    ) {
      return false;
    }
    const recommendedRules = rules.filter(
      (rule) =>
        rule.target === definition.key &&
        rule.dependencyType === "recommended_prerequisite",
    );
    return (
      recommendedRules.length === 0 ||
      recommendedRules.every((rule) =>
        evaluateCondition(rule.activation, progress),
      )
    );
  }).map((definition) => definition.key);

  const optionalStages = WORKFLOW_STAGES.filter((definition) => {
    return (
      definition.isOptional &&
      stageOf(progress, definition.key).status !== "unavailable"
    );
  }).map((definition) => definition.key);

  const dependencyExplanations: DependencyExplanation[] = rules.map((rule) => ({
    ruleId: rule.id,
    source: rule.source,
    target: rule.target,
    dependencyType: rule.dependencyType,
    explanation: rule.explanation,
    isActive: activeRuleIds.has(rule.id),
  }));

  return {
    progress,
    availableActions,
    recommendedNextStages,
    blockedActions,
    optionalStages,
    unavailableStages: [...progress.unavailableStages],
    dependencyExplanations,
    evaluatedAt,
  };
}
