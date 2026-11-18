import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  computeProgressPercentage,
  MODULE_AVAILABILITY,
  WORKFLOW_STAGES,
  type StageEvaluationInput,
  type WorkflowStageKey,
} from "@/lib/domain/progress";

const CALCULATED_AT = "2026-11-18T00:00:00.000Z";

function allIncomplete(): StageEvaluationInput[] {
  return WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    isApplicable: true,
    isComplete: false,
    reason: "No supporting records",
    evidence: { recordIds: [], summary: "No records" },
  }));
}

function markComplete(
  evaluations: StageEvaluationInput[],
  key: WorkflowStageKey,
): StageEvaluationInput[] {
  return evaluations.map((e) =>
    e.key === key ? { ...e, isComplete: true } : e,
  );
}

function markInapplicable(
  evaluations: StageEvaluationInput[],
  key: WorkflowStageKey,
): StageEvaluationInput[] {
  return evaluations.map((e) =>
    e.key === key ? { ...e, isApplicable: false, isComplete: true } : e,
  );
}

describe("progress domain registry", () => {
  it("defines all eight workflow stages with four optional stages", () => {
    expect(WORKFLOW_STAGES).toHaveLength(8);
    expect(WORKFLOW_STAGES.filter((s) => !s.isOptional).map((s) => s.key)).toEqual([
      "career_profile",
      "cv_upload",
      "job_discovery",
      "job_application",
    ]);
    expect(WORKFLOW_STAGES.filter((s) => s.isOptional).map((s) => s.key)).toEqual([
      "suitability_evaluation",
      "shortlist",
      "recruitment_tracking",
      "offers_outcomes",
    ]);
  });

  it("maps every stage to an existing, available module", () => {
    for (const stage of WORKFLOW_STAGES) {
      expect(MODULE_AVAILABILITY[stage.module]).toBe(true);
      expect(stage.criteria.length).toBeGreaterThan(0);
    }
  });
});

describe("computeProgressPercentage", () => {
  it("returns 0 when there is no denominator", () => {
    expect(
      computeProgressPercentage({
        completedCount: 0,
        requiredApplicableCount: 0,
        completedOptionalCount: 0,
      }),
    ).toBe(0);
  });

  it("does not penalise incomplete optional stages", () => {
    expect(
      computeProgressPercentage({
        completedCount: 4,
        requiredApplicableCount: 4,
        completedOptionalCount: 0,
      }),
    ).toBe(100);
  });

  it("counts completed optional stages in numerator and denominator", () => {
    expect(
      computeProgressPercentage({
        completedCount: 4,
        requiredApplicableCount: 4,
        completedOptionalCount: 2,
      }),
    ).toBe(66.7);
  });

  it("clamps the result to 100", () => {
    expect(
      computeProgressPercentage({
        completedCount: 9,
        requiredApplicableCount: 3,
        completedOptionalCount: 0,
      }),
    ).toBe(100);
  });
});

describe("aggregateProgress", () => {
  it("classifies empty progress as required incomplete and optional optional", () => {
    const snapshot = aggregateProgress(allIncomplete(), CALCULATED_AT);

    expect(snapshot.overall.percentage).toBe(0);
    expect(snapshot.overall.completedCount).toBe(0);
    expect(snapshot.overall.totalApplicableStages).toBe(8);
    expect(snapshot.overall.requiredApplicableCount).toBe(4);
    expect(snapshot.overall.optionalApplicableCount).toBe(4);
    expect(snapshot.incompleteStages).toEqual([
      "career_profile",
      "cv_upload",
      "job_discovery",
      "job_application",
    ]);
    expect(snapshot.optionalStages).toEqual([
      "suitability_evaluation",
      "shortlist",
      "recruitment_tracking",
      "offers_outcomes",
    ]);
    expect(snapshot.unavailableStages).toEqual([]);
    expect(snapshot.calculatedAt).toBe(CALCULATED_AT);
  });

  it("marks completed stages complete and keeps the registry order", () => {
    let evaluations = allIncomplete();
    evaluations = markComplete(evaluations, "career_profile");
    evaluations = markComplete(evaluations, "job_application");
    const snapshot = aggregateProgress(evaluations, CALCULATED_AT);

    expect(snapshot.completedStages).toEqual(["career_profile", "job_application"]);
    expect(snapshot.stages.map((s) => s.key)).toEqual(
      WORKFLOW_STAGES.map((s) => s.key),
    );
    expect(snapshot.stages[0]?.status).toBe("complete");
    expect(snapshot.stages[2]?.status).toBe("incomplete");
    expect(snapshot.overall.completedRequiredCount).toBe(2);
  });

  it("treats an inapplicable stage as unavailable and excludes it from the denominator", () => {
    let evaluations = markInapplicable(allIncomplete(), "career_profile");
    evaluations = markComplete(evaluations, "cv_upload");
    evaluations = markComplete(evaluations, "job_discovery");
    evaluations = markComplete(evaluations, "job_application");
    const snapshot = aggregateProgress(evaluations, CALCULATED_AT);

    expect(snapshot.unavailableStages).toEqual(["career_profile"]);
    expect(snapshot.overall.totalApplicableStages).toBe(7);
    expect(snapshot.overall.requiredApplicableCount).toBe(3);
    expect(snapshot.overall.percentage).toBe(100);
  });

  it("preserves evidence and completion reasons on each stage", () => {
    const evaluations = allIncomplete().map((e) =>
      e.key === "cv_upload"
        ? {
            ...e,
            isComplete: true,
            reason: "1 valid stored CV found.",
            evidence: { recordIds: ["cv_version:abc"], summary: "1 CV version" },
          }
        : e,
    );
    const snapshot = aggregateProgress(evaluations, CALCULATED_AT);
    const cvStage = snapshot.stages.find((s) => s.key === "cv_upload");

    expect(cvStage?.reason).toBe("1 valid stored CV found.");
    expect(cvStage?.evidence.recordIds).toEqual(["cv_version:abc"]);
  });

  it("reports every stage unavailable when no evaluations are supplied", () => {
    const snapshot = aggregateProgress([], CALCULATED_AT);

    expect(snapshot.unavailableStages).toEqual(
      WORKFLOW_STAGES.map((s) => s.key),
    );
    expect(snapshot.overall.percentage).toBe(0);
    expect(snapshot.completedStages).toEqual([]);
  });
});
