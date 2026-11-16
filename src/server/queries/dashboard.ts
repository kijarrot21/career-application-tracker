import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
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
import { isFollowUpOverdue } from "@/lib/domain/follow-ups";
import {
  computeKpiSummary,
  computePipelineFunnel,
  shouldIncludeSample,
  type KpiApplicationRecord,
} from "@/lib/domain/kpi";
import { getSampleDataStatus, getUserSettings, getUserStages } from "./settings";

export async function getDashboardData(userId: string) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const stages = await getUserStages(userId, true);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const sampleStatus = await getSampleDataStatus(userId);
  const today = todayInTimeZone(settings.timezone);

  const vacancyRows = await db
    .select({
      id: jobVacancies.id,
      triageStatus: jobVacancies.triageStatus,
      isSample: jobVacancies.isSample,
    })
    .from(jobVacancies)
    .where(eq(jobVacancies.userId, userId));

  const appRows = await db
    .select({
      application: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
      platform: jobSources,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .innerJoin(applicationStages, eq(applications.currentStageId, applicationStages.id))
    .leftJoin(jobSources, eq(applications.platformSourceId, jobSources.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt));

  const historyRows = await db
    .select()
    .from(applicationStatusHistory)
    .where(eq(applicationStatusHistory.userId, userId))
    .orderBy(asc(applicationStatusHistory.effectiveOn), asc(applicationStatusHistory.recordedAt));

  const commsRows = await db
    .select()
    .from(emailCommunications)
    .where(eq(emailCommunications.userId, userId))
    .orderBy(asc(emailCommunications.occurredAt));

  const interviewRows = await db
    .select({
      interview: interviews,
      appCode: applications.code,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
    })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(eq(interviews.userId, userId))
    .orderBy(asc(interviews.startsAt));

  const offerRows = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId));

  const followUpRows = await db
    .select({
      task: followUpTasks,
      appCode: applications.code,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
    })
    .from(followUpTasks)
    .leftJoin(applications, eq(followUpTasks.applicationId, applications.id))
    .leftJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .leftJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(and(eq(followUpTasks.userId, userId), eq(followUpTasks.status, "open")))
    .orderBy(asc(followUpTasks.dueOn));

  const historyByApp = new Map<string, { toStageType: typeof stages[number]["stageType"]; effectiveOn: string }[]>();
  for (const h of historyRows) {
    const st = stageById.get(h.toStageId);
    if (!st) continue;
    const list = historyByApp.get(h.applicationId) ?? [];
    list.push({ toStageType: st.stageType, effectiveOn: h.effectiveOn });
    historyByApp.set(h.applicationId, list);
  }

  const firstInboundByApp = new Map<string, string>();
  for (const c of commsRows) {
    if (c.applicationId && c.direction === "inbound" && !firstInboundByApp.has(c.applicationId)) {
      firstInboundByApp.set(c.applicationId, c.occurredAt.toISOString().slice(0, 10));
    }
  }

  const offerByApp = new Map(offerRows.map((o) => [o.applicationId, o.decision]));

  const kpiApps: KpiApplicationRecord[] = appRows.map((r) => ({
    id: r.application.id,
    submittedOn: r.application.submittedOn,
    outcome: r.application.outcome,
    currentStageType: r.stage.stageType,
    closedAt: r.application.closedAt,
    platformName: r.platform?.name ?? "Direct / Other",
    industry: r.vacancy.industry ?? r.company.industry ?? "Unspecified",
    companyName: r.company.name,
    isSample: r.application.isSample,
    history: historyByApp.get(r.application.id) ?? [],
    firstInboundCommunicationOn: firstInboundByApp.get(r.application.id) ?? null,
    offerDecision: offerByApp.get(r.application.id) ?? null,
  }));

  const includeSample = shouldIncludeSample(kpiApps, settings.includeSampleInAnalytics);
  const kpi = computeKpiSummary({
    vacancies: vacancyRows,
    applications: kpiApps,
    interviews: interviewRows.map((i) => ({
      id: i.interview.id,
      applicationId: i.interview.applicationId,
      startsAt: i.interview.startsAt.toISOString(),
      status: i.interview.status,
      isSample: i.interview.isSample,
    })),
    includeSample,
  });

  const funnel = computePipelineFunnel(kpiApps, includeSample);

  const filteredApps = includeSample
    ? appRows
    : appRows.filter((a) => !a.application.isSample);
  const filteredVacancies = includeSample
    ? vacancyRows
    : vacancyRows.filter((v) => !v.isSample);

  const appliedVacancyIds = new Set(filteredApps.map((a) => a.application.vacancyId));

  // Stage distribution across visible pipeline stages
  const visibleStages = stages.filter((s) => !s.isHidden);
  const stageBreakdown = visibleStages.map((s) => {
    if (s.stageType === "sourced") {
      const count = filteredVacancies.filter(
        (v) => !appliedVacancyIds.has(v.id) && v.triageStatus === "new",
      ).length;
      return { id: s.id, name: s.name, color: s.color, stageType: s.stageType, count };
    }
    if (s.stageType === "interested") {
      const count = filteredVacancies.filter(
        (v) =>
          !appliedVacancyIds.has(v.id) &&
          (v.triageStatus === "interested" || v.triageStatus === "shortlisted"),
      ).length;
      return { id: s.id, name: s.name, color: s.color, stageType: s.stageType, count };
    }
    const count = filteredApps.filter((a) => a.application.currentStageId === s.id).length;
    return { id: s.id, name: s.name, color: s.color, stageType: s.stageType, count };
  });

  // Activity over time (grouped by week/month of submission)
  const activityByMonthMap = new Map<string, { period: string; applications: number }>();
  for (const a of filteredApps) {
    const month = a.application.submittedOn.slice(0, 7); // YYYY-MM
    const cur = activityByMonthMap.get(month) ?? { period: month, applications: 0 };
    cur.applications++;
    activityByMonthMap.set(month, cur);
  }
  const activityOverTime = [...activityByMonthMap.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );

  // Outcome breakdown for chart
  const outcomeDistribution = [
    { name: "Active", key: "active", value: kpi.activeApplications },
    { name: "Successful (Hired)", key: "successful", value: kpi.successfulApplications },
    { name: "Rejected", key: "unsuccessful", value: kpi.rejectedApplications },
    { name: "Withdrawn", key: "withdrawn", value: kpi.withdrawnApplications },
    { name: "No Response", key: "no_response", value: kpi.noResponseApplications },
  ].filter((d) => d.value > 0);

  // Recent stage transitions
  const appMetaById = new Map(
    appRows.map((r) => [
      r.application.id,
      {
        id: r.application.id,
        code: r.application.code,
        jobTitle: r.vacancy.title,
        companyName: r.company.name,
        isSample: r.application.isSample,
      },
    ]),
  );

  const recentActivity = [...historyRows]
    .reverse()
    .slice(0, 8)
    .map((h) => ({
      id: h.id,
      applicationId: h.applicationId,
      effectiveOn: h.effectiveOn,
      source: h.source,
      reason: h.reason,
      fromStageName: h.fromStageId ? (stageById.get(h.fromStageId)?.name ?? null) : null,
      toStageName: stageById.get(h.toStageId)?.name ?? "Stage",
      toStageColor: stageById.get(h.toStageId)?.color ?? "slate",
      app: appMetaById.get(h.applicationId) ?? null,
    }))
    .filter((item) => item.app !== null);

  const upcomingInterviews = interviewRows
    .filter((i) => i.interview.status === "scheduled")
    .slice(0, 6)
    .map((i) => ({
      ...i.interview,
      appCode: i.appCode,
      jobTitle: i.jobTitle,
      companyName: i.companyName,
    }));

  const pendingFollowUps = followUpRows.slice(0, 8).map((f) => ({
    ...f.task,
    appCode: f.appCode,
    jobTitle: f.jobTitle,
    companyName: f.companyName,
    isOverdue: isFollowUpOverdue(f.task.dueOn, today),
  }));

  return {
    settings,
    sampleStatus,
    includeSample,
    kpi,
    funnel,
    stageBreakdown,
    activityOverTime,
    outcomeDistribution,
    recentActivity,
    upcomingInterviews,
    pendingFollowUps,
  };
}

export async function searchGlobal(userId: string, query: string) {
  const db = await ensureDbReady();
  const q = query.trim();
  if (!q) return { vacancies: [], applications: [] };

  const vacs = await db
    .select({
      id: jobVacancies.id,
      code: jobVacancies.code,
      title: jobVacancies.title,
      companyName: companies.name,
    })
    .from(jobVacancies)
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(
      and(
        eq(jobVacancies.userId, userId),
        or(
          ilike(jobVacancies.title, `%${q}%`),
          ilike(companies.name, `%${q}%`),
          ilike(jobVacancies.code, `%${q}%`),
        ),
      ),
    )
    .limit(8);

  const apps = await db
    .select({
      id: applications.id,
      code: applications.code,
      title: jobVacancies.title,
      companyName: companies.name,
      stageName: applicationStages.name,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .innerJoin(applicationStages, eq(applications.currentStageId, applicationStages.id))
    .where(
      and(
        eq(applications.userId, userId),
        or(
          ilike(jobVacancies.title, `%${q}%`),
          ilike(companies.name, `%${q}%`),
          ilike(applications.code, `%${q}%`),
        ),
      ),
    )
    .limit(8);

  return { vacancies: vacs, applications: apps };
}
