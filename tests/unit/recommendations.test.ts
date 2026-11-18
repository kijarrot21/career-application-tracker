import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  WORKFLOW_STAGES,
  type ProgressSnapshot,
  type StageEvaluationInput,
  type WorkflowStageKey,
} from "@/lib/domain/progress";
import {
  computeNextBestActions,
  DEFAULT_AVAILABLE_ROUTES,
  isRouteAvailable,
  type NextBestAction,
  type NextBestActionResult,
  type RecommendationFacts,
} from "@/lib/domain/recommendations";
import { evaluateWorkflow, type WorkflowPlan } from "@/lib/domain/workflow";

const EVALUATED_AT = "2026-11-18T02:00:00.000Z";
const TODAY = "2026-11-18";
/** A user who has completed setup/workflow, so P1/P4 actions are unblocked. */
const WORKFLOW_CORE: readonly WorkflowStageKey[] = [
  "career_profile",
  "cv_upload",
  "job_discovery",
  "suitability_evaluation",
  "shortlist",
  "job_application",
];

function progressWith(complete: readonly WorkflowStageKey[] = []): ProgressSnapshot {
  const evaluations: StageEvaluationInput[] = WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    isApplicable: true,
    isComplete: complete.includes(stage.key),
    reason: `${stage.label} reason`,
    evidence: { recordIds: [], summary: "test" },
  }));
  return aggregateProgress(evaluations, "2026-11-18T00:00:00.000Z");
}

function planWith(complete: readonly WorkflowStageKey[] = []): WorkflowPlan {
  const progress = progressWith(complete);
  return evaluateWorkflow(progress, "2026-11-18T01:00:00.000Z");
}

function factsWith(
  overrides: Partial<RecommendationFacts> = {},
): RecommendationFacts {
  return {
    today: TODAY,
    followUps: [],
    interviews: [],
    assessments: [],
    offers: [],
    statusReviews: [],
    documentReviews: [],
    archiveReviews: [],
    ...overrides,
  };
}

function run(
  complete: readonly WorkflowStageKey[] = [],
  facts: Partial<RecommendationFacts> = {},
  options: Parameters<typeof computeNextBestActions>[2] = {},
): NextBestActionResult {
  return computeNextBestActions(
    planWith(complete),
    factsWith(facts),
    { evaluatedAt: EVALUATED_AT, ...options },
  );
}

function ids(actions: readonly NextBestAction[]): string[] {
  return actions.map((action) => action.actionId);
}

