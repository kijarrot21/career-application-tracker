import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  WORKFLOW_STAGES,
  type ProgressSnapshot,
  type StageEvaluationInput,
  type WorkflowStageKey,
} from "@/lib/domain/progress";
import {
  assertAcyclicWorkflowRules,
  evaluateWorkflow,
  findCircularDependencies,
  resolveWorkflowRules,
  WORKFLOW_ACTIONS,
  WORKFLOW_DEPENDENCY_TYPES,
  WORKFLOW_RULES,
  type WorkflowRule,
} from "@/lib/domain/workflow";

const EVALUATED_AT = "2026-11-18T01:00:00.000Z";

function snapshotWith(
  complete: readonly WorkflowStageKey[] = [],
  unavailable: readonly WorkflowStageKey[] = [],
): ProgressSnapshot {
  const evaluations: StageEvaluationInput[] = WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    isApplicable: !unavailable.includes(stage.key),
    isComplete: complete.includes(stage.key),
    reason: "test",
    evidence: { recordIds: [], summary: "test" },
  }));
  return aggregateProgress(evaluations, "2026-11-18T00:00:00.000Z");
}

function planFor(
  complete: readonly WorkflowStageKey[] = [],
  unavailable: readonly WorkflowStageKey[] = [],
) {
  return evaluateWorkflow(snapshotWith(complete, unavailable), EVALUATED_AT);
}

function blockedActionIds(plan: ReturnType<typeof planFor>): string[] {
  return plan.blockedActions.map((action) => action.id);
}

describe("workflow rule definitions", () => {
  it("defines every dependency classification with a stable unique rule ID", () => {
    const ids = WORKFLOW_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of WORKFLOW_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.source).toBeTruthy();
      expect(rule.target).toBeTruthy();
      expect(WORKFLOW_DEPENDENCY_TYPES).toContain(rule.dependencyType);
      expect(rule.activation).toBeTruthy();
      expect(rule.availability).toBeTruthy();
      expect(rule.explanation.length).toBeGreaterThan(0);
    }
    const allRules = resolveWorkflowRules(snapshotWith([], ["career_profile"]));
    for (const type of WORKFLOW_DEPENDENCY_TYPES) {
      expect(allRules.some((rule) => rule.dependencyType === type)).toBe(true);
    }
  });

  it("has no circular dependencies and rejects a synthetic cycle", () => {
    expect(findCircularDependencies(WORKFLOW_RULES)).toEqual([]);
    expect(() => assertAcyclicWorkflowRules()).not.toThrow();

    const cycle: WorkflowRule[] = [
      {
        id: "CYCLE-A",
        source: "career_profile",
        target: "cv_upload",
        dependencyType: "required_prerequisite",
        activation: { type: "always" },
        availability: { type: "always" },
        explanation: "A",
      },
      {
        id: "CYCLE-B",
        source: "cv_upload",
        target: "career_profile",
        dependencyType: "required_prerequisite",
        activation: { type: "always" },
        availability: { type: "always" },
        explanation: "B",
      },
    ];

    expect(findCircularDependencies(cycle).length).toBeGreaterThan(0);
    expect(() => assertAcyclicWorkflowRules(cycle)).toThrow(
      /circular workflow dependency/i,
    );
  });

  it("ignores self-referencing independent and unavailable rules in cycle detection", () => {
    expect(
      findCircularDependencies([
        {
          id: "SELF",
          source: "career_profile",
          target: "career_profile",
          dependencyType: "independent_action",
          activation: { type: "always" },
          availability: { type: "always" },
          explanation: "self",
        },
      ]),
    ).toEqual([]);
  });
});

describe("normal recommended workflow", () => {
  it("recommends one stage at a time from an empty account", () => {
    expect(planFor().recommendedNextStages).toEqual(["career_profile"]);
    expect(planFor(["career_profile"]).recommendedNextStages).toEqual([
      "cv_upload",
    ]);
    expect(
      planFor(["career_profile", "cv_upload"]).recommendedNextStages,
    ).toEqual(["job_discovery"]);
    expect(
      planFor([
        "career_profile",
        "cv_upload",
        "job_discovery",
      ]).recommendedNextStages,
    ).toEqual(["suitability_evaluation", "shortlist"]);
  });

  it("advances through evaluation, shortlist, application, tracking, and outcomes", () => {
    expect(
      planFor([
        "career_profile",
        "cv_upload",
        "job_discovery",
        "suitability_evaluation",
      ]).recommendedNextStages,
    ).toEqual(["shortlist"]);
    expect(
      planFor([
        "career_profile",
        "cv_upload",
        "job_discovery",
        "suitability_evaluation",
        "shortlist",
      ]).recommendedNextStages,
    ).toEqual(["job_application"]);
    expect(
      planFor([
        "career_profile",
        "cv_upload",
        "job_discovery",
        "shortlist",
        "job_application",
      ]).recommendedNextStages,
    ).toEqual(["recruitment_tracking"]);
    expect(
      planFor([
        "career_profile",
        "cv_upload",
        "job_discovery",
        "job_application",
        "recruitment_tracking",
      ]).recommendedNextStages,
    ).toEqual(["offers_outcomes"]);
  });
});

