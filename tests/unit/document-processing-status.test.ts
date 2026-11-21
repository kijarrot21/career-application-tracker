import { describe, expect, it } from "vitest";
import { DOCUMENT_PROCESSING_STATUSES } from "@/lib/constants";

describe("document processing status domain", () => {
  it("defines every CV extraction lifecycle state", () => {
    expect(DOCUMENT_PROCESSING_STATUSES).toEqual([
      "uploaded",
      "queued",
      "processing",
      "awaiting_review",
      "completed",
      "failed",
    ]);
  });
});
