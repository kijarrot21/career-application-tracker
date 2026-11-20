import { describe, expect, it } from "vitest";
import { recordSubmissionSchema } from "@/server/services/applications";

describe("recordSubmissionSchema submittedOn validation", () => {
  it("rejects a 10-character value that is not an ISO date", () => {
    const result = recordSubmissionSchema.safeParse({
      submittedOn: "not-a-date",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            "Submission date must be a valid YYYY-MM-DD date",
        ),
      ).toBe(true);
    }
  });

  it("accepts a valid ISO date", () => {
    expect(
      recordSubmissionSchema.safeParse({ submittedOn: "2026-01-15" }).success,
    ).toBe(true);
  });
});
