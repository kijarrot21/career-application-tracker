import { describe, expect, it } from "vitest";
import {
  computeCompanyResponseRates,
  computeIndustryDistribution,
  computeMonthlyPerformance,
  computePlatformBreakdown,
  type KpiApplicationRecord,
} from "@/lib/domain/kpi";

const SAMPLE_APPS: KpiApplicationRecord[] = [
  {
    id: "a1",
    submittedOn: "2026-10-01",
    outcome: "successful",
    currentStageType: "hired",
    closedAt: "2026-10-20",
    platformName: "LinkedIn",
    industry: "Fintech",
    companyName: "Xendit",
    isSample: false,
    history: [
      { toStageType: "applied", effectiveOn: "2026-10-01" },
      { toStageType: "screening", effectiveOn: "2026-10-04" },
      { toStageType: "interview", effectiveOn: "2026-10-08" },
      { toStageType: "offer", effectiveOn: "2026-10-16" },
      { toStageType: "hired", effectiveOn: "2026-10-20" },
    ],
  },
  {
    id: "a2",
    submittedOn: "2026-10-05",
    outcome: "unsuccessful",
    currentStageType: "rejected",
    closedAt: "2026-10-15",
    platformName: "LinkedIn",
    industry: "Fintech",
    companyName: "Xendit",
    isSample: false,
    history: [
      { toStageType: "applied", effectiveOn: "2026-10-05" },
      { toStageType: "rejected", effectiveOn: "2026-10-15" },
    ],
  },
  {
    id: "a3",
    submittedOn: "2026-11-01",
    outcome: "withdrawn",
    currentStageType: "withdrawn",
    closedAt: "2026-11-03",
    platformName: "JobStreet",
    industry: "Travel Tech",
    companyName: "Traveloka",
    isSample: false,
    history: [
      { toStageType: "applied", effectiveOn: "2026-11-01" },
      { toStageType: "withdrawn", effectiveOn: "2026-11-03" },
    ],
  },
  {
    id: "a4",
    submittedOn: "2026-11-04",
    outcome: "active",
    currentStageType: "interview",
    closedAt: null,
    platformName: "JobStreet",
    industry: "Travel Tech",
    companyName: "Traveloka",
    isSample: false,
    history: [
      { toStageType: "applied", effectiveOn: "2026-11-04" },
      { toStageType: "interview", effectiveOn: "2026-11-10" },
    ],
  },
];

describe("Phase 5: Analytics Breakdowns (Company, Platform, Industry, Monthly)", () => {
  it("computes company response rates while excluding silent withdrawn applications from denominators", () => {
    const companies = computeCompanyResponseRates(SAMPLE_APPS);
    const xendit = companies.find((c) => c.companyName === "Xendit")!;
    expect(xendit.submittedCount).toBe(2);
    expect(xendit.respondedCount).toBe(2);
    expect(xendit.responseRate).toBe(100);
    expect(xendit.averageResponseDays).toBe(6.5); // (3 + 10) / 2

    const traveloka = companies.find((c) => c.companyName === "Traveloka")!;
    expect(traveloka.submittedCount).toBe(2);
    expect(traveloka.respondedCount).toBe(1);
    // 1 withdrawn without response excluded -> 1 / 1 = 100%
    expect(traveloka.responseRate).toBe(100);
    expect(traveloka.averageResponseDays).toBe(6);
  });

  it("computes platform distribution and interview conversion rates", () => {
    const platforms = computePlatformBreakdown(SAMPLE_APPS);
    const linkedin = platforms.find((p) => p.platformName === "LinkedIn")!;
    expect(linkedin.applicationsCount).toBe(2);
    expect(linkedin.sharePercent).toBe(50);
    expect(linkedin.interviewsReached).toBe(1);
    expect(linkedin.interviewConversionRate).toBe(50);

    const jobstreet = platforms.find((p) => p.platformName === "JobStreet")!;
    expect(jobstreet.applicationsCount).toBe(2);
    // 1 withdrawn before interview excluded -> 1 / 1 = 100%
    expect(jobstreet.interviewConversionRate).toBe(100);
  });

  it("computes industry distribution and monthly recruitment performance", () => {
    const industries = computeIndustryDistribution(SAMPLE_APPS);
    expect(industries).toHaveLength(2);
    expect(industries[0]?.sharePercent).toBe(50);

    const monthly = computeMonthlyPerformance(SAMPLE_APPS);
    expect(monthly.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
    expect(monthly[0]?.submitted).toBe(2);
    expect(monthly[0]?.hired).toBe(1);
    expect(monthly[0]?.interviewConversionRate).toBe(50);
    expect(monthly[1]?.submitted).toBe(2);
    expect(monthly[1]?.interviewConversionRate).toBe(100);
  });
});
