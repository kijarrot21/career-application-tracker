import { and, count, eq, inArray, isNotNull, ne, notInArray } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applicationClosureRecords,
  applications,
  applicationStatusHistory,
  assessments,
  careerCertifications,
  careerEducations,
  careerExperiences,
  careerProfiles,
  careerProjects,
  careerSkills,
  documentVersions,
  documents,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobVacancies,
  suitabilityEvaluations,
} from "@/db/schema";
import {
  computeProfileCompletion,
  type ProfileCompletionResult,
} from "@/lib/domain/career-profile";

/** Minimal, user-scoped facts used by progress detection. */
export interface ProgressFacts {
  profileId: string | null;
  profileCompletion: ProfileCompletionResult;
  cvVersionIds: string[];
  vacancyIds: string[];
  evaluationIds: string[];
  shortlistVacancyIds: string[];
  applicationIds: string[];
  trackingRecordIds: string[];
  outcomeRecordIds: string[];
}

function prefixedIds(prefix: string, rows: readonly { id: string }[]): string[] {
  return rows.map((row) => `${prefix}:${row.id}`);
}

/**
 * Reads only the records that can support a workflow stage result. Every
 * select is scoped to `userId`; joined tables are scoped inside the join
 * predicate as well. Sample records are excluded because demo data is not
 * actual user progress.
 */
export async function getProgressFacts(userId: string): Promise<ProgressFacts> {
  const db = await ensureDbReady();

  const [
    profileRow,
    experienceCount,
    educationCount,
    verifiedSkillCount,
    certificationCount,
    projectCount,
    cvVersionRows,
    vacancyRows,
    evaluationRows,
    applicationRows,
    historyRows,
    interviewRows,
    assessmentRows,
    followUpRows,
    emailRows,
    offerRows,
    closureRows,
  ] = await Promise.all([
    db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ value: count() })
      .from(careerExperiences)
      .where(eq(careerExperiences.userId, userId)),
    db
      .select({ value: count() })
      .from(careerEducations)
      .where(eq(careerEducations.userId, userId)),
    db
      .select({ value: count() })
      .from(careerSkills)
      .where(
        and(
          eq(careerSkills.userId, userId),
          eq(careerSkills.isUserVerified, true),
          eq(careerSkills.verificationStatus, "verified"),
        ),
      ),
    db
      .select({ value: count() })
      .from(careerCertifications)
      .where(eq(careerCertifications.userId, userId)),
    db
      .select({ value: count() })
      .from(careerProjects)
      .where(eq(careerProjects.userId, userId)),
    db
      .select({ id: documentVersions.id })
      .from(documentVersions)
      .innerJoin(
        documents,
        and(
          eq(documentVersions.documentId, documents.id),
          eq(documents.userId, userId),
        ),
      )
      .where(
        and(
          eq(documentVersions.userId, userId),
          eq(documents.isSample, false),
          inArray(documents.category, ["master_cv", "custom_cv"]),
          isNotNull(documentVersions.storageKey),
        ),
      ),
    db
      .select({ id: jobVacancies.id, triageStatus: jobVacancies.triageStatus })
      .from(jobVacancies)
      .where(
        and(eq(jobVacancies.userId, userId), eq(jobVacancies.isSample, false)),
      ),
    db
      .select({ id: suitabilityEvaluations.id })
      .from(suitabilityEvaluations)
      .innerJoin(
        jobVacancies,
        and(
          eq(suitabilityEvaluations.vacancyId, jobVacancies.id),
          eq(jobVacancies.userId, userId),
        ),
      )
      .where(
        and(
          eq(suitabilityEvaluations.userId, userId),
          eq(jobVacancies.isSample, false),
          isNotNull(suitabilityEvaluations.overallScore),
        ),
      ),
    db
      .select({
        id: applications.id,
        outcome: applications.outcome,
        closedAt: applications.closedAt,
      })
      .from(applications)
      .where(
        and(eq(applications.userId, userId), eq(applications.isSample, false)),
      ),
    db
      .select({ id: applicationStatusHistory.id })
      .from(applicationStatusHistory)
      .innerJoin(
        applications,
        and(
          eq(applicationStatusHistory.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(
          eq(applicationStatusHistory.userId, userId),
          eq(applications.isSample, false),
          notInArray(applicationStatusHistory.source, ["submission", "sample"]),
        ),
      ),
    db
      .select({ id: interviews.id })
      .from(interviews)
      .where(
        and(eq(interviews.userId, userId), eq(interviews.isSample, false)),
      ),
    db
      .select({ id: assessments.id })
      .from(assessments)
      .innerJoin(
        applications,
        and(
          eq(assessments.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(eq(assessments.userId, userId), eq(applications.isSample, false)),
      ),
    db
      .select({ id: followUpTasks.id })
      .from(followUpTasks)
      .where(
        and(
          eq(followUpTasks.userId, userId),
          eq(followUpTasks.status, "done"),
          eq(followUpTasks.isSample, false),
        ),
      ),
    db
      .select({ id: emailCommunications.id })
      .from(emailCommunications)
      .where(
        and(
          eq(emailCommunications.userId, userId),
          eq(emailCommunications.isSample, false),
          isNotNull(emailCommunications.applicationId),
          ne(emailCommunications.classification, "not_recruitment"),
        ),
      ),
    db
      .select({ id: jobOffers.id })
      .from(jobOffers)
      .innerJoin(
        applications,
        and(
          eq(jobOffers.applicationId, applications.id),
          eq(applications.userId, userId),
        ),
      )
      .where(
        and(eq(jobOffers.userId, userId), eq(applications.isSample, false)),
      ),
    db
      .select({ id: applicationClosureRecords.id })
      .from(applicationClosureRecords)
      .where(
        and(
          eq(applicationClosureRecords.userId, userId),
          eq(applicationClosureRecords.status, "archived"),
          eq(applicationClosureRecords.isSample, false),
        ),
      ),
  ]);

  const profileCompletion = computeProfileCompletion({
    profile: profileRow,
    experiencesCount: Number(experienceCount[0]?.value ?? 0),
    educationsCount: Number(educationCount[0]?.value ?? 0),
    verifiedSkillsCount: Number(verifiedSkillCount[0]?.value ?? 0),
    certificationsCount: Number(certificationCount[0]?.value ?? 0),
    projectsCount: Number(projectCount[0]?.value ?? 0),
  });

  const shortlistVacancyIds = vacancyRows.filter(
    (v) => v.triageStatus === "shortlisted" || v.triageStatus === "interested",
  );

  const closedApplicationIds = applicationRows.filter(
    (a) => a.outcome !== "active" || a.closedAt != null,
  );

  return {
    profileId: profileRow?.id ?? null,
    profileCompletion,
    cvVersionIds: prefixedIds("cv_version", cvVersionRows),
    vacancyIds: prefixedIds("vacancy", vacancyRows),
    evaluationIds: prefixedIds("evaluation", evaluationRows),
    shortlistVacancyIds: prefixedIds("vacancy", shortlistVacancyIds),
    applicationIds: prefixedIds("application", applicationRows),
    trackingRecordIds: [
      ...prefixedIds("history", historyRows),
      ...prefixedIds("interview", interviewRows),
      ...prefixedIds("assessment", assessmentRows),
      ...prefixedIds("follow_up", followUpRows),
      ...prefixedIds("email", emailRows),
    ],
    outcomeRecordIds: [
      ...prefixedIds("offer", offerRows),
      ...prefixedIds("application", closedApplicationIds),
      ...prefixedIds("closure", closureRows),
    ],
  };
}