describe("setup and workflow recommendation rules", () => {
  it("recommends completing the profile on an empty account", () => {
    const result = run();
    expect(result.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(result.primary?.targetRoute).toBe("/profile");
    expect(result.primary?.priority).toBe(2);
    expect(result.primary?.category).toBe("setup");
    expect(result.primary?.isAvailable).toBe(true);
    expect(result.urgent).toEqual([]);
  });

  it("recommends CV upload after the profile is complete", () => {
    const result = run(["career_profile"]);
    expect(result.primary?.actionId).toBe("P2-UPLOAD-CV");
    expect(result.primary?.targetRoute).toBe("/documents");
  });

  it("recommends job discovery after CV upload", () => {
    expect(run(["career_profile", "cv_upload"]).primary?.actionId).toBe(
      "P3-DISCOVER-JOBS",
    );
  });

  it("recommends evaluation and shortlist after discovery", () => {
    const result = run(["career_profile", "cv_upload", "job_discovery"]);
    const all = [result.primary, ...result.secondary].filter(
      (action): action is NextBestAction => action !== null,
    );
    expect(ids(all)).toContain("P3-EVALUATE-JOB");
    expect(ids(all)).toContain("P3-BUILD-SHORTLIST");
    expect(result.primary?.priority).toBe(3);
  });

  it("recommends creating an application after shortlist", () => {
    const result = run([
      "career_profile",
      "cv_upload",
      "job_discovery",
      "suitability_evaluation",
      "shortlist",
    ]);
    expect(result.primary?.actionId).toBe("P3-CREATE-APPLICATION");
    expect(result.primary?.targetRoute).toBe("/applications");
  });

  it("reuses the Stage 1 stage reason", () => {
    const result = run();
    expect(result.primary?.reason).toContain("Career Profile");
  });
});

describe("priority 1 recommendation rules", () => {
  it("recommends an overdue follow-up with its real due date", () => {
    const result = run([], {
      followUps: [
        {
          id: "f1",
          title: "Follow up",
          dueOn: "2026-11-14",
          applicationId: "app1",
          appCode: "APP-0001",
        },
      ],
    });
    expect(result.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
    expect(result.primary?.dueDate).toBe("2026-11-14");
    expect(result.primary?.targetRoute).toBe(
      "/applications/app1?tab=followups",
    );
    expect(result.primary?.entityReference).toEqual({
      type: "follow_up",
      id: "f1",
      code: "APP-0001",
    });
    expect(result.urgent).toHaveLength(1);
  });

  it("routes an unlinked follow-up to the dashboard", () => {
    const result = run([], {
      followUps: [
        {
          id: "f2",
          title: "General follow-up",
          dueOn: "2026-11-20",
          applicationId: null,
          appCode: null,
        },
      ],
    });
    expect(result.primary?.targetRoute).toBe("/dashboard");
    expect(result.primary?.actionId).toBe("P1-DUE-FOLLOWUP");
  });

  it("uses the existing two-day due window and ignores later follow-ups", () => {
    const near = run([], {
      followUps: [
        {
          id: "f3",
          title: "Soon",
          dueOn: "2026-11-20",
          applicationId: null,
          appCode: null,
        },
      ],
    });
    expect(near.primary?.actionId).toBe("P1-DUE-FOLLOWUP");

    const far = run([], {
      followUps: [
        {
          id: "f4",
          title: "Later",
          dueOn: "2026-11-25",
          applicationId: null,
          appCode: null,
        },
      ],
    });
    expect(far.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
  });

  it("recommends an upcoming interview inside the existing three-day window", () => {
    const result = run(WORKFLOW_CORE, {
      interviews: [
        {
          id: "i1",
          applicationId: "app2",
          appCode: "APP-0002",
          startsAt: "2026-11-20T09:00:00.000Z",
        },
      ],
    });
    expect(result.primary?.actionId).toBe("P1-UPCOMING-INTERVIEW");
    expect(result.primary?.dueDate).toBe("2026-11-20");
    expect(result.primary?.targetRoute).toBe(
      "/applications/app2?tab=interviews",
    );

    const later = run(WORKFLOW_CORE, {
      interviews: [
        {
          id: "i2",
          applicationId: "app2",
          appCode: "APP-0002",
          startsAt: "2026-12-20T09:00:00.000Z",
        },
      ],
    });
    expect(later.primary).toBeNull();
    expect(later.emptyStateReason).toContain("no time-sensitive");
  });

  it("recommends a pending assessment with and without a due date", () => {
    const withDue = run(WORKFLOW_CORE, {
      assessments: [
        {
          id: "a1",
          applicationId: "app3",
          appCode: "APP-0003",
          title: "Technical test",
          dueDate: "2026-11-22",
        },
      ],
    });
    expect(withDue.primary?.actionId).toBe("P1-PENDING-ASSESSMENT");
    expect(withDue.primary?.dueDate).toBe("2026-11-22");
    expect(withDue.primary?.targetRoute).toBe("/interviews");

    const withoutDue = run(WORKFLOW_CORE, {
      assessments: [
        {
          id: "a2",
          applicationId: "app3",
          appCode: "APP-0003",
          title: "Test",
          dueDate: null,
        },
      ],
    });
    expect(withoutDue.primary?.actionId).toBe("P1-PENDING-ASSESSMENT");
    expect(withoutDue.primary?.dueDate).toBeNull();
    expect(withoutDue.primary?.reason).toContain("no recorded due date");
  });

  it("recommends a pending offer decision with and without a deadline", () => {
    const result = run(WORKFLOW_CORE, {
      offers: [
        {
          id: "o1",
          applicationId: "app4",
          appCode: "APP-0004",
          positionTitle: "Engineer",
          dueDate: "2026-11-24",
        },
      ],
    });
    expect(result.primary?.actionId).toBe("P1-OFFER-DECISION");
    expect(result.primary?.dueDate).toBe("2026-11-24");
    expect(result.primary?.targetRoute).toBe("/applications/app4");

    const noDeadline = run(WORKFLOW_CORE, {
      offers: [
        {
          id: "o2",
          applicationId: "app4",
          appCode: "APP-0004",
          positionTitle: "Engineer",
          dueDate: null,
        },
      ],
    });
    expect(noDeadline.primary?.actionId).toBe("P1-OFFER-DECISION");
    expect(noDeadline.primary?.reason).toContain("no recorded deadline");
  });
});

describe("priority 4 maintenance rules", () => {
  it("recommends updating status from an existing no-response suggestion", () => {
    const result = run(WORKFLOW_CORE, {
      statusReviews: [
        { applicationId: "app5", appCode: "APP-0005", silentDays: 31 },
      ],
    });
    expect(result.primary?.actionId).toBe("P4-UPDATE-STATUS");
    expect(result.primary?.reason).toContain("31 days");
    expect(result.primary?.targetRoute).toBe("/applications/app5");
  });

  it("recommends linking a CV to an application with no version", () => {
    const result = run(WORKFLOW_CORE, {
      documentReviews: [{ applicationId: "app6", appCode: "APP-0006" }],
    });
    expect(result.primary?.actionId).toBe("P4-UPDATE-DOCUMENTS");
    expect(result.primary?.entityReference).toEqual({
      type: "application",
      id: "app6",
      code: "APP-0006",
    });
  });

  it("recommends reviewing an expiring or expired archive", () => {
    const expiring = run(WORKFLOW_CORE, {
      archiveReviews: [
        {
          closureRecordId: "c1",
          applicationId: "app7",
          retentionState: "expiring_soon",
          retainUntil: "2026-12-01",
        },
      ],
    });
    expect(expiring.primary?.actionId).toBe("P4-REVIEW-ARCHIVE");
    expect(expiring.primary?.reason).toContain("expiring soon");
    expect(expiring.primary?.targetRoute).toBe("/archive/c1");

    const expired = run(WORKFLOW_CORE, {
      archiveReviews: [
        {
          closureRecordId: "c2",
          applicationId: "app7",
          retentionState: "expired",
          retainUntil: "2026-11-01",
        },
      ],
    });
    expect(expired.primary?.reason).toContain("expired");
    expect(expired.primary?.dueDate).toBe("2026-11-01");
  });
});

describe("ordering and determinism", () => {
  it("orders priority 1 before setup, workflow, and maintenance", () => {
    const result = run(["career_profile", "cv_upload"], {
      followUps: [
        {
          id: "f5",
          title: "Follow up",
          dueOn: "2026-11-19",
          applicationId: "app8",
          appCode: "APP-0008",
        },
      ],
      statusReviews: [{ applicationId: "app8", appCode: "APP-0008", silentDays: 40 }],
    });
    expect(result.primary?.actionId).toBe("P1-DUE-FOLLOWUP");
    expect(result.secondary.map((a) => a.priority)).toEqual([...result.secondary.map((a) => a.priority)].sort());
    expect(ids(result.secondary)).toContain("P3-DISCOVER-JOBS");
    expect(ids(result.secondary)).toContain("P4-UPDATE-STATUS");
  });

  it("puts overdue actions before upcoming ones with the same priority", () => {
    const result = run([], {
      followUps: [
        {
          id: "f6",
          title: "Overdue",
          dueOn: "2026-11-15",
          applicationId: "app9",
          appCode: "APP-0009",
        },
      ],
      interviews: [
        {
          id: "i3",
          applicationId: "app9",
          appCode: "APP-0009",
          startsAt: "2026-11-19T09:00:00.000Z",
        },
      ],
    });
    expect(result.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
  });

  it("orders equal-priority actions by earliest due date", () => {
    const result = run(WORKFLOW_CORE, {
      assessments: [
        {
          id: "a3",
          applicationId: "app10",
          appCode: "APP-0010",
          title: "Later",
          dueDate: "2026-11-21",
        },
        {
          id: "a4",
          applicationId: "app11",
          appCode: "APP-0011",
          title: "Sooner",
          dueDate: "2026-11-19",
        },
      ],
    });
    expect(result.primary?.entityReference?.id).toBe("a4");
  });

  it("uses existing domain urgency before the stable action ID tie-breaker", () => {
    const result = run(WORKFLOW_CORE, {
      statusReviews: [{ applicationId: "app12", appCode: "APP-0012", silentDays: 45 }],
      archiveReviews: [
        {
          closureRecordId: "c3",
          applicationId: "app13",
          retentionState: "expiring_soon",
          retainUntil: null,
        },
      ],
    });
    expect(result.primary?.actionId).toBe("P4-UPDATE-STATUS");
  });

  it("uses the action ID as the final tie-breaker", () => {
    const result = run(WORKFLOW_CORE, {
      offers: [
        {
          id: "o3",
          applicationId: "app14",
          appCode: "APP-0014",
          positionTitle: "Engineer",
          dueDate: "2026-11-20",
        },
      ],
      interviews: [
        {
          id: "i4",
          applicationId: "app14",
          appCode: "APP-0014",
          startsAt: "2026-11-20T09:00:00.000Z",
        },
      ],
    });
    expect(ids(result.urgent)).toEqual([
      "P1-OFFER-DECISION",
      "P1-UPCOMING-INTERVIEW",
    ]);
  });

  it("never emits the same action ID twice", () => {
    const result = run([], {
      followUps: [
        {
          id: "f7",
          title: "First",
          dueOn: "2026-11-16",
          applicationId: "app15",
          appCode: "APP-0015",
        },
        {
          id: "f8",
          title: "Second",
          dueOn: "2026-11-17",
          applicationId: "app16",
          appCode: "APP-0016",
        },
      ],
    });
    const all = [result.primary, ...result.secondary]
      .filter((a): a is NextBestAction => a !== null)
      .map((a) => a.actionId);
    expect(new Set(all).size).toBe(all.length);
  });

  it("returns identical output for identical input", () => {
    const plan = planWith(["career_profile"]);
    const facts = factsWith({
      followUps: [
        {
          id: "f9",
          title: "Follow up",
          dueOn: "2026-11-19",
          applicationId: "app17",
          appCode: "APP-0017",
        },
      ],
    });
    const a = computeNextBestActions(plan, facts, { evaluatedAt: EVALUATED_AT });
    const b = computeNextBestActions(plan, facts, { evaluatedAt: EVALUATED_AT });
    expect(a).toEqual(b);
    expect(a.evaluatedAt).toBe(EVALUATED_AT);
  });
});

describe("availability and empty state", () => {
  it("filters unavailable routes", () => {
    const result = run([], {}, { availableRoutes: ["/profile"] });
    expect(result.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(ids(result.secondary)).toEqual([]);
  });

  it("matches dynamic route patterns and rejects unknown routes", () => {
    expect(DEFAULT_AVAILABLE_ROUTES).toContain("/applications/:id");
    expect(isRouteAvailable("/applications/app1?tab=followups")).toBe(true);
    expect(isRouteAvailable("/archive/c1")).toBe(true);
    expect(isRouteAvailable("/does-not-exist")).toBe(false);
  });

  it("filters actions blocked by the Stage 2 workflow plan", () => {
    const plan = planWith(["career_profile"]);
    const filteredPlan: WorkflowPlan = {
      ...plan,
      availableActions: plan.availableActions.filter(
        (action) => action.id !== "upload_cv",
      ),
    };
    const result = computeNextBestActions(
      filteredPlan,
      factsWith(),
      { evaluatedAt: EVALUATED_AT },
    );
    const allIds = [result.primary, ...result.secondary]
      .filter((action): action is NextBestAction => action !== null)
      .map((action) => action.actionId);
    expect(allIds).not.toContain("P2-UPLOAD-CV");
  });

  it("returns a deterministic empty state", () => {
    const result = run(WORKFLOW_STAGES.map((stage) => stage.key));
    expect(result.primary).toBeNull();
    expect(result.secondary).toEqual([]);
    expect(result.urgent).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(result.emptyStateReason).toContain("no time-sensitive");
    expect(result.progressContext.percentage).toBe(100);
  });
});