describe("independent access and blocked actions", () => {
  it("keeps modules available even when earlier stages are incomplete", () => {
    const plan = planFor();
    const ids = plan.availableActions.map((action) => action.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "edit_career_profile",
        "upload_cv",
        "add_vacancy",
        "record_application",
        "log_follow_up",
        "log_communication",
      ]),
    );
  });

  it("blocks only actions with a genuine business prerequisite", () => {
    expect(blockedActionIds(planFor()).sort()).toEqual(
      [
        "add_assessment",
        "close_application",
        "evaluate_job",
        "record_offer",
        "schedule_interview",
        "shortlist_vacancy",
      ].sort(),
    );
    expect(planFor().blockedActions.every((a) => a.blockedByRuleIds.length > 0)).toBe(
      true,
    );
  });

  it("unblocks all actions for a fully populated user", () => {
    const all = WORKFLOW_STAGES.map((stage) => stage.key);
    const plan = planFor(all);
    expect(plan.recommendedNextStages).toEqual([]);
    expect(plan.blockedActions).toEqual([]);
    expect(plan.availableActions).toHaveLength(WORKFLOW_ACTIONS.length);
  });

  it("does not block anything merely because optional stages are incomplete", () => {
    const required = ["career_profile", "cv_upload", "job_discovery", "job_application"] as const;
    const plan = planFor(required);
    expect(plan.blockedActions).toEqual([]);
    expect(plan.optionalStages).toHaveLength(4);
  });

  it("supports users with applications but no onboarding history", () => {
    const plan = planFor(["job_discovery", "job_application"]);
    expect(plan.recommendedNextStages).toContain("career_profile");
    expect(plan.recommendedNextStages).toContain("recruitment_tracking");
    expect(plan.blockedActions).toEqual([]);
  });

  it("supports users who skipped evaluation and shortlist", () => {
    const plan = planFor([
      "career_profile",
      "cv_upload",
      "job_discovery",
      "job_application",
    ]);
    expect(plan.recommendedNextStages).toEqual(["recruitment_tracking"]);
    expect(plan.blockedActions).toEqual([]);
  });
});

describe("unavailable functionality", () => {
  it("excludes unavailable stage actions and reports an explicit rule", () => {
    const plan = planFor([], ["cv_upload"]);

    expect(plan.unavailableStages).toEqual(["cv_upload"]);
    expect(
      plan.availableActions.some((action) => action.stage === "cv_upload"),
    ).toBe(false);
    expect(
      plan.blockedActions.some((action) => action.stage === "cv_upload"),
    ).toBe(false);
    const unavailableRule = plan.dependencyExplanations.find(
      (explanation) => explanation.ruleId === "RU-CV_UPLOAD",
    );
    expect(unavailableRule?.dependencyType).toBe("unavailable_functionality");
    expect(unavailableRule?.isActive).toBe(true);
  });

  it("does not block downstream actions when their prerequisite module is unavailable", () => {
    const plan = planFor([], ["job_discovery"]);
    expect(blockedActionIds(plan)).not.toContain("evaluate_job");
    expect(blockedActionIds(plan)).not.toContain("shortlist_vacancy");
    expect(resolveWorkflowRules(snapshotWith([], ["job_discovery"])).length).toBe(
      WORKFLOW_RULES.length + 1,
    );
  });
});

describe("determinism", () => {
  it("returns identical plans for identical snapshots", () => {
    const snapshot = snapshotWith(["career_profile", "job_application"]);
    const a = evaluateWorkflow(snapshot, EVALUATED_AT);
    const b = evaluateWorkflow(snapshot, EVALUATED_AT);
    expect(a).toEqual(b);
    expect(a.evaluatedAt).toBe(EVALUATED_AT);
    expect(a.progress).toBe(snapshot);
  });

  it("reflects deleted CV data as a repeated recommendation", () => {
    const plan = planFor([
      "career_profile",
      "job_discovery",
      "job_application",
    ]);
    expect(plan.recommendedNextStages).toContain("cv_upload");
  });

  it("does not recommend archived outcomes again", () => {
    const plan = planFor([
      "career_profile",
      "cv_upload",
      "job_discovery",
      "job_application",
      "recruitment_tracking",
      "offers_outcomes",
    ]);
    expect(plan.recommendedNextStages).not.toContain("offers_outcomes");
  });
});
