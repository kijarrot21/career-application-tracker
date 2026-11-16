import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  applicationStatusHistory,
  companies,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobSources,
  jobVacancies,
} from "@/db/schema";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { evaluateNoResponseSuggestion } from "@/lib/domain/follow-ups";
import type { Outcome } from "@/lib/domain/stages";
import { getUserSettings, getUserStages } from "./settings";

export interface ApplicationFilters {
  search?: string;
  stageId?: string | "all";
  outcome?: Outcome | "all";
  platformSourceId?: string | "all";
  companyId?: string | "all";
  fromDate?: string;
  toDate?: string;
}

export async function listApplications(
  userId: string,
  filters: ApplicationFilters = {},
) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const rows = await db
    .select({
      application: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
      platform: jobSources,
    })
    .from(applications)
    .innerJoin(
      jobVacancies,
      and(eq(applications.vacancyId, jobVacancies.id), eq(jobVacancies.userId, userId)),
    )
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .innerJoin(
      applicationStages,
      and(
        eq(applications.currentStageId, applicationStages.id),
        eq(applicationStages.userId, userId),
      ),
    )
    .leftJoin(jobSources, eq(applications.platformSourceId, jobSources.id))
    .where(
      and(
        eq(applications.userId, userId),
        filters.stageId && filters.stageId !== "all"
          ? eq(applications.currentStageId, filters.stageId)
          : undefined,
        filters.outcome && filters.outcome !== "all"
          ? eq(applications.outcome, filters.outcome)
          : undefined,
        filters.platformSourceId && filters.platformSourceId !== "all"
          ? eq(applications.platformSourceId, filters.platformSourceId)
          : undefined,
        filters.companyId && filters.companyId !== "all"
          ? eq(companies.id, filters.companyId)
          : undefined,
        filters.search
          ? or(
              ilike(jobVacancies.title, `%${filters.search}%`),
              ilike(companies.name, `%${filters.search}%`),
              ilike(applications.code, `%${filters.search}%`),
              ilike(applications.recruiterName, `%${filters.search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(applications.submittedOn), desc(applications.updatedAt));

  const filtered = rows.filter((r) => {
    if (filters.fromDate && r.application.submittedOn < filters.fromDate) return false;
    if (filters.toDate && r.application.submittedOn > filters.toDate) return false;
    return true;
  });

  // Fetch upcoming interview per application
  const appIds = filtered.map((r) => r.application.id);
  const upcomingIntRows =
    appIds.length > 0
      ? await db
          .select()
          .from(interviews)
          .where(
            and(
              eq(interviews.userId, userId),
              inArray(interviews.applicationId, appIds),
              eq(interviews.status, "scheduled"),
            ),
          )
          .orderBy(asc(interviews.startsAt))
      : [];

  const nextInterviewByApp = new Map<string, (typeof upcomingIntRows)[number]>();
  for (const intv of upcomingIntRows) {
    if (!nextInterviewByApp.has(intv.applicationId)) {
      nextInterviewByApp.set(intv.applicationId, intv);
    }
  }

  return filtered.map((r) => {
    const lastActivityIso = r.application.lastActivityAt
      .toISOString()
      .slice(0, 10);
    const noResponseSuggestion = evaluateNoResponseSuggestion(
      {
        outcome: r.application.outcome,
        currentStageType: r.stage.stageType,
        submittedOn: r.application.submittedOn,
        lastActivityOn: lastActivityIso,
      },
      today,
      settings.noResponseDays,
    );

    return {
      ...r.application,
      vacancy: r.vacancy,
      company: r.company,
      stage: r.stage,
      platform: r.platform,
      nextInterview: nextInterviewByApp.get(r.application.id) ?? null,
      noResponseSuggestion,
    };
  });
}

export async function getKanbanBoardData(userId: string, filters: ApplicationFilters = {}) {
  const db = await ensureDbReady();
  const stages = await getUserStages(userId, false);
  const appItems = await listApplications(userId, filters);

  // Unapplied vacancies for Sourced (triageStatus = 'new') and Interested ('interested' | 'shortlisted')
  const appliedVacancyIds = new Set(appItems.map((a) => a.vacancyId));
  const vacancyRows = await db
    .select({
      vacancy: jobVacancies,
      company: companies,
      source: jobSources,
    })
    .from(jobVacancies)
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .leftJoin(jobSources, eq(jobVacancies.sourceId, jobSources.id))
    .where(eq(jobVacancies.userId, userId))
    .orderBy(desc(jobVacancies.discoveredOn));

  const unappliedVacancies = vacancyRows
    .filter((v) => !appliedVacancyIds.has(v.vacancy.id))
    .filter((v) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          v.vacancy.title.toLowerCase().includes(q) ||
          v.company.name.toLowerCase().includes(q) ||
          v.vacancy.code.toLowerCase().includes(q);
        if (!match) return false;
      }
      return (
        v.vacancy.triageStatus === "new" ||
        v.vacancy.triageStatus === "interested" ||
        v.vacancy.triageStatus === "shortlisted"
      );
    })
    .map((v) => ({
      ...v.vacancy,
      company: v.company,
      source: v.source,
    }));

  return {
    stages,
    applications: appItems,
    unappliedVacancies,
  };
}

export async function getApplicationDetail(userId: string, applicationId: string) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const [row] = await db
    .select({
      application: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
      platform: jobSources,
    })
    .from(applications)
    .innerJoin(
      jobVacancies,
      and(eq(applications.vacancyId, jobVacancies.id), eq(jobVacancies.userId, userId)),
    )
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .innerJoin(
      applicationStages,
      and(
        eq(applications.currentStageId, applicationStages.id),
        eq(applicationStages.userId, userId),
      ),
    )
    .leftJoin(jobSources, eq(applications.platformSourceId, jobSources.id))
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));

  if (!row) return null;

  const allStages = await getUserStages(userId, true);
  const stageMap = new Map(allStages.map((s) => [s.id, s]));

  const historyRows = await db
    .select()
    .from(applicationStatusHistory)
    .where(
      and(
        eq(applicationStatusHistory.userId, userId),
        eq(applicationStatusHistory.applicationId, applicationId),
      ),
    )
    .orderBy(
      desc(applicationStatusHistory.effectiveOn),
      desc(applicationStatusHistory.recordedAt),
    );

  const history = historyRows.map((h) => ({
    ...h,
    fromStage: h.fromStageId ? (stageMap.get(h.fromStageId) ?? null) : null,
    toStage: stageMap.get(h.toStageId)!,
  }));

  const comms = await db
    .select()
    .from(emailCommunications)
    .where(
      and(
        eq(emailCommunications.userId, userId),
        eq(emailCommunications.applicationId, applicationId),
      ),
    )
    .orderBy(desc(emailCommunications.occurredAt));

  const interviewRows = await db
    .select()
    .from(interviews)
    .where(
      and(
        eq(interviews.userId, userId),
        eq(interviews.applicationId, applicationId),
      ),
    )
    .orderBy(desc(interviews.startsAt));

  const followUps = await db
    .select()
    .from(followUpTasks)
    .where(
      and(
        eq(followUpTasks.userId, userId),
        eq(followUpTasks.applicationId, applicationId),
      ),
    )
    .orderBy(asc(followUpTasks.status), asc(followUpTasks.dueOn));

  const [offer] = await db
    .select()
    .from(jobOffers)
    .where(
      and(eq(jobOffers.userId, userId), eq(jobOffers.applicationId, applicationId)),
    );

  const lastActivityIso = row.application.lastActivityAt.toISOString().slice(0, 10);
  const noResponseSuggestion = evaluateNoResponseSuggestion(
    {
      outcome: row.application.outcome,
      currentStageType: row.stage.stageType,
      submittedOn: row.application.submittedOn,
      lastActivityOn: lastActivityIso,
    },
    today,
    settings.noResponseDays,
  );

  return {
    ...row.application,
    vacancy: row.vacancy,
    company: row.company,
    stage: row.stage,
    platform: row.platform,
    allStages: allStages.filter((s) => !s.isHidden),
    history,
    communications: comms,
    interviews: interviewRows,
    followUps,
    offer: offer ?? null,
    noResponseSuggestion,
  };
}
