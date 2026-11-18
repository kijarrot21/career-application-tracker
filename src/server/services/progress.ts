import {
  aggregateProgress,
  WORKFLOW_STAGES,
  type ProgressSnapshot,
  type StageEvaluationInput,
  type StageEvidence,
  type WorkflowStageKey,
} from "@/lib/domain/progress";
import { requireUser } from "@/lib/session";
import {
  getProgressFacts,
  type ProgressFacts,
} from "@/server/queries/progress";

function stageEvidence(
  recordIds: string[],
  summary: string,
): StageEvidence {
  return { recordIds, summary };
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Completion criteria for a single stage, evaluated from previously fetched facts. */
function evaluateStage(
  key: WorkflowStageKey,
  facts: ProgressFacts,
): StageEvaluationInput {
  switch (key) {
    case "career_profile": {
      const completion = facts.profileCompletion;
      return {
        key,
        isApplicable: true,
        isComplete: completion.isReadyForAi,
        reason: completion.isReadyForAi
          ? "Career profile passes the existing isReadyForAi rule."
          : "Career profile is not ready for AI yet (professional info, one experience, and three verified skills are required).",
        evidence: stageEvidence(
          facts.profileId ? [facts.profileId] : [],
          `${completion.completedCount}/${completion.totalCount} profile sections complete (${completion.percentage}%).`,
        ),
      };
    }
    case "cv_upload": {
      const count = facts.cvVersionIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "valid stored CV", "valid stored CVs")} found.`
            : "No stored CV version with a file key was found.",
        evidence: stageEvidence(
          facts.cvVersionIds,
          countLabel(count, "CV version", "CV versions"),
        ),
      };
    }
    case "job_discovery": {
      const count = facts.vacancyIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "saved vacancy", "saved vacancies")} found.`
            : "No saved vacancy was found.",
        evidence: stageEvidence(
          facts.vacancyIds,
          countLabel(count, "vacancy", "vacancies"),
        ),
      };
    }
    case "suitability_evaluation": {
      const count = facts.evaluationIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "scored evaluation", "scored evaluations")} found.`
            : "No scored suitability evaluation was found.",
        evidence: stageEvidence(
          facts.evaluationIds,
          countLabel(count, "evaluation", "evaluations"),
        ),
      };
    }
    case "shortlist": {
      const count = facts.shortlistVacancyIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "shortlisted vacancy", "shortlisted vacancies")} found.`
            : "No shortlisted or interested vacancy was found.",
        evidence: stageEvidence(
          facts.shortlistVacancyIds,
          countLabel(count, "shortlist record", "shortlist records"),
        ),
      };
    }
    case "job_application": {
      const count = facts.applicationIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "application", "applications")} found.`
            : "No application was found.",
        evidence: stageEvidence(
          facts.applicationIds,
          countLabel(count, "application", "applications"),
        ),
      };
    }
    case "recruitment_tracking": {
      const count = facts.trackingRecordIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "tracking activity record", "tracking activity records")} found.`
            : "No stage transition, interview, assessment, completed follow-up, or linked recruitment email was found.",
        evidence: stageEvidence(
          facts.trackingRecordIds,
          countLabel(count, "tracking record", "tracking records"),
        ),
      };
    }
    case "offers_outcomes": {
      const count = facts.outcomeRecordIds.length;
      return {
        key,
        isApplicable: true,
        isComplete: count > 0,
        reason:
          count > 0
            ? `${countLabel(count, "offer or outcome record", "offer or outcome records")} found.`
            : "No offer, completed application, or active archive record was found.",
        evidence: stageEvidence(
          facts.outcomeRecordIds,
          countLabel(count, "outcome record", "outcome records"),
        ),
      };
    }
  }
}

/**
 * Derive a user's workflow progress entirely from their own business records.
 * The result is not persisted: every call recalculates from source data.
 */
export async function detectProgress(userId: string): Promise<ProgressSnapshot> {
  const facts = await getProgressFacts(userId);
  const evaluations = WORKFLOW_STAGES.map((stage) =>
    evaluateStage(stage.key, facts),
  );
  return aggregateProgress(evaluations, new Date().toISOString());
}

/** Convenience wrapper for server pages and actions. */
export async function getProgressForCurrentUser(): Promise<ProgressSnapshot> {
  const user = await requireUser();
  return detectProgress(user.id);
}
