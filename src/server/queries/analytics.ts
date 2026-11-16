import { asc, desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  applicationStatusHistory,
  companies,
  emailCommunications,
  interviews,
  jobOffers,
  jobSources,
  jobVacancies,
} from "@/db/schema";
import {
  computeCompanyResponseRates,
  computeIndustryDistribution,
  computeKpiSummary,
  computeMonthlyPerformance,
  computePipelineFunnel,
  computePlatformBreakdown,
  shouldIncludeSample,
  type KpiApplicationRecord,
} from "@/lib/domain/kpi";
import { getSampleDataStatus, getUserSettings, getUserStages } from "./settings";

export interface AnalyticsFilters {
  fromDate?: string;
  toDate?: string;
  sampleMode?: "auto" | "include" | "exclude";
}

export async function getAnalyticsData(
  userId: string,
  filters: AnalyticsFilters = {},
) {
  const db = await ensureDbReady();
  const [settings, stages, sampleStatus] = await Promise.all([
    getUserSettings(userId),
    getUserStages(userId, true),
    getSampleDataStatus(userId),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const vacancyRows = await db
    .select({
      id: jobVacancies.id,
      discoveredOn: jobVacancies.discoveredOn,
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
    .innerJoin(
      applicationStages,
      eq(applications.currentStageId, applicationStages.id),
    )
    .leftJoin(jobSources, eq(applications.platformSourceId, jobSources.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  const historyRows = await db
    .select()
    .from(applicationStatusHistory)
    .where(eq(applicationStatusHistory.userId, userId))
    .orderBy(
      asc(applicationStatusHistory.effectiveOn),
      asc(applicationStatusHistory.recordedAt),
    );

  const commsRows = await db
    .select()
    .from(emailCommunications)
    .where(eq(emailCommunications.userId, userId))
    .orderBy(asc(emailCommunications.occurredAt));

  const interviewRows = await db
    .select()
    .from(interviews)
    .where(eq(interviews.userId, userId))
    .orderBy(asc(interviews.startsAt));

  const offerRows = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId));

  const historyByApp = new Map<
    string,
    { toStageType: (typeof stages)[number]["stageType"]; effectiveOn: string }[]
  >();
  for (const h of historyRows) {
    const st = stageById.get(h.toStageId);
    if (!st) continue;
    const list = historyByApp.get(h.applicationId) ?? [];
    list.push({ toStageType: st.stageType, effectiveOn: h.effectiveOn });
    historyByApp.set(h.applicationId, list);
  }

  const firstInboundByApp = new Map<string, string>();
  for (const c of commsRows) {
    if (
      c.applicationId &&
      c.direction === "inbound" &&
      !firstInboundByApp.has(c.applicationId)
    ) {
      firstInboundByApp.set(
        c.applicationId,
        c.occurredAt.toISOString().slice(0, 10),
      );
    }
  }

  const offerByApp = new Map(
    offerRows.map((o) => [o.applicationId, o.decision]),
  );

  // Apply date-range filtering
  const filteredVacancies = vacancyRows.filter((v) => {
    if (filters.fromDate && v.discoveredOn < filters.fromDate) return false;
    if (filters.toDate && v.discoveredOn > filters.toDate) return false;
    return true;
  });

  const filteredAppRows = appRows.filter((r) => {
    if (filters.fromDate && r.application.submittedOn < filters.fromDate)
      return false;
    if (filters.toDate && r.application.submittedOn > filters.toDate)
      return false;
    return true;
  });

  const filteredAppIds = new Set(filteredAppRows.map((r) => r.application.id));
  const filteredInterviews = interviewRows.filter((i) =>
    filteredAppIds.has(i.applicationId),
  );

  const kpiApps: KpiApplicationRecord[] = filteredAppRows.map((r) => ({
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
    firstInboundCommunicationOn:
      firstInboundByApp.get(r.application.id) ?? null,
    offerDecision: offerByApp.get(r.application.id) ?? null,
  }));

  const sampleSetting =
    filters.sampleMode === "include"
      ? true
      : filters.sampleMode === "exclude"
        ? false
        : settings.includeSampleInAnalytics;

  const includeSample = shouldIncludeSample(kpiApps, sampleSetting);

  const kpi = computeKpiSummary({
    vacancies: filteredVacancies,
    applications: kpiApps,
    interviews: filteredInterviews.map((i) => ({
      id: i.id,
      applicationId: i.applicationId,
      startsAt: i.startsAt.toISOString(),
      status: i.status,
      isSample: i.isSample,
    })),
    includeSample,
  });

  const funnel = computePipelineFunnel(kpiApps, includeSample);
  const companyResponseRates = computeCompanyResponseRates(
    kpiApps,
    includeSample,
  );
  const platformDistribution = computePlatformBreakdown(kpiApps, includeSample);
  const industryDistribution = computeIndustryDistribution(
    kpiApps,
    includeSample,
  );
  const monthlyPerformance = computeMonthlyPerformance(kpiApps, includeSample);

  const activeSampleApps = includeSample
    ? filteredAppRows
    : filteredAppRows.filter((a) => !a.application.isSample);
  const activeSampleVacancies = includeSample
    ? filteredVacancies
    : filteredVacancies.filter((v) => !v.isSample);
  const appliedVacancyIds = new Set(
    activeSampleApps.map((a) => a.application.vacancyId),
  );

  const visibleStages = stages.filter((s) => !s.isHidden);
  const applicationsByStage = visibleStages.map((s) => {
    if (s.stageType === "sourced") {
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        count: activeSampleVacancies.filter(
          (v) => !appliedVacancyIds.has(v.id) && v.triageStatus === "new",
        ).length,
      };
    }
    if (s.stageType === "interested") {
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        count: activeSampleVacancies.filter(
          (v) =>
            !appliedVacancyIds.has(v.id) &&
            (v.triageStatus === "interested" ||
              v.triageStatus === "shortlisted"),
        ).length,
      };
    }
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      count: activeSampleApps.filter(
        (a) => a.application.currentStageId === s.id,
      ).length,
    };
  });

  const outcomeDistribution = [
    { name: "Active", key: "active", value: kpi.activeApplications },
    {
      name: "Successful (Hired)",
      key: "successful",
      value: kpi.successfulApplications,
    },
    { name: "Rejected", key: "unsuccessful", value: kpi.rejectedApplications },
    { name: "Withdrawn", key: "withdrawn", value: kpi.withdrawnApplications },
    {
      name: "No Response",
      key: "no_response",
      value: kpi.noResponseApplications,
    },
  ].filter((d) => d.value > 0);

  return {
    filters: {
      fromDate: filters.fromDate ?? "",
      toDate: filters.toDate ?? "",
      sampleMode: filters.sampleMode ?? "auto",
    },
    sampleStatus,
    includeSample,
    kpi,
    funnel,
    applicationsByStage,
    outcomeDistribution,
    companyResponseRates,
    platformDistribution,
    industryDistribution,
    monthlyPerformance,
  };
}
