import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { aiAnalysisJobs, creditLedger, creditReservations } from "@/db/schema";
import { InsufficientCreditsError } from "@/lib/domain/credits";
import { OllamaProvider, type AiProviderRegistry } from "@/server/ai/providers";
import {
  evaluateCvWithAiService,
  generateCareerRoadmapWithAiService,
  generateTailoredCvWithAiService,
  matchJobWithAiService,
} from "@/server/ai/services";
import {
  getCreditReservationForUser,
  getCreditsDashboardDataForUser,
  getWalletSummaryForUser,
  listCreditLedgerForUser,
} from "@/server/queries/credits";
import { upsertCareerProfileService } from "@/server/services/career-profile";
import {
  adjustCreditBalanceService,
  captureCreditReservationService,
  ensureCreditWalletService,
  refundCreditTransactionService,
  releaseCreditReservationService,
  reserveCreditsForAiTaskService,
  updateAiTaskPricingService,
  verifyWalletLedgerIntegrityService,
} from "@/server/services/credits";
import {
  exportAccountJsonService,
  updateAiPrivacySettingsService,
} from "@/server/services/settings";
import { createVacancyService } from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

function mockOllamaRegistry(
  payload: unknown,
  options?: { failStatus?: number },
): AiProviderRegistry {
  const noop = new OllamaProvider({
    fetchFn: async () => new Response("unused", { status: 500 }),
  });
  return {
    ollama: new OllamaProvider({
      fetchFn: async () => {
        if (options?.failStatus) {
          return new Response("Provider down", { status: options.failStatus });
        }
        return new Response(
          JSON.stringify({
            message: { content: JSON.stringify(payload) },
            prompt_eval_count: 100,
            eval_count: 50,
          }),
          { status: 200 },
        );
      },
    }),
    openai: noop,
    gemini: noop,
  };
}

