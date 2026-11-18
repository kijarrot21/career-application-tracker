import { and, asc, eq, lte } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applicationClosureRecords,
  applicationDocuments,
  applications,
  applicationStages,
  assessments,
  followUpTasks,
  interviews,
  jobOffers,
} from "@/db/schema";
import { evaluateRetentionState } from "@/lib/domain/archive";
import { addCalendarDays, todayInTimeZone } from "@/lib/domain/business-days";
import { evaluateNoResponseSuggestion } from "@/lib/domain/follow-ups";
import {
  FOLLOW_UP_DUE_WINDOW_DAYS,
  type ArchiveReviewFact,
  type AssessmentFact,
  type FollowUpFact,
  type InterviewFact,
  type OfferFact,
  type RecommendationFacts,
  type StatusReviewFact,
} from "@/lib/domain/recommendations";
import { getUserSettings } from "./settings";

/**
 * Reads only the records that can generate a time-sensitive or maintenance
 * recommendation. All selects are user-scoped and exclude sample data.
 */
export async function getRecommendationFacts(
  userId: string,
): Promise<RecommendationFacts> {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const [
    followUpRows,
    interviewRows,
    assessmentRows,
    offerRows,
    activeAppRows,
    cvLinkRows,
    closureRows,
  ] = await Promise.all([
    db
      .select({ task: followUpTasks, appCode: applications.code })
      .from(followUpTasks)
      .leftJoin(
        applications,
        and(
          eq(followUpTasks.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(
          eq(followUpTasks.userId, userId),
          eq(followUpTasks.status, "open"),
          eq(followUpTasks.isSample, false),
          lte(
            followUpTasks.dueOn,
            addCalendarDays(today, FOLLOW_UP_DUE_WINDOW_DAYS),
          ),
        ),
      )
      .orderBy(asc(followUpTasks.dueOn)),
    db
      .select({ interview: interviews, appCode: applications.code })
      .from(interviews)
      .innerJoin(
        applications,
        and(
          eq(interviews.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(
          eq(interviews.userId, userId),
          eq(interviews.status, "scheduled"),
          eq(interviews.isSample, false),
        ),
      )
      .orderBy(asc(interviews.startsAt)),
    db
      .select({ assessment: assessments, appCode: applications.code })
      .from(assessments)
      .innerJoin(
        applications,
        and(
          eq(assessments.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(
          eq(assessments.userId, userId),
          eq(assessments.result, "pending"),
          eq(applications.isSample, false),
        ),
      )
      .orderBy(asc(assessments.dueAt)),
    db
      .select({ offer: jobOffers, appCode: applications.code })
      .from(jobOffers)
      .innerJoin(
        applications,
        and(
          eq(jobOffers.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(
          eq(jobOffers.userId, userId),
          eq(jobOffers.decision, "pending"),
          eq(applications.isSample, false),
        ),
      )
      .orderBy(asc(jobOffers.responseDeadline)),
    db
      .select({
        id: applications.id,
        code: applications.code,
        outcome: applications.outcome,
        submittedOn: applications.submittedOn,
        lastActivityAt: applications.lastActivityAt,
        cvVersionId: applications.cvVersionId,
        stageType: applicationStages.stageType,
      })
      .from(applications)
      .innerJoin(
        applicationStages,
        and(
          eq(applications.currentStageId, applicationStages.id),
          eq(applicationStages.userId, userId),
        ),
      )
      .where(
        and(
          eq(applications.userId, userId),
          eq(applications.isSample, false),
          eq(applications.outcome, "active"),
        ),
      ),
    db
      .select({ applicationId: applicationDocuments.applicationId })
      .from(applicationDocuments)
      .where(
        and(
          eq(applicationDocuments.userId, userId),
          eq(applicationDocuments.role, "cv"),
        ),
      ),
    db
      .select({
        id: applicationClosureRecords.id,
        applicationId: applicationClosureRecords.applicationId,
        retainUntil: applicationClosureRecords.retainUntil,
      })
      .from(applicationClosureRecords)
      .where(
        and(
          eq(applicationClosureRecords.userId, userId),
          eq(applicationClosureRecords.status, "archived"),
          eq(applicationClosureRecords.isSample, false),
        ),
      ),
  ]);

  const followUpFacts: FollowUpFact[] = followUpRows.map((row) => ({
    id: row.task.id,
    title: row.task.title,
    dueOn: row.task.dueOn,
    applicationId: row.task.applicationId,
    appCode: row.appCode,
  }));

  const interviewFacts: InterviewFact[] = interviewRows.map((row) => ({
    id: row.interview.id,
    applicationId: row.interview.applicationId,
    appCode: row.appCode,
    startsAt: row.interview.startsAt.toISOString(),
  }));

  const assessmentFacts: AssessmentFact[] = assessmentRows.map((row) => ({
    id: row.assessment.id,
    applicationId: row.assessment.applicationId,
    appCode: row.appCode,
    title: row.assessment.title,
    dueDate: row.assessment.dueAt?.toISOString().slice(0, 10) ?? null,
  }));

  const offerFacts: OfferFact[] = offerRows.map((row) => ({
    id: row.offer.id,
    applicationId: row.offer.applicationId,
    appCode: row.appCode,
    positionTitle: row.offer.positionTitle,
    dueDate: row.offer.responseDeadline,
  }));

  const statusReviews: StatusReviewFact[] = [];
  const documentReviews: { applicationId: string; appCode: string }[] = [];
  const linkedApplicationIds = new Set(
    cvLinkRows.map((row) => row.applicationId),
  );

  for (const row of activeAppRows) {
    const suggestion = evaluateNoResponseSuggestion(
      {
        outcome: row.outcome,
        currentStageType: row.stageType,
        submittedOn: row.submittedOn,
        lastActivityOn: row.lastActivityAt.toISOString().slice(0, 10),
      },
      today,
      settings.noResponseDays,
    );
    if (suggestion.shouldSuggest) {
      statusReviews.push({
        applicationId: row.id,
        appCode: row.code,
        silentDays: suggestion.silentDays,
      });
    }
    if (!row.cvVersionId && !linkedApplicationIds.has(row.id)) {
      documentReviews.push({ applicationId: row.id, appCode: row.code });
    }
  }

  const archiveReviews: ArchiveReviewFact[] = closureRows.flatMap((row) => {
    const retentionState = evaluateRetentionState(row.retainUntil, today);
    if (retentionState !== "expiring_soon" && retentionState !== "expired") {
      return [];
    }
    return [
      {
        closureRecordId: row.id,
        applicationId: row.applicationId,
        retentionState,
        retainUntil: row.retainUntil,
      },
    ];
  });

  return {
    today,
    followUps: followUpFacts,
    interviews: interviewFacts,
    assessments: assessmentFacts,
    offers: offerFacts,
    statusReviews,
    documentReviews,
    archiveReviews,
  };
}
