import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applicationDocuments,
  applications,
  applicationStages,
  assessments,
  companies,
  documents,
  documentVersions,
  interviews,
  jobOffers,
  jobVacancies,
} from "@/db/schema";
import type { DocumentCategory } from "@/lib/constants";
import { getUserSettings } from "./settings";

export async function getInterviewsModuleData(userId: string) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);

  const interviewRows = await db
    .select({
      interview: interviews,
      app: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
    })
    .from(interviews)
    .innerJoin(
      applications,
      and(
        eq(interviews.applicationId, applications.id),
        eq(applications.userId, userId),
      ),
    )
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .leftJoin(applicationStages, eq(interviews.stageId, applicationStages.id))
    .where(eq(interviews.userId, userId))
    .orderBy(asc(interviews.startsAt));

  const assessmentRows = await db
    .select({
      assessment: assessments,
      app: applications,
      vacancy: jobVacancies,
      company: companies,
    })
    .from(assessments)
    .innerJoin(
      applications,
      and(
        eq(assessments.applicationId, applications.id),
        eq(applications.userId, userId),
      ),
    )
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(eq(assessments.userId, userId))
    .orderBy(asc(assessments.dueAt), desc(assessments.createdAt));

  const appOptions = await db
    .select({
      id: applications.id,
      code: applications.code,
      outcome: applications.outcome,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
      stageName: applicationStages.name,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .innerJoin(
      applicationStages,
      eq(applications.currentStageId, applicationStages.id),
    )
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  const scheduledCount = interviewRows.filter(
    (r) => r.interview.status === "scheduled",
  ).length;
  const completedCount = interviewRows.filter(
    (r) => r.interview.status === "completed",
  ).length;
  const passedCount = interviewRows.filter(
    (r) => r.interview.result === "passed",
  ).length;
  const decidedResultsCount = interviewRows.filter(
    (r) =>
      r.interview.result === "passed" || r.interview.result === "failed",
  ).length;
  const passRate =
    decidedResultsCount > 0
      ? Math.round((passedCount / decidedResultsCount) * 1000) / 10
      : null;

  const pendingAssessmentsCount = assessmentRows.filter(
    (a) => a.assessment.result === "pending",
  ).length;

  return {
    timezone: settings.timezone,
    metrics: {
      scheduledCount,
      completedCount,
      passedCount,
      passRate,
      pendingAssessmentsCount,
    },
    interviews: interviewRows.map((r) => ({
      ...r.interview,
      application: {
        id: r.app.id,
        code: r.app.code,
        jobTitle: r.vacancy.title,
        companyName: r.company.name,
        stageName: r.stage?.name ?? "Interview",
      },
    })),
    assessments: assessmentRows.map((r) => ({
      ...r.assessment,
      application: {
        id: r.app.id,
        code: r.app.code,
        jobTitle: r.vacancy.title,
        companyName: r.company.name,
      },
    })),
    applications: appOptions,
  };
}

export async function getDocumentsModuleData(
  userId: string,
  categoryFilter?: DocumentCategory | "all",
) {
  const db = await ensureDbReady();

  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        categoryFilter && categoryFilter !== "all"
          ? eq(documents.category, categoryFilter)
          : undefined,
      ),
    )
    .orderBy(desc(documents.updatedAt), desc(documents.createdAt));

  const docIds = docs.map((d) => d.id);
  const versions =
    docIds.length > 0
      ? await db
          .select()
          .from(documentVersions)
          .where(
            and(
              eq(documentVersions.userId, userId),
              inArray(documentVersions.documentId, docIds),
            ),
          )
          .orderBy(desc(documentVersions.versionNo))
      : [];

  const versionIds = versions.map((v) => v.id);
  const links =
    versionIds.length > 0
      ? await db
          .select({
            link: applicationDocuments,
            appCode: applications.code,
            appId: applications.id,
            jobTitle: jobVacancies.title,
            companyName: companies.name,
          })
          .from(applicationDocuments)
          .innerJoin(
            applications,
            eq(applicationDocuments.applicationId, applications.id),
          )
          .innerJoin(
            jobVacancies,
            eq(applications.vacancyId, jobVacancies.id),
          )
          .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
          .where(
            and(
              eq(applicationDocuments.userId, userId),
              inArray(applicationDocuments.documentVersionId, versionIds),
            ),
          )
      : [];

  const linksByVersion = new Map<string, typeof links>();
  for (const l of links) {
    const list = linksByVersion.get(l.link.documentVersionId) ?? [];
    list.push(l);
    linksByVersion.set(l.link.documentVersionId, list);
  }

  const versionsByDoc = new Map<
    string,
    (typeof versions[number] & { linkedApplications: typeof links })[]
  >();
  for (const v of versions) {
    const list = versionsByDoc.get(v.documentId) ?? [];
    list.push({
      ...v,
      linkedApplications: linksByVersion.get(v.id) ?? [],
    });
    versionsByDoc.set(v.documentId, list);
  }

  const appOptions = await db
    .select({
      id: applications.id,
      code: applications.code,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  return {
    documents: docs.map((d) => ({
      ...d,
      versions: versionsByDoc.get(d.id) ?? [],
    })),
    applications: appOptions,
  };
}

export async function getApplicationCareerExtras(
  userId: string,
  applicationId: string,
) {
  const db = await ensureDbReady();

  const appAssessments = await db
    .select()
    .from(assessments)
    .where(
      and(
        eq(assessments.userId, userId),
        eq(assessments.applicationId, applicationId),
      ),
    )
    .orderBy(desc(assessments.createdAt));

  const [offer] = await db
    .select()
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.userId, userId),
        eq(jobOffers.applicationId, applicationId),
      ),
    );

  const attachedDocs = await db
    .select({
      linkId: applicationDocuments.id,
      role: applicationDocuments.role,
      version: documentVersions,
      document: documents,
    })
    .from(applicationDocuments)
    .innerJoin(
      documentVersions,
      eq(applicationDocuments.documentVersionId, documentVersions.id),
    )
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(
      and(
        eq(applicationDocuments.userId, userId),
        eq(applicationDocuments.applicationId, applicationId),
      ),
    )
    .orderBy(desc(applicationDocuments.createdAt));

  const allVersions = await db
    .select({
      version: documentVersions,
      document: documents,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(eq(documentVersions.userId, userId))
    .orderBy(desc(documentVersions.createdAt));

  return {
    assessments: appAssessments,
    offer: offer ?? null,
    attachedDocuments: attachedDocs,
    availableVersions: allVersions,
  };
}
