import { describe, expect, it } from "vitest";
import {
  archiveOutcomeToAppOutcome,
  computeRetainUntil,
  evaluateRetentionState,
  mapToArchiveOutcome,
} from "@/lib/domain/archive";

describe("Application Archive domain helpers", () => {
  it("maps terminal stage types and application outcomes to archive outcomes", () => {
    expect(mapToArchiveOutcome({ stageType: "rejected", outcome: "unsuccessful" })).toBe("rejected");
    expect(mapToArchiveOutcome({ stageType: "withdrawn", outcome: "withdrawn" })).toBe("withdrawn");
    expect(mapToArchiveOutcome({ stageType: "hired", outcome: "successful" })).toBe("hired");
    expect(mapToArchiveOutcome({ stageType: "no_response", outcome: "no_response" })).toBe("no_response");
    expect(mapToArchiveOutcome({ stageType: "interview", outcome: "active" })).toBe("closed");
    expect(
      mapToArchiveOutcome({
        stageType: "rejected",
        outcome: "unsuccessful",
        explicitOutcome: "closed",
      }),
    ).toBe("closed");
  });

  it("maps archive outcomes back to application outcomes", () => {
    expect(archiveOutcomeToAppOutcome("rejected")).toBe("unsuccessful");
    expect(archiveOutcomeToAppOutcome("withdrawn")).toBe("withdrawn");
    expect(archiveOutcomeToAppOutcome("hired")).toBe("successful");
    expect(archiveOutcomeToAppOutcome("no_response")).toBe("no_response");
    expect(archiveOutcomeToAppOutcome("closed")).toBe("closed");
  });

  it("computes retention deadlines and evaluates retention states", () => {
    expect(computeRetainUntil("2026-01-01", null)).toBeNull();
    expect(computeRetainUntil("2026-01-01", 365)).toBe("2027-01-01");

    expect(evaluateRetentionState(null, "2026-11-17")).toBe("indefinite");
    expect(evaluateRetentionState("2026-11-10", "2026-11-17")).toBe("expired");
    expect(evaluateRetentionState("2026-12-01", "2026-11-17")).toBe("expiring_soon");
    expect(evaluateRetentionState("2027-06-01", "2026-11-17")).toBe("active");
  });
});
