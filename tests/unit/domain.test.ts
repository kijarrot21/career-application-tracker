import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  daysBetween,
  isBusinessDay,
  isIsoDate,
} from "@/lib/domain/business-days";
import {
  detectSource,
  extractExternalJobId,
  normalizeCompanyName,
  normalizeUrl,
} from "@/lib/domain/duplicates";
import {
  evaluateNoResponseSuggestion,
  initialFollowUpDueOn,
  isFollowUpOverdue,
  nextFollowUpInSequence,
} from "@/lib/domain/follow-ups";
import { computeKpiSummary, computePipelineFunnel } from "@/lib/domain/kpi";
import {
  classifyTransition,
  DEFAULT_STAGES,
  deriveOutcome,
  type StageLike,
} from "@/lib/domain/stages";
import {
  DEFAULT_WEIGHTS,
  overallScore,
  suggestScores,
} from "@/lib/domain/suitability";
import { sanitizeCsvCell, toCsv } from "@/lib/csv";

describe("stages domain", () => {
  const stages: StageLike[] = DEFAULT_STAGES.map((s, idx) => ({
    id: s.key,
    name: s.name,
    stageType: s.stageType,
    sortOrder: idx * 10,
  }));
  const byKey = new Map(stages.map((s) => [s.id, s]));

  it("derives outcomes accurately from stageType", () => {
    expect(deriveOutcome("applied")).toBe("active");
    expect(deriveOutcome("interview")).toBe("active");
    expect(deriveOutcome("offer")).toBe("active");
    expect(deriveOutcome("hired")).toBe("successful");
    expect(deriveOutcome("rejected")).toBe("unsuccessful");
    expect(deriveOutcome("withdrawn")).toBe("withdrawn");
    expect(deriveOutcome("no_response")).toBe("no_response");
  });

  it("detects forward, skipped, backward, terminal, reopen, and invalid transitions", () => {
    const applied = byKey.get("applied")!;
    const screening = byKey.get("cv_screening")!;
    const userInt = byKey.get("user_interview")!;
    const rejected = byKey.get("rejected")!;
    const sourced = byKey.get("sourced")!;

    expect(classifyTransition(applied, screening, stages).kind).toBe("forward");

    const skip = classifyTransition(applied, userInt, stages);
    expect(skip.kind).toBe("skip");
    expect(skip.skipped.map((s) => s.id)).toEqual(["cv_screening", "hr_interview"]);

    expect(classifyTransition(userInt, screening, stages).kind).toBe("backward");
    expect(classifyTransition(userInt, rejected, stages).kind).toBe("terminal");
    expect(classifyTransition(rejected, screening, stages).kind).toBe("reopen");
    expect(classifyTransition(applied, sourced, stages).kind).toBe("invalid");
  });
});

describe("business-days domain", () => {
  it("skips weekends and configured holidays", () => {
    expect(isIsoDate("2026-11-16")).toBe(true);
    expect(isBusinessDay("2026-11-16")).toBe(true); // Monday
    expect(isBusinessDay("2026-11-15")).toBe(false); // Sunday
    // 5 business days from Monday 2026-11-16 -> Monday 2026-11-23
    expect(addBusinessDays("2026-11-16", 5)).toBe("2026-11-23");
    // With holiday on 2026-11-18 -> Tuesday 2026-11-24
    expect(addBusinessDays("2026-11-16", 5, ["2026-11-18"])).toBe("2026-11-24");
    expect(daysBetween("2026-11-01", "2026-11-16")).toBe(15);
  });
});

describe("duplicates & URL inspection domain", () => {
  it("detects platforms and extracts external job IDs without scraping", () => {
    const li = "https://www.linkedin.com/jobs/search/?currentJobId=4099887766&trk=public_jobs";
    expect(detectSource(li)).toBe("linkedin");
    expect(extractExternalJobId(li)).toBe("4099887766");
    expect(normalizeUrl(li)).toBe("https://linkedin.com/jobs/view/4099887766");

    const js = "https://id.jobstreet.com/id/job/senior-engineer-79123456?utm_source=email";
    expect(detectSource(js)).toBe("jobstreet");
    expect(extractExternalJobId(js)).toBe("79123456");

    const glints =
      "https://glints.com/id/opportunities/jobs/frontend/a1b2c3d4-e5f6-4789-89ab-cdef01234567";
    expect(detectSource(glints)).toBe("glints");
    expect(extractExternalJobId(glints)).toBe("a1b2c3d4-e5f6-4789-89ab-cdef01234567");

    expect(normalizeCompanyName("PT GoTo Gojek Tokopedia Tbk.")).toBe("goto gojek tokopedia");
  });
});

describe("suitability scoring domain", () => {
  it("computes profile-based suggestions and weighted overall score", () => {
    const suggestions = suggestScores(
      {
        skills: ["TypeScript", "React", "Next.js", "GraphQL"],
        requiredExperienceYears: 4,
        requiredEducation: "bachelor",
        salaryMin: 20_000_000,
        salaryMax: 30_000_000,
        currency: "IDR",
        location: "Jakarta",
        workArrangement: "hybrid",
      },
      {
        skills: ["TS", "ReactJS", "Next"],
        yearsExperience: 4,
        educationLevel: "bachelor",
        expectedSalaryMin: 25_000_000,
        currency: "IDR",
        preferredLocations: ["Jakarta"],
        preferredArrangements: ["hybrid", "remote"],
      },
    );

    expect(suggestions.skills.score).toBe(75); // 3 of 4 matched via alias normalization
    expect(suggestions.experience.score).toBe(100);
    expect(suggestions.education.score).toBe(100);
    expect(suggestions.salary.score).toBe(100);
    expect(suggestions.location.score).toBe(100);
    expect(suggestions.growth.score).toBeNull();

    const total = overallScore(
      {
        skills: suggestions.skills.score,
        experience: suggestions.experience.score,
        education: suggestions.education.score,
        salary: suggestions.salary.score,
        location: suggestions.location.score,
        growth: 80,
      },
      DEFAULT_WEIGHTS,
    );
    expect(total).toBe(91);
  });
});

