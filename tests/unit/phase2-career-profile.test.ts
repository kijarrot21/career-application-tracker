import { describe, expect, it } from "vitest";
import {
  computeProfileCompletion,
  validateDateRange,
} from "@/lib/domain/career-profile";

describe("Master Career Profile domain rules", () => {
  it("validates date ranges and current/ongoing constraints", () => {
    expect(
      validateDateRange({
        startDate: "2024-01-01",
        endDate: "2025-01-01",
        isCurrentOrOngoing: false,
      }),
    ).toBeNull();

    expect(
      validateDateRange({
        startDate: "2024-01-01",
        endDate: "2025-01-01",
        isCurrentOrOngoing: true,
      }),
    ).toContain("must be empty");

    expect(
      validateDateRange({
        startDate: "2025-05-01",
        endDate: "2025-01-01",
        isCurrentOrOngoing: false,
      }),
    ).toContain("cannot be earlier");

    expect(
      validateDateRange({
        startDate: "not-a-date",
        endDate: null,
      }),
    ).toContain("YYYY-MM-DD");
  });

  it("computes completion percentage and AI readiness accurately", () => {
    const empty = computeProfileCompletion({
      profile: { fullName: "Budi" },
      experiencesCount: 0,
      educationsCount: 0,
      verifiedSkillsCount: 0,
      certificationsCount: 0,
      projectsCount: 0,
    });
    expect(empty.percentage).toBe(0);
    expect(empty.isReadyForAi).toBe(false);

    const complete = computeProfileCompletion({
      profile: {
        fullName: "Budi Santoso",
        headline: "Backend Engineer",
        summary: "5 years building distributed Go services.",
        location: "Jakarta",
        country: "Indonesia",
        targetPositions: ["Staff Engineer"],
        preferredLocations: ["Jakarta"],
        expectedSalaryMin: 25_000_000,
      },
      experiencesCount: 2,
      educationsCount: 1,
      verifiedSkillsCount: 4,
      certificationsCount: 1,
      projectsCount: 2,
    });
    expect(complete.percentage).toBe(100);
    expect(complete.completedCount).toBe(7);
    expect(complete.isReadyForAi).toBe(true);
  });
});
