import { describe, expect, it } from "vitest";
import { buildCvExtractionIdempotencyKey } from "@/server/services/document-processing";

describe("CV extraction idempotency", () => {
  const params = {
    versionId: "11111111-1111-1111-1111-111111111111",
    sha256: "abc123",
  };

  it("scopes the key to a version and a single attempt", () => {
    expect(buildCvExtractionIdempotencyKey({ ...params, attempt: 1 })).toBe(
      "cv-parse:11111111-1111-1111-1111-111111111111:1:abc123",
    );
  });

  it("changes the key on retry so a failed attempt is never reused", () => {
    const first = buildCvExtractionIdempotencyKey({ ...params, attempt: 1 });
    const retry = buildCvExtractionIdempotencyKey({ ...params, attempt: 2 });
    expect(retry).not.toBe(first);
  });

  it("separates versions even with identical file content", () => {
    const other = buildCvExtractionIdempotencyKey({
      ...params,
      versionId: "22222222-2222-2222-2222-222222222222",
      attempt: 1,
    });
    expect(other).not.toBe(buildCvExtractionIdempotencyKey({ ...params, attempt: 1 }));
  });
});