describe("Phase 5 Credit-Based Monetization integration tests (in-memory PGlite)", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;

    await createTestUser(db, {
      id: "user_a",
      name: "Alice Wallet",
      email: "alice@example.com",
    });
    await createTestUser(db, {
      id: "user_b",
      name: "Bob Other",
      email: "bob@example.com",
    });

    await updateAiPrivacySettingsService("user_a", {
      aiPrivacyMode: "local_only",
      aiPreferredProvider: "ollama",
      aiOllamaEndpoint: "http://127.0.0.1:11434",
    });

    await upsertCareerProfileService("user_a", {
      fullName: "Alice Wallet",
      headline: "Senior Backend Engineer",
      summary: "7 years shipping payment APIs.",
      location: "Jakarta",
      country: "Indonesia",
      preferredLanguage: "en-US",
      targetPositions: ["Staff Engineer"],
      targetIndustries: ["Fintech"],
      preferredLocations: ["Jakarta"],
      preferredArrangements: ["hybrid"],
      salaryCurrency: "IDR",
      salaryPeriod: "month",
      syncToSuitabilitySettings: false,
    });
  }, 30000);

  afterEach(async () => {
    await cleanup();
  }, 15000);

  it("initializes wallet with ledger grant, enforces insufficient balance, and handles reservation -> capture and failed task release", async () => {
    // 1. Initialize wallet with exactly 4 credits
    const wallet = await ensureCreditWalletService("user_a", {
      initialCredits: 4,
    });
    expect(wallet.availableBalance).toBe(4);
    expect(wallet.reservedBalance).toBe(0);

    // Insufficient balance check: Career Roadmap costs 5 credits -> blocked before execution
    await expect(
      generateCareerRoadmapWithAiService(
        "user_a",
        { targetRole: "Principal Engineer" },
        { registry: mockOllamaRegistry({}) },
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(4);
    expect(
      await db
        .select()
        .from(aiAnalysisJobs)
        .where(eq(aiAnalysisJobs.userId, "user_a")),
    ).toHaveLength(0);

    // 2. Successful CV Generator (4 credits) -> wallet becomes 0 available, 4 lifetimeSpent
    const genRes = await generateTailoredCvWithAiService(
      "user_a",
      { targetRole: "Staff Backend Engineer" },
      {
        registry: mockOllamaRegistry({
          cvFormat: "international_resume",
          templateStyle: "ats_friendly",
          targetRole: "Staff Backend Engineer",
          tailoredHeadline: "Senior Backend Engineer",
          tailoredSummary: "7 years shipping payment APIs.",
          highlightedExperiences: [],
          prioritizedSkills: [],
          educations: [],
          projects: [],
          certifications: [],
          spokenLanguages: [],
          groundedCitationIds: ["profile-1"],
          fabricationSelfCheck: "Verified.",
        }),
      },
    );
    expect(genRes.status).toBe("completed");
    if (genRes.status !== "completed") throw new Error("Expected completed");
    expect(genRes.creditCost).toBe(4);

    const afterCapture = await getWalletSummaryForUser("user_a");
    expect(afterCapture.availableBalance).toBe(0);
    expect(afterCapture.reservedBalance).toBe(0);
    expect(afterCapture.lifetimeSpent).toBe(4);
    expect(afterCapture.isLowBalance).toBe(true);

    // Top up +3 credits so we can test failed task automatic release
    await adjustCreditBalanceService("user_a", {
      deltaAmount: 3,
      referenceId: "topup-test-1",
      reason: "Test top-up for failure release verification",
      idempotencyKey: "topup-test-1",
    });

    // 3. Failed Basic CV Evaluation (2 credits) -> reserves 2 credits, fails on 503, auto-releases 2 credits
    await expect(
      evaluateCvWithAiService(
        "user_a",
        { maxAttempts: 1 },
        { registry: mockOllamaRegistry({}, { failStatus: 503 }) },
      ),
    ).rejects.toThrow();

    const afterRelease = await getWalletSummaryForUser("user_a");
    expect(afterRelease.availableBalance).toBe(3);
    expect(afterRelease.reservedBalance).toBe(0);
    expect(afterRelease.lifetimeSpent).toBe(4);

    const reservations = await db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.userId, "user_a"));
    expect(reservations.some((r) => r.status === "captured")).toBe(true);
    expect(reservations.some((r) => r.status === "released")).toBe(true);

    const integrity = await verifyWalletLedgerIntegrityService("user_a");
    expect(integrity.valid).toBe(true);
    expect(integrity.ledgerAvailable).toBe(3);
  });

  it("enforces idempotency on duplicate requests and prevents overdraft under concurrent requests", async () => {
    // Seed wallet with exactly 5 credits
    await ensureCreditWalletService("user_a", { initialCredits: 5 });

    // 1. Duplicate idempotencyKey -> deducts only ONCE (2 credits for Basic CV Evaluation)
    const evalPayload = {
      overallScore: 84,
      summary: "Solid backend experience.",
      categoryScores: [],
      evidence: [],
      weaknesses: [],
      recommendations: [],
      priorityActions: [],
      groundedFactsUsed: ["7 years shipping payment APIs."],
    };

    const first = await evaluateCvWithAiService(
      "user_a",
      { idempotencyKey: "dup-eval-req-1" },
      { registry: mockOllamaRegistry(evalPayload) },
    );
    const second = await evaluateCvWithAiService(
      "user_a",
      { idempotencyKey: "dup-eval-req-1" },
      { registry: mockOllamaRegistry(evalPayload) },
    );

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    if (second.status === "completed") {
      expect(second.deduplicated).toBe(true);
    }
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(3);

    // 2. Concurrent requests: wallet now has 3 credits.
    // Fire 3 concurrent 2-credit reservations -> strictly 1 succeeds (leaving 1 credit) and 2 fail!
    const concurrent = await Promise.allSettled([
      reserveCreditsForAiTaskService("user_a", {
        pricingKey: "cv_evaluate_basic",
        taskType: "cv_evaluate",
        amount: 2,
        idempotencyKey: "race-1",
      }),
      reserveCreditsForAiTaskService("user_a", {
        pricingKey: "cv_evaluate_basic",
        taskType: "cv_evaluate",
        amount: 2,
        idempotencyKey: "race-2",
      }),
      reserveCreditsForAiTaskService("user_a", {
        pricingKey: "cv_evaluate_basic",
        taskType: "cv_evaluate",
        amount: 2,
        idempotencyKey: "race-3",
      }),
    ]);

    const succeeded = concurrent.filter((r) => r.status === "fulfilled");
    const failed = concurrent.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(2);
    expect(failed[0].reason).toBeInstanceOf(InsufficientCreditsError);

    const postRaceWallet = await getWalletSummaryForUser("user_a");
    expect(postRaceWallet.availableBalance).toBe(1);
    expect(postRaceWallet.reservedBalance).toBe(2);

    const integrity = await verifyWalletLedgerIntegrityService("user_a");
    expect(integrity.valid).toBe(true);
  });

  it("supports configurable database pricing, refunds/adjustments, ledger auditability, UU PDP export, and cross-user isolation", async () => {
    await ensureCreditWalletService("user_a", { initialCredits: 20 });
    await ensureCreditWalletService("user_b", { initialCredits: 10 });

    // Update configurable pricing in DB: Job Matching from 1 credit -> 6 credits
    const updatedPricing = await updateAiTaskPricingService({
      pricingKey: "job_match",
      creditCost: 6,
    });
    expect(updatedPricing.creditCost).toBe(6);

    const vacancy = await createVacancyService("user_a", {
      companyName: "Nusantara Cloud",
      title: "Backend Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "medium",
      triageStatus: "shortlisted",
      skills: ["Go"],
      description: "Build Go payment services.",
      discoveredOn: "2026-11-17",
    });

    const matchRes = await matchJobWithAiService(
      "user_a",
      { vacancyId: vacancy.id },
      {
        registry: mockOllamaRegistry({
          overallMatchScore: 88,
          confidenceScore: 90,
          summary: "Strong Go match.",
          matchingSkills: ["Go"],
          missingSkills: [],
          qualificationGaps: [],
          transferableSkills: [],
          recommendations: [],
        }),
      },
    );
    expect(matchRes.status).toBe("completed");
    if (matchRes.status !== "completed") throw new Error("Expected completed");
    expect(matchRes.creditCost).toBe(6);
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(14);

    // Refund 6 credits + manual deduction of 4 credits
    await refundCreditTransactionService("user_a", {
      amount: 6,
      jobId: matchRes.jobId,
      referenceId: matchRes.jobId,
      reason: "Goodwill refund after user dispute",
      idempotencyKey: `refund:${matchRes.jobId}`,
    });
    await adjustCreditBalanceService("user_a", {
      deltaAmount: -4,
      referenceId: "promo-expiry-1",
      reason: "Promotional bonus adjustment",
      idempotencyKey: "adj-promo-expiry-1",
    });

    // Reject negative adjustment that exceeds available balance (16)
    await expect(
      adjustCreditBalanceService("user_a", {
        deltaAmount: -50,
        referenceId: "over-deduct",
        reason: "Should fail",
        idempotencyKey: "over-deduct",
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    const dashboard = await getCreditsDashboardDataForUser("user_a");
    expect(dashboard.wallet.availableBalance).toBe(16);
    expect(dashboard.paymentsEnabled).toBe(false);
    expect(dashboard.pricing.some((p) => p.pricingKey === "job_match" && p.creditCost === 6)).toBe(
      true,
    );

    const integrity = await verifyWalletLedgerIntegrityService("user_a");
    expect(integrity.valid).toBe(true);

    // Cross-user isolation checks
    const resId = matchRes.creditReservationId!;
    expect(await getCreditReservationForUser("user_b", resId)).toBeNull();
    await expect(
      captureCreditReservationService("user_b", resId),
    ).rejects.toThrow("Credit reservation not found.");
    await expect(
      releaseCreditReservationService("user_b", resId),
    ).rejects.toThrow("Credit reservation not found.");

    // Bob's ledger contains only his own welcome grant
    const bobLedger = await listCreditLedgerForUser("user_b");
    expect(bobLedger).toHaveLength(1);
    expect(
      (await db.select().from(creditLedger).where(eq(creditLedger.userId, "user_b"))).length,
    ).toBe(1);

    // Export includes creditWallet, creditReservations, creditLedger
    const exported = await exportAccountJsonService("user_a");
    expect(exported.creditWallet?.availableBalance).toBe(16);
    expect(exported.creditReservations.length).toBeGreaterThanOrEqual(1);
    expect(exported.creditLedger.length).toBeGreaterThanOrEqual(4);
  });
});
