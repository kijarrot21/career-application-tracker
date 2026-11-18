/**
 * Deterministic Next Best Action engine.
 *
 * Consumes a Stage 2 WorkflowPlan (which already interprets Stage 1 progress)
 * plus a small set of user-scoped facts. No AI, no persisted state, and no
 * reimplementation of progress or dependency rules.
 */

import { daysBetween } from "./business-days";
import { isFollowUpOverdue } from "./follow-ups";
import type { WorkflowStageKey } from "./progress";
import type { WorkflowPlan } from "./workflow";

export const RECOMMENDATION_PRIORITIES = [1, 2, 3, 4] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const RECOMMENDATION_CATEGORIES = [
  "time_sensitive",
  "setup",
  "application_workflow",
  "maintenance",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export type RecommendationEntityType =
  | "follow_up"
  | "interview"
  | "assessment"
  | "offer"
  | "application"
  | "vacancy"
  | "document"
  | "closure_record"
  | "career_profile";

export interface RecommendationEntityReference {
  type: RecommendationEntityType;
  id: string | null;
  code?: string;
}

export interface NextBestAction {
  actionId: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  reason: string;
  targetRoute: string;
  completionCondition: string;
  dueDate: string | null;
  entityReference: RecommendationEntityReference | null;
  isAvailable: boolean;
}

export interface FollowUpFact {
  id: string;
  title: string;
  dueOn: string;
  applicationId: string | null;
  appCode: string | null;
}

export interface InterviewFact {
  id: string;
  applicationId: string;
  appCode: string;
  startsAt: string;
}

export interface AssessmentFact {
  id: string;
  applicationId: string;
  appCode: string;
  title: string;
  dueDate: string | null;
}

export interface OfferFact {
  id: string;
  applicationId: string;
  appCode: string;
  positionTitle: string;
  dueDate: string | null;
}

export interface StatusReviewFact {
  applicationId: string;
  appCode: string;
  silentDays: number;
}

export interface ArchiveReviewFact {
  closureRecordId: string;
  applicationId: string;
  retentionState: "expiring_soon" | "expired";
  retainUntil: string | null;
}

/** Minimal, user-scoped facts required for recommendation calculation. */
export interface RecommendationFacts {
  today: string;
  followUps: readonly FollowUpFact[];
  interviews: readonly InterviewFact[];
  assessments: readonly AssessmentFact[];
  offers: readonly OfferFact[];
  statusReviews: readonly StatusReviewFact[];
  documentReviews: readonly { applicationId: string; appCode: string }[];
  archiveReviews: readonly ArchiveReviewFact[];
}

export interface RecommendationReason {
  actionId: string;
  reason: string;
}

export interface RecommendationProgressContext {
  completedStages: readonly WorkflowStageKey[];
  recommendedNextStages: readonly WorkflowStageKey[];
  percentage: number;
  progressCalculatedAt: string;
}

export interface NextBestActionResult {
  primary: NextBestAction | null;
  secondary: NextBestAction[];
  urgent: NextBestAction[];
  reasons: RecommendationReason[];
  progressContext: RecommendationProgressContext;
  evaluatedAt: string;
  emptyStateReason: string | null;
}

export interface NextBestActionOptions {
  /** Restricts routes for testing unavailable functionality. */
  availableRoutes?: readonly string[];
  evaluatedAt?: string;
}

/** Existing application routes (route groups are not part of the URL). */
export const DEFAULT_AVAILABLE_ROUTES: readonly string[] = [
  "/profile",
  "/documents",
  "/cv-studio",
  "/jobs",
  "/jobs/new",
  "/jobs/:id",
  "/shortlist",
  "/applications",
  "/applications/:id",
  "/interviews",
  "/emails",
  "/archive",
  "/archive/:id",
  "/dashboard",
  "/settings",
  "/analytics",
];

function matchesRoute(pattern: string, route: string): boolean {
  const patternPath = pattern.split("?")[0] ?? "";
  const routePath = route.split("?")[0] ?? "";
  const patternParts = patternPath.split("/");
  const routeParts = routePath.split("/");
  if (patternParts.length !== routeParts.length) return false;
  return patternParts.every(
    (part, index) => part.startsWith(":") || part === routeParts[index],
  );
}

export function isRouteAvailable(
  route: string,
  availableRoutes: readonly string[] = DEFAULT_AVAILABLE_ROUTES,
): boolean {
  return availableRoutes.some((candidate) => matchesRoute(candidate, route));
}

/** Windows mirror the existing getNotificationsSummary policy. */
export const FOLLOW_UP_DUE_WINDOW_DAYS = 2;
export const UPCOMING_EVENT_WINDOW_DAYS = 3;
const FAR_FUTURE_DATE = "9999-12-31";

interface ActionDefinition {
  actionId: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  completionCondition: string;
  targetRoute: string;
  /** Stage 2 action that must be available for this recommendation to run. */
  workflowActionId?: string;
}

const SETUP_AND_WORKFLOW_ACTIONS: Partial<
  Record<WorkflowStageKey, ActionDefinition>
> = {
  career_profile: {
    actionId: "P2-COMPLETE-PROFILE",
    title: "Complete Career Profile",
    description:
      "Add professional details, experience, and verified skills so your profile is ready for AI-assisted features.",
    priority: 2,
    category: "setup",
    completionCondition: "Career profile passes the isReadyForAi rule.",
    targetRoute: "/profile",
    workflowActionId: "edit_career_profile",
  },
  cv_upload: {
    actionId: "P2-UPLOAD-CV",
    title: "Upload CV",
    description: "Store a master CV version so applications can reference it.",
    priority: 2,
    category: "setup",
    completionCondition: "A non-sample CV version with a stored file key exists.",
    targetRoute: "/documents",
    workflowActionId: "upload_cv",
  },
  job_discovery: {
    actionId: "P3-DISCOVER-JOBS",
    title: "Discover Job Opportunities",
    description: "Save a vacancy you are interested in to start your pipeline.",
    priority: 3,
    category: "application_workflow",
    completionCondition: "At least one non-sample vacancy is saved.",
    targetRoute: "/jobs/new",
    workflowActionId: "add_vacancy",
  },
  suitability_evaluation: {
    actionId: "P3-EVALUATE-JOB",
    title: "Evaluate Job Compatibility",
    description: "Score a saved vacancy against your career profile.",
    priority: 3,
    category: "application_workflow",
    completionCondition: "A scored suitability evaluation exists.",
    targetRoute: "/jobs",
    workflowActionId: "evaluate_job",
  },
  shortlist: {
    actionId: "P3-BUILD-SHORTLIST",
    title: "Build Shortlist",
    description: "Mark the most promising vacancies as interested or shortlisted.",
    priority: 3,
    category: "application_workflow",
    completionCondition: "At least one vacancy is shortlisted or marked interested.",
    targetRoute: "/shortlist",
    workflowActionId: "shortlist_vacancy",
  },
  job_application: {
    actionId: "P3-CREATE-APPLICATION",
    title: "Create Job Application",
    description: "Record a submission for a vacancy in your shortlist.",
    priority: 3,
    category: "application_workflow",
    completionCondition: "At least one non-sample application exists.",
    targetRoute: "/applications",
    workflowActionId: "record_application",
  },
};

function stageReason(plan: WorkflowPlan, key: WorkflowStageKey): string {
  return (
    plan.progress.stages.find((stage) => stage.key === key)?.reason ??
    "The workflow recommends this stage."
  );
}

function actionFromDefinition(
  definition: ActionDefinition,
  params: {
    reason: string;
    dueDate?: string | null;
    entityReference?: RecommendationEntityReference | null;
  },
): NextBestAction {
  return {
    actionId: definition.actionId,
    title: definition.title,
    description: definition.description,
    priority: definition.priority,
    category: definition.category,
    reason: params.reason,
    targetRoute: definition.targetRoute,
    completionCondition: definition.completionCondition,
    dueDate: params.dueDate ?? null,
    entityReference: params.entityReference ?? null,
    isAvailable: true,
  };
}

interface RankedAction {
  action: NextBestAction;
  urgencyRank: number;
  domainUrgencyRank: number;
}

function urgencyRank(action: NextBestAction, today: string): number {
  if (!action.dueDate) return 2;
  const diff = daysBetween(today, action.dueDate);
  if (diff < 0) return 0;
  return 1;
}

function domainUrgencyRank(action: NextBestAction): number {
  if (action.actionId === "P4-REVIEW-ARCHIVE") {
    return action.reason.includes("expired") ? 0 : 1;
  }
  if (action.actionId === "P4-UPDATE-STATUS") {
    const match = action.reason.match(/(\d+) days/);
    return match ? -Number(match[1]) : 0;
  }
  return 0;
}

function compareRanked(a: RankedAction, b: RankedAction): number {
  if (a.action.priority !== b.action.priority) {
    return a.action.priority - b.action.priority;
  }
  if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
  const dueA = a.action.dueDate ?? FAR_FUTURE_DATE;
  const dueB = b.action.dueDate ?? FAR_FUTURE_DATE;
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  if (a.domainUrgencyRank !== b.domainUrgencyRank) {
    return a.domainUrgencyRank - b.domainUrgencyRank;
  }
  return a.action.actionId.localeCompare(b.action.actionId);
}

/**
 * Build deterministic recommendations from a Stage 2 plan and minimal facts.
 * Identical inputs always produce identical output (passed `evaluatedAt`
 * included). No recommendation is produced twice or for an unavailable route.
 */
export function computeNextBestActions(
  plan: WorkflowPlan,
  facts: RecommendationFacts,
  options: NextBestActionOptions = {},
): NextBestActionResult {
  const availableRoutes = options.availableRoutes ?? DEFAULT_AVAILABLE_ROUTES;
  const availableWorkflowActions = new Set(
    plan.availableActions.map((action) => action.id),
  );
  const candidates: RankedAction[] = [];

  const add = (action: NextBestAction, definition?: ActionDefinition): void => {
    if (!isRouteAvailable(action.targetRoute, availableRoutes)) return;
    if (
      definition?.workflowActionId &&
      !availableWorkflowActions.has(definition.workflowActionId)
    ) {
      return;
    }
    candidates.push({
      action,
      urgencyRank: urgencyRank(action, facts.today),
      domainUrgencyRank: domainUrgencyRank(action),
    });
  };

  // Priority 1: time-sensitive follow-ups and interviews.
  for (const task of facts.followUps) {
    const diff = daysBetween(facts.today, task.dueOn);
    if (diff > FOLLOW_UP_DUE_WINDOW_DAYS) continue;
    const overdue = isFollowUpOverdue(task.dueOn, facts.today);
    const definition: ActionDefinition = {
      actionId: overdue ? "P1-OVERDUE-FOLLOWUP" : "P1-DUE-FOLLOWUP",
      title: overdue ? "Complete Overdue Follow-up" : "Complete Follow-up",
      description: `Follow up with the recruiter for ${task.title}.`,
      priority: 1,
      category: "time_sensitive",
      completionCondition: "The follow-up task status is done.",
      targetRoute: task.applicationId
        ? `/applications/${task.applicationId}?tab=followups`
        : "/dashboard",
      workflowActionId: "log_follow_up",
    };
    const reason = overdue
      ? `Overdue by ${Math.abs(diff)} day(s) (due ${task.dueOn}).`
      : diff === 0
        ? `Follow-up is due today (${task.dueOn}).`
        : `Follow-up is due in ${diff} day(s) (${task.dueOn}).`;
    add(
      actionFromDefinition(definition, {
        reason,
        dueDate: task.dueOn,
        entityReference: {
          type: "follow_up",
          id: task.id,
          code: task.appCode ?? undefined,
        },
      }),
      definition,
    );
  }

  for (const interview of facts.interviews) {
    const interviewDate = interview.startsAt.slice(0, 10);
    const diff = daysBetween(facts.today, interviewDate);
    if (diff < 0 || diff > UPCOMING_EVENT_WINDOW_DAYS) continue;
    const definition: ActionDefinition = {
      actionId: "P1-UPCOMING-INTERVIEW",
      title: "Prepare for Interview",
      description: `Prepare for the scheduled interview for ${interview.appCode}.`,
      priority: 1,
      category: "time_sensitive",
      completionCondition: "The interview status is completed.",
      targetRoute: `/applications/${interview.applicationId}?tab=interviews`,
      workflowActionId: "schedule_interview",
    };
    add(
      actionFromDefinition(definition, {
        reason:
          diff === 0
            ? `Interview is today (${interviewDate}).`
            : `Interview is in ${diff} day(s) (${interviewDate}).`,
        dueDate: interviewDate,
        entityReference: {
          type: "interview",
          id: interview.id,
          code: interview.appCode,
        },
      }),
      definition,
    );
  }

  for (const assessment of facts.assessments) {
    const definition: ActionDefinition = {
      actionId: "P1-PENDING-ASSESSMENT",
      title: "Complete Assessment",
      description: `Finish the pending assessment: ${assessment.title}.`,
      priority: 1,
      category: "time_sensitive",
      completionCondition: "The assessment result is no longer pending.",
      targetRoute: "/interviews",
      workflowActionId: "add_assessment",
    };
    add(
      actionFromDefinition(definition, {
        reason: assessment.dueDate
          ? `Assessment is pending with a recorded due date (${assessment.dueDate}).`
          : "Assessment is pending and has no recorded due date.",
        dueDate: assessment.dueDate,
        entityReference: {
          type: "assessment",
          id: assessment.id,
          code: assessment.appCode,
        },
      }),
      definition,
    );
  }

  for (const offer of facts.offers) {
    const definition: ActionDefinition = {
      actionId: "P1-OFFER-DECISION",
      title: "Review Job Offer",
      description: `Record a decision for the offer: ${offer.positionTitle}.`,
      priority: 1,
      category: "time_sensitive",
      completionCondition: "The offer decision is no longer pending.",
      targetRoute: `/applications/${offer.applicationId}`,
      workflowActionId: "record_offer",
    };
    add(
      actionFromDefinition(definition, {
        reason: offer.dueDate
          ? `Offer decision is pending with a recorded response deadline (${offer.dueDate}).`
          : "Offer decision is pending and has no recorded deadline.",
        dueDate: offer.dueDate,
        entityReference: {
          type: "offer",
          id: offer.id,
          code: offer.appCode,
        },
      }),
      definition,
    );
  }

  // Priorities 2 and 3: taken verbatim from Stage 2 recommendations.
  for (const key of plan.recommendedNextStages) {
    const definition = SETUP_AND_WORKFLOW_ACTIONS[key];
    if (!definition) continue;
    add(
      actionFromDefinition(definition, {
        reason: stageReason(plan, key),
        entityReference:
          key === "career_profile"
            ? { type: "career_profile", id: null }
            : null,
      }),
      definition,
    );
  }

  // Priority 4: maintenance, using existing domain urgency helpers' outputs.
  for (const review of facts.statusReviews) {
    const definition: ActionDefinition = {
      actionId: "P4-UPDATE-STATUS",
      title: "Update Application Status",
      description: `Review the silent application ${review.appCode}.`,
      priority: 4,
      category: "maintenance",
      completionCondition:
        "The application has new activity or is marked as no response.",
      targetRoute: `/applications/${review.applicationId}`,
    };
    add(
      actionFromDefinition(definition, {
        reason: `No employer activity for ${review.silentDays} days (existing no-response threshold reached).`,
        entityReference: {
          type: "application",
          id: review.applicationId,
          code: review.appCode,
        },
      }),
      definition,
    );
  }

  for (const review of facts.documentReviews) {
    const definition: ActionDefinition = {
      actionId: "P4-UPDATE-DOCUMENTS",
      title: "Update Documents",
      description: `Link a stored CV version to application ${review.appCode}.`,
      priority: 4,
      category: "maintenance",
      completionCondition: "The application references a CV version or document link.",
      targetRoute: `/applications/${review.applicationId}`,
    };
    add(
      actionFromDefinition(definition, {
        reason: "A CV exists but this application has no linked CV version.",
        entityReference: {
          type: "application",
          id: review.applicationId,
          code: review.appCode,
        },
      }),
      definition,
    );
  }

  for (const review of facts.archiveReviews) {
    const definition: ActionDefinition = {
      actionId: "P4-REVIEW-ARCHIVE",
      title: "Review Archive",
      description: "Review an archived application whose retention window is ending.",
      priority: 4,
      category: "maintenance",
      completionCondition: "Retention is reviewed or the archive is no longer expiring.",
      targetRoute: `/archive/${review.closureRecordId}`,
    };
    add(
      actionFromDefinition(definition, {
        reason:
          review.retentionState === "expired"
            ? "Archive retention has expired."
            : "Archive retention is expiring soon.",
        dueDate: review.retainUntil,
        entityReference: {
          type: "closure_record",
          id: review.closureRecordId,
          code: undefined,
        },
      }),
      definition,
    );
  }

  // Sort first, then deduplicate so the earliest/most urgent supporting record
  // wins for each action ID.
  candidates.sort(compareRanked);
  const seenActionIds = new Set<string>();
  const sorted = candidates
    .map((candidate) => candidate.action)
    .filter((action) => {
      if (seenActionIds.has(action.actionId)) return false;
      seenActionIds.add(action.actionId);
      return true;
    });
  const emptyStateReason =
    sorted.length === 0
      ? "All applicable workflow stages are complete and no time-sensitive or maintenance action is due."
      : null;

  return {
    primary: sorted[0] ?? null,
    secondary: sorted.slice(1),
    urgent: sorted.filter((action) => action.priority === 1),
    reasons: sorted.map((action) => ({
      actionId: action.actionId,
      reason: action.reason,
    })),
    progressContext: {
      completedStages: plan.progress.completedStages,
      recommendedNextStages: plan.recommendedNextStages,
      percentage: plan.progress.overall.percentage,
      progressCalculatedAt: plan.progress.calculatedAt,
    },
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
    emptyStateReason,
  };
}
