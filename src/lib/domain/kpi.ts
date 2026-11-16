/**
 * Recruitment performance KPIs and conversion calculations.
 *
 * All metrics are computed strictly from actual records.
 * Withdrawn applications are excluded from conversion denominators where
 * appropriate so voluntary withdrawal does not artificially depress conversion.
 * When a denominator is zero, rates return `null` ("Not enough data").
 */

import { daysBetween } from "./business-days";
import type { Outcome, StageType } from "./stages";

export interface KpiHistoryEntry {
  toStageType: StageType;
  effectiveOn: string; // YYYY-MM-DD
}

export interface KpiApplicationRecord {
  id: string;
  submittedOn: string; // YYYY-MM-DD
  outcome: Outcome;
  currentStageType: StageType;
  closedAt: string | null;
  platformName: string | null;
  industry: string | null;
  companyName: string;
  isSample: boolean;
  history: KpiHistoryEntry[];
  firstInboundCommunicationOn?: string | null;
  offerDecision?: "pending" | "accepted" | "declined" | "rescinded" | null;
}

export interface KpiVacancyRecord {
  id: string;
  isSample: boolean;
}

export interface KpiInterviewRecord {
  id: string;
  applicationId: string;
  startsAt: string; // ISO
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  isSample: boolean;
}

export interface KpiSummary {
  // Primary 10 KPIs
  totalJobsDiscovered: number;
  totalApplicationsSubmitted: number;
  activeApplications: number;
  applicationsUnderScreening: number;
  interviewsScheduled: number;
  offersReceived: number;
  successfulApplications: number;
  rejectedApplications: number;
  withdrawnApplications: number;
  noResponseApplications: number;
  // Conversion & cycle metrics (0-100 percentage, or null if denominator is 0)
  applicationToInterviewRate: number | null;
  interviewToOfferRate: number | null;
  offerAcceptanceRate: number | null;
  overallSuccessRate: number | null;
  averageTimeToFirstResponseDays: number | null;
  averageTimeToInterviewDays: number | null;
  averageRecruitmentCycleDays: number | null;
  // Denominator transparency
  denominators: {
    eligibleForInterviewRate: number;
    reachedInterviewCount: number;
    eligibleForOfferRate: number;
    reachedOfferCount: number;
    decidedOffersCount: number;
    eligibleForSuccessRate: number;
    respondedApplicationsCount: number;
  };
}

const INTERVIEW_OR_LATER: ReadonlySet<StageType> = new Set([
  "interview",
  "assessment",
  "offer",
  "hired",
]);

const OFFER_OR_LATER: ReadonlySet<StageType> = new Set(["offer", "hired"]);

const EMPLOYER_RESPONSE_TYPES: ReadonlySet<StageType> = new Set([
  "screening",
  "interview",
  "assessment",
  "offer",
  "hired",
  "rejected",
]);

function reachedAny(app: KpiApplicationRecord, targets: ReadonlySet<StageType>): boolean {
  if (targets.has(app.currentStageType)) return true;
  return app.history.some((h) => targets.has(h.toStageType));
}

function earliestStageDate(
  app: KpiApplicationRecord,
  targets: ReadonlySet<StageType>,
): string | null {
  const dates = app.history
    .filter((h) => targets.has(h.toStageType))
    .map((h) => h.effectiveOn)
    .sort();
  return dates[0] ?? null;
}