describe("follow-ups & No Response suggestion domain", () => {
  it("computes follow-up sequence and never auto-rejects silent applications", () => {
    expect(initialFollowUpDueOn("2026-11-16")).toBe("2026-11-23");
    const second = nextFollowUpInSequence(1, "2026-11-23");
    expect(second?.sequenceNo).toBe(2);
    expect(second?.dueOn).toBe("2026-11-30");
    expect(isFollowUpOverdue("2026-11-10", "2026-11-16")).toBe(true);

    const notYet = evaluateNoResponseSuggestion(
      {
        outcome: "active",
        currentStageType: "applied",
        submittedOn: "2026-11-01",
        lastActivityOn: "2026-11-01",
      },
      "2026-11-16",
      30,
    );
    expect(notYet.shouldSuggest).toBe(false);

    const silent = evaluateNoResponseSuggestion(
      {
        outcome: "active",
        currentStageType: "applied",
        submittedOn: "2026-10-01",
        lastActivityOn: "2026-10-01",
      },
      "2026-11-16",
      30,
    );
    expect(silent.shouldSuggest).toBe(true);
    expect(silent.silentDays).toBe(46);
  });
});

describe("KPI & funnel calculations", () => {
  it("excludes withdrawn applications from conversion denominators appropriately", () => {
    const apps = [
      // App 1: Hired
      {
        id: "1",
        submittedOn: "2026-10-01",
        outcome: "successful" as const,
        currentStageType: "hired" as const,
        closedAt: "2026-10-21",
        platformName: "LinkedIn",
        industry: "Tech",
        companyName: "Co A",
        isSample: false,
        history: [
          { toStageType: "applied" as const, effectiveOn: "2026-10-01" },
          { toStageType: "interview" as const, effectiveOn: "2026-10-06" },
          { toStageType: "offer" as const, effectiveOn: "2026-10-16" },
          { toStageType: "hired" as const, effectiveOn: "2026-10-21" },
        ],
      },
      // App 2: Rejected at screening
      {
        id: "2",
        submittedOn: "2026-10-02",
        outcome: "unsuccessful" as const,
        currentStageType: "rejected" as const,
        closedAt: "2026-10-12",
        platformName: "JobStreet",
        industry: "Tech",
        companyName: "Co B",
        isSample: false,
        history: [
          { toStageType: "applied" as const, effectiveOn: "2026-10-02" },
          { toStageType: "screening" as const, effectiveOn: "2026-10-05" },
          { toStageType: "rejected" as const, effectiveOn: "2026-10-12" },
        ],
      },
      // App 3: Withdrawn before interview (excluded from interview rate denominator)
      {
        id: "3",
        submittedOn: "2026-10-03",
        outcome: "withdrawn" as const,
        currentStageType: "withdrawn" as const,
        closedAt: "2026-10-04",
        platformName: "LinkedIn",
        industry: "Fintech",
        companyName: "Co C",
        isSample: false,
        history: [
          { toStageType: "applied" as const, effectiveOn: "2026-10-03" },
          { toStageType: "withdrawn" as const, effectiveOn: "2026-10-04" },
        ],
      },
    ];

    const summary = computeKpiSummary({
      vacancies: [{ id: "v1", isSample: false }, { id: "v2", isSample: false }, { id: "v3", isSample: false }],
      applications: apps,
      interviews: [],
    });

    expect(summary.totalApplicationsSubmitted).toBe(3);
    expect(summary.denominators.eligibleForInterviewRate).toBe(2); // 3 - 1 withdrawn before interview
    expect(summary.applicationToInterviewRate).toBe(50); // 1 of 2
    expect(summary.interviewToOfferRate).toBe(100); // 1 of 1
    expect(summary.overallSuccessRate).toBe(50); // 1 hired of 2 non-withdrawn
    expect(summary.averageTimeToFirstResponseDays).toBe(4); // (5 + 3) / 2
    expect(summary.averageRecruitmentCycleDays).toBe(10.3); // (20 + 10 + 1) / 3

    const funnel = computePipelineFunnel(apps);
    expect(funnel.find((f) => f.key === "applied")?.count).toBe(3);
    expect(funnel.find((f) => f.key === "interview")?.count).toBe(1);
    expect(funnel.find((f) => f.key === "hired")?.count).toBe(1);
  });
});

describe("CSV export security", () => {
  it("neutralizes formula injection while preserving negative numbers", () => {
    expect(sanitizeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(sanitizeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(sanitizeCsvCell("@IMPORTXML()")).toBe("'@IMPORTXML()");
    expect(sanitizeCsvCell("-15000")).toBe("-15000");
    const csv = toCsv(["Code", "Note"], [["APP-0001", '=HYPERLINK("http://evil")']]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\"");
  });
});
