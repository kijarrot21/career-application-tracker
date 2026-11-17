import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREDIT_PACKAGES,
  DEFAULT_CREDIT_PRICING,
  InsufficientCreditsError,
} from "@/lib/domain/credits";
import {
  adjustCreditSchema,
  refundCreditSchema,
  reserveCreditsInputSchema,
  updateAiPricingSchema,
} from "@/server/services/credits";

describe("Phase 5 Credit System unit tests — pricing, packages & Zod validation", () => {
  it("defines configurable initial AI pricing assumptions and IDR-first packages", () => {
    const byKey = new Map(
      DEFAULT_CREDIT_PRICING.map((p) => [p.pricingKey, p.creditCost]),
    );

    expect(byKey.get("cv_evaluate_basic")).toBe(2);
    expect(byKey.get("job_match")).toBe(1);
    expect(byKey.get("cv_evaluate_detailed")).toBe(3);
    expect(byKey.get("cv_correction")).toBe(3);
    expect(byKey.get("cv_generate")).toBe(4);
    expect(byKey.get("cv_generate_job_optimized")).toBe(5);
    expect(byKey.get("cover_letter")).toBe(2);
    expect(byKey.get("skill_gap")).toBe(3);
    expect(byKey.get("career_roadmap")).toBe(5);
    expect(byKey.get("interview_coach")).toBe(3);

    expect(DEFAULT_CREDIT_PACKAGES.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_CREDIT_PACKAGES.every((p) => p.priceIdr > 0 && p.credits > 0)).toBe(
      true,
    );

    const err = new InsufficientCreditsError({
      requiredCredits: 5,
      availableCredits: 2,
      pricingKey: "career_roadmap",
    });
    expect(err.message).toContain("requires 5 credit(s)");
    expect(err.message).toContain("available balance is 2");
  });

  it("enforces Zod validation on credit reservations, refunds, adjustments, and pricing updates", () => {
    expect(
      reserveCreditsInputSchema.safeParse({
        pricingKey: "job_match",
        taskType: "job_match",
        amount: -1,
        idempotencyKey: "req-1",
      }).success,
    ).toBe(false);

    expect(
      refundCreditSchema.safeParse({
        amount: 0,
        referenceId: "job-1",
        reason: "Provider outage",
        idempotencyKey: "refund-1",
      }).success,
    ).toBe(false);

    expect(
      adjustCreditSchema.safeParse({
        deltaAmount: 0,
        referenceId: "adj-1",
        reason: "Zero delta not allowed",
        idempotencyKey: "adj-1",
      }).success,
    ).toBe(false);

    expect(
      updateAiPricingSchema.safeParse({
        pricingKey: "job_match",
        creditCost: -5,
      }).success,
    ).toBe(false);

    expect(
      updateAiPricingSchema.safeParse({
        pricingKey: "job_match",
        creditCost: 2,
        chargeLocalRuns: false,
      }).success,
    ).toBe(true);
  });
});