function roundPct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function roundAvg(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Filter out sample records when `includeSample` is false.
 * When `includeSample` is null/undefined, sample records are included only if
 * there are zero real submitted applications.
 */
export function shouldIncludeSample(
  applications: readonly { isSample: boolean }[],
  setting: boolean | null | undefined,
): boolean {
  if (typeof setting === "boolean") return setting;
  const hasReal = applications.some((a) => !a.isSample);
  return !hasReal;
}

export function computeKpiSummary(input: {
  vacancies: readonly KpiVacancyRecord[];
  applications: readonly KpiApplicationRecord[];
  interviews: readonly KpiInterviewRecord[];
  includeSample?: boolean | null;
}): KpiSummary {
  const includeSample = shouldIncludeSample(input.applications, input.includeSample);
  const vacancies = includeSample
    ? input.vacancies
    : input.vacancies.filter((v) => !v.isSample);
  const apps = includeSample
    ? input.applications
    : input.applications.filter((a) => !a.isSample);
  const interviews = includeSample
    ? input.interviews
    : input.interviews.filter((i) => !i.isSample);

  const totalJobsDiscovered = vacancies.length;
  const totalApplicationsSubmitted = apps.length;
  const activeApplications = apps.filter((a) => a.outcome === "active").length;
  const applicationsUnderScreening = apps.filter(
    (a) => a.outcome === "active" && a.currentStageType === "screening",
  ).length;
  const interviewsScheduled = interviews.filter((i) => i.status === "scheduled").length;

  const reachedOfferApps = apps.filter((a) => reachedAny(a, OFFER_OR_LATER));
  const offersReceived = reachedOfferApps.length;

  const successfulApplications = apps.filter((a) => a.outcome === "successful").length;
  const rejectedApplications = apps.filter((a) => a.outcome === "unsuccessful").length;
  const withdrawnApplications = apps.filter((a) => a.outcome === "withdrawn").length;
  const noResponseApplications = apps.filter((a) => a.outcome === "no_response").length;

  // 1. Application-to-Interview conversion rate
  // Exclude applications withdrawn before reaching any interview/assessment stage
  const reachedInterviewApps = apps.filter((a) => reachedAny(a, INTERVIEW_OR_LATER));
  const withdrawnBeforeInterview = apps.filter(
    (a) => a.outcome === "withdrawn" && !reachedAny(a, INTERVIEW_OR_LATER),
  ).length;
  const eligibleForInterviewRate = totalApplicationsSubmitted - withdrawnBeforeInterview;
  const applicationToInterviewRate = roundPct(
    reachedInterviewApps.length,
    eligibleForInterviewRate,
  );

  // 2. Interview-to-Offer conversion rate
  // Among those that reached interview/assessment, exclude those withdrawn before offer
  const withdrawnAfterInterviewBeforeOffer = reachedInterviewApps.filter(
    (a) => a.outcome === "withdrawn" && !reachedAny(a, OFFER_OR_LATER),
  ).length;
  const eligibleForOfferRate = reachedInterviewApps.length - withdrawnAfterInterviewBeforeOffer;
  const interviewToOfferRate = roundPct(reachedOfferApps.length, eligibleForOfferRate);

  // 3. Offer acceptance rate
  // Accepted offers (or Hired outcome) divided by decided offers (accepted/hired + declined/withdrawn at offer)
  let acceptedOffers = 0;
  let decidedOffers = 0;
  for (const app of reachedOfferApps) {
    if (app.offerDecision === "accepted" || app.outcome === "successful") {
      acceptedOffers++;
      decidedOffers++;
    } else if (app.offerDecision === "declined" || app.outcome === "withdrawn") {
      decidedOffers++;
    }
  }
  const offerAcceptanceRate = roundPct(acceptedOffers, decidedOffers);

  // 4. Overall application success rate (Hired / (Submitted - Withdrawn))
  const eligibleForSuccessRate = totalApplicationsSubmitted - withdrawnApplications;
  const overallSuccessRate = roundPct(successfulApplications, eligibleForSuccessRate);

  // 5. Average time to first response (days)
  const firstResponseDays: number[] = [];
  for (const app of apps) {
    const stageDate = earliestStageDate(app, EMPLOYER_RESPONSE_TYPES);
    const commDate = app.firstInboundCommunicationOn ?? null;
    const candidates = [stageDate, commDate].filter((d): d is string => Boolean(d)).sort();
    const earliest = candidates[0];
    if (earliest) {
      const diff = Math.max(0, daysBetween(app.submittedOn, earliest));
      firstResponseDays.push(diff);
    }
  }

  // 6. Average time to interview (days)
  const interviewDays: number[] = [];
  for (const app of apps) {
    const firstInt = earliestStageDate(app, new Set<StageType>(["interview", "assessment"]));
    if (firstInt) {
      interviewDays.push(Math.max(0, daysBetween(app.submittedOn, firstInt)));
    }
  }

  // 7. Average recruitment cycle duration (closed applications only)
  const cycleDays: number[] = [];
  for (const app of apps) {
    if (app.outcome !== "active" && app.closedAt) {
      cycleDays.push(Math.max(0, daysBetween(app.submittedOn, app.closedAt)));
    }
  }

  return {
    totalJobsDiscovered,
    totalApplicationsSubmitted,
    activeApplications,
    applicationsUnderScreening,
    interviewsScheduled,
    offersReceived,
    successfulApplications,
    rejectedApplications,
    withdrawnApplications,
    noResponseApplications,
    applicationToInterviewRate,
    interviewToOfferRate,
    offerAcceptanceRate,
    overallSuccessRate,
    averageTimeToFirstResponseDays: roundAvg(firstResponseDays),
    averageTimeToInterviewDays: roundAvg(interviewDays),
    averageRecruitmentCycleDays: roundAvg(cycleDays),
    denominators: {
      eligibleForInterviewRate,
      reachedInterviewCount: reachedInterviewApps.length,
      eligibleForOfferRate,
      reachedOfferCount: reachedOfferApps.length,
      decidedOffersCount: decidedOffers,
      eligibleForSuccessRate,
      respondedApplicationsCount: firstResponseDays.length,
    },
  };
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  percentageOfSubmitted: number | null;
}

export function computePipelineFunnel(
  applications: readonly KpiApplicationRecord[],
  includeSample?: boolean | null,
): FunnelStep[] {
  const useSample = shouldIncludeSample(applications, includeSample);
  const apps = useSample ? applications : applications.filter((a) => !a.isSample);
  const total = apps.length;

  const steps: { key: string; label: string; types: ReadonlySet<StageType> }[] = [
    {
      key: "applied",
      label: "Applied",
      types: new Set(["applied", "screening", "interview", "assessment", "offer", "hired", "rejected", "withdrawn", "no_response"]),
    },
    {
      key: "screening",
      label: "CV Screening",
      types: new Set(["screening", "interview", "assessment", "offer", "hired"]),
    },
    {
      key: "interview",
      label: "Interview / Assessment",
      types: new Set(["interview", "assessment", "offer", "hired"]),
    },
    {
      key: "offer",
      label: "Offer",
      types: new Set(["offer", "hired"]),
    },
    {
      key: "hired",
      label: "Hired",
      types: new Set(["hired"]),
    },
  ];

  return steps.map((step) => {
    const count = step.key === "applied" ? total : apps.filter((a) => reachedAny(a, step.types)).length;
    return {
      key: step.key,
      label: step.label,
      count,
      percentageOfSubmitted: roundPct(count, total),
    };
  });
}

export interface CompanyResponseMetric {
  companyName: string;
  submittedCount: number;
  respondedCount: number;
  interviewCount: number;
  offerCount: number;
  responseRate: number | null;
  averageResponseDays: number | null;
}

/**
 * Response rate and average first-response speed per company.
 * Withdrawn applications with no prior employer response are excluded from the
 * response-rate denominator.
 */
export function computeCompanyResponseRates(
  applications: readonly KpiApplicationRecord[],
  includeSample?: boolean | null,
): CompanyResponseMetric[] {
  const useSample = shouldIncludeSample(applications, includeSample);
  const apps = useSample ? applications : applications.filter((a) => !a.isSample);

  const grouped = new Map<string, KpiApplicationRecord[]>();
  for (const app of apps) {
    const key = app.companyName.trim() || "Unspecified";
    const list = grouped.get(key) ?? [];
    list.push(app);
    grouped.set(key, list);
  }

  const results: CompanyResponseMetric[] = [];
  for (const [companyName, list] of grouped.entries()) {
    let respondedCount = 0;
    let withdrawnWithoutResponse = 0;
    let interviewCount = 0;
    let offerCount = 0;
    const responseDays: number[] = [];

    for (const app of list) {
      const stageDate = earliestStageDate(app, EMPLOYER_RESPONSE_TYPES);
      const commDate = app.firstInboundCommunicationOn ?? null;
      const candidates = [stageDate, commDate].filter((d): d is string => Boolean(d)).sort();
      const earliest = candidates[0];
      if (earliest) {
        respondedCount++;
        responseDays.push(Math.max(0, daysBetween(app.submittedOn, earliest)));
      } else if (app.outcome === "withdrawn") {
        withdrawnWithoutResponse++;
      }
      if (reachedAny(app, INTERVIEW_OR_LATER)) interviewCount++;
      if (reachedAny(app, OFFER_OR_LATER)) offerCount++;
    }

    const eligible = list.length - withdrawnWithoutResponse;
    results.push({
      companyName,
      submittedCount: list.length,
      respondedCount,
      interviewCount,
      offerCount,
      responseRate: roundPct(respondedCount, eligible),
      averageResponseDays: roundAvg(responseDays),
    });
  }

  return results.sort(
    (a, b) =>
      b.submittedCount - a.submittedCount ||
      (b.responseRate ?? -1) - (a.responseRate ?? -1) ||
      a.companyName.localeCompare(b.companyName),
  );
}

export interface PlatformBreakdownMetric {
  platformName: string;
  applicationsCount: number;
  sharePercent: number | null;
  interviewsReached: number;
  offersReached: number;
  interviewConversionRate: number | null;
}

export function computePlatformBreakdown(
  applications: readonly KpiApplicationRecord[],
  includeSample?: boolean | null,
): PlatformBreakdownMetric[] {
  const useSample = shouldIncludeSample(applications, includeSample);
  const apps = useSample ? applications : applications.filter((a) => !a.isSample);
  const total = apps.length;

  const grouped = new Map<string, KpiApplicationRecord[]>();
  for (const app of apps) {
    const key = app.platformName?.trim() || "Direct / Other";
    const list = grouped.get(key) ?? [];
    list.push(app);
    grouped.set(key, list);
  }

  const rows: PlatformBreakdownMetric[] = [];
  for (const [platformName, list] of grouped.entries()) {
    const interviewsReached = list.filter((a) =>
      reachedAny(a, INTERVIEW_OR_LATER),
    ).length;
    const offersReached = list.filter((a) =>
      reachedAny(a, OFFER_OR_LATER),
    ).length;
    const withdrawnBeforeInt = list.filter(
      (a) => a.outcome === "withdrawn" && !reachedAny(a, INTERVIEW_OR_LATER),
    ).length;

    rows.push({
      platformName,
      applicationsCount: list.length,
      sharePercent: roundPct(list.length, total),
      interviewsReached,
      offersReached,
      interviewConversionRate: roundPct(
        interviewsReached,
        list.length - withdrawnBeforeInt,
      ),
    });
  }

  return rows.sort(
    (a, b) =>
      b.applicationsCount - a.applicationsCount ||
      a.platformName.localeCompare(b.platformName),
  );
}

export interface IndustryBreakdownMetric {
  industry: string;
  applicationsCount: number;
  sharePercent: number | null;
  interviewsReached: number;
  hiredCount: number;
}

export function computeIndustryDistribution(
  applications: readonly KpiApplicationRecord[],
  includeSample?: boolean | null,
): IndustryBreakdownMetric[] {
  const useSample = shouldIncludeSample(applications, includeSample);
  const apps = useSample ? applications : applications.filter((a) => !a.isSample);
  const total = apps.length;

  const grouped = new Map<string, KpiApplicationRecord[]>();
  for (const app of apps) {
    const key = app.industry?.trim() || "Unspecified";
    const list = grouped.get(key) ?? [];
    list.push(app);
    grouped.set(key, list);
  }

  const rows: IndustryBreakdownMetric[] = [];
  for (const [industry, list] of grouped.entries()) {
    rows.push({
      industry,
      applicationsCount: list.length,
      sharePercent: roundPct(list.length, total),
      interviewsReached: list.filter((a) =>
        reachedAny(a, INTERVIEW_OR_LATER),
      ).length,
      hiredCount: list.filter((a) => a.outcome === "successful").length,
    });
  }

  return rows.sort(
    (a, b) =>
      b.applicationsCount - a.applicationsCount ||
      a.industry.localeCompare(b.industry),
  );
}

export interface MonthlyPerformanceMetric {
  month: string; // YYYY-MM
  submitted: number;
  interviewsReached: number;
  offersReached: number;
  hired: number;
  rejected: number;
  interviewConversionRate: number | null;
}

export function computeMonthlyPerformance(
  applications: readonly KpiApplicationRecord[],
  includeSample?: boolean | null,
): MonthlyPerformanceMetric[] {
  const useSample = shouldIncludeSample(applications, includeSample);
  const apps = useSample ? applications : applications.filter((a) => !a.isSample);

  const grouped = new Map<string, KpiApplicationRecord[]>();
  for (const app of apps) {
    const month = app.submittedOn.slice(0, 7);
    const list = grouped.get(month) ?? [];
    list.push(app);
    grouped.set(month, list);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const interviewsReached = list.filter((a) =>
        reachedAny(a, INTERVIEW_OR_LATER),
      ).length;
      const withdrawnBeforeInt = list.filter(
        (a) => a.outcome === "withdrawn" && !reachedAny(a, INTERVIEW_OR_LATER),
      ).length;

      return {
        month,
        submitted: list.length,
        interviewsReached,
        offersReached: list.filter((a) => reachedAny(a, OFFER_OR_LATER)).length,
        hired: list.filter((a) => a.outcome === "successful").length,
        rejected: list.filter((a) => a.outcome === "unsuccessful").length,
        interviewConversionRate: roundPct(
          interviewsReached,
          list.length - withdrawnBeforeInt,
        ),
      };
    });
}
