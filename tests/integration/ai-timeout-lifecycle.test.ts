import { eq } from "drizzle-orm";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDb } from "@/db";
import { DEFAULT_WELCOME_CREDITS } from "@/lib/domain/credits";
import { env } from "@/lib/env";
import {
  aiAnalysisJobs,
  creditLedger,
  creditReservations,
  creditWallets,
} from "@/db/schema";
import {
  AiProviderError,
  OllamaProvider,
  OpenAiProvider,
  GeminiProvider,
  type AiModelConfig,
  type AiProvider,
  type AiProviderRegistry,
  type AiStructuredRequest,
  type FetchLike,
} from "@/server/ai/providers";
import {
  approveAndRunAiJobService,
  executeAiTask,
} from "@/server/ai/router/ai-task-router";
import { cvEvaluationSchema } from "@/server/ai/schemas";
import { evaluateCvWithAiService } from "@/server/ai/services";
import { upsertCareerProfileService } from "@/server/services/career-profile";
import { updateAiPrivacySettingsService } from "@/server/services/settings";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const EVALUATION_PAYLOAD = {
  overallScore: 84,
  summary: "Synthetic evaluation for timeout lifecycle tests.",
  sectionScores: [
    { section: "experience", score: 84, feedback: "Grounded and specific." },
  ],
};

function ollamaFetch(payload: unknown): FetchLike {
  return async () =>
    new Response(
      JSON.stringify({
        message: { content: JSON.stringify(payload) },
        prompt_eval_count: 120,
        eval_count: 60,
        done_reason: "stop",
      }),
      { status: 200 },
    );
}

function abortingFetch(): FetchLike {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
}

function observeConfig(
  provider: AiProvider,
  onGenerate: (config?: AiModelConfig) => void,
): AiProvider {
  return {
    id: provider.id,
    name: provider.name,
    locality: provider.locality,
    capabilities: provider.capabilities,
    isConfigured: (config) => provider.isConfigured(config),
    getDefaultModel: (config) => provider.getDefaultModel(config),
    getDefaultTimeoutMs: () =>
      provider.getDefaultTimeoutMs?.() ?? env.AI_REQUEST_TIMEOUT_MS,
    checkHealth: (config) => provider.checkHealth(config),
    estimateUsage: (request) => provider.estimateUsage(request),
    generateStructured: <TSchema extends z.ZodTypeAny>(
      request: AiStructuredRequest<TSchema>,
    ) => {
      onGenerate(request.modelConfig);
      return provider.generateStructured(request);
    },
  };
}

function buildRegistry(options: {
  fetchFn?: FetchLike;
  onOllamaGenerate?: (config?: AiModelConfig) => void;
  onCloudGenerate?: () => void;
}): AiProviderRegistry {
  const ollama = new OllamaProvider({
    fetchFn: options.fetchFn ?? ollamaFetch(EVALUATION_PAYLOAD),
  });
  const cloudGenerate = () => {
    options.onCloudGenerate?.();
    throw new Error("Cloud provider must not be invoked for local_only tasks");
  };
  const cloudStub = (provider: AiProvider): AiProvider => ({
    id: provider.id,
    name: provider.name,
    locality: provider.locality,
    capabilities: provider.capabilities,
    isConfigured: () => true,
    getDefaultModel: () => "cloud-model",
    checkHealth: () =>
      Promise.resolve({
        provider: provider.id,
        locality: "cloud",
        configured: true,
        available: true,
        defaultModel: "cloud-model",
        models: [],
      }),
    estimateUsage: (request) => provider.estimateUsage(request),
    generateStructured: cloudGenerate as AiProvider["generateStructured"],
  });

  return {
    ollama: options.onOllamaGenerate
      ? observeConfig(ollama, options.onOllamaGenerate)
      : ollama,
    openai: cloudStub(new OpenAiProvider({ apiKeyOverride: "dummy-key" })),
    gemini: cloudStub(new GeminiProvider({ apiKeyOverride: "dummy-key" })),
  };
}

describe("AI timeout and credit lifecycle integration (in-memory PGlite)", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "user_a",
      name: "Alice Timeout",
      email: "alice-timeout@example.com",
    });
    await upsertCareerProfileService("user_a", {
      fullName: "Alice Timeout",
      headline: "Backend Engineer",
      summary: "Synthetic profile for timeout lifecycle tests.",
      preferredLanguage: "en-US",
      targetPositions: ["Backend Engineer"],
      targetIndustries: ["Fintech"],
      preferredLocations: ["Jakarta"],
      preferredArrangements: ["hybrid"],
      salaryCurrency: "IDR",
      expectedSalaryMin: 10_000_000,
      expectedSalaryMax: 20_000_000,
      salaryPeriod: "month",
      syncToSuitabilitySettings: false,
    });
    await updateAiPrivacySettingsService("user_a", {
      aiPrivacyMode: "local_only",
      aiPreferredProvider: "ollama",
      aiOllamaEndpoint: "http://127.0.0.1:11434",
    });
  }, 30000);

  afterEach(async () => {
    await cleanup();
  }, 15000);

  it("captures one reservation on success and preserves the explicit task timeout", async () => {
    let observed: AiModelConfig | undefined;
    const result = await evaluateCvWithAiService(
      "user_a",
      { timeoutMs: 45_000 },
      {
        registry: buildRegistry({
          onOllamaGenerate: (config) => {
            observed = config;
          },
        }),
      },
    );

    expect(result.status).toBe("completed");
    expect(result.provider).toBe("ollama");
    expect(result.locality).toBe("local");
    expect(observed?.timeoutMs).toBe(45_000);

    const reservations = await db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.userId, "user_a"));
    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe("captured");

    const [wallet] = await db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.userId, "user_a"));
    expect(wallet.availableBalance).toBe(
      DEFAULT_WELCOME_CREDITS - reservations[0].amount,
    );
    expect(wallet.reservedBalance).toBe(0);

    const ledger = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, "user_a"));
    expect(ledger.filter((e) => e.entryType === "reserve")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "capture")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "release")).toHaveLength(0);

    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.userId, "user_a"));
    expect(job.status).toBe("completed");
    expect(job.attempts).toBe(1);
  });

  it("releases the reservation and persists TIMEOUT metadata when inference times out", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        executeAiTask({
          userId: "user_a",
          taskType: "cv_evaluate",
          schema: cvEvaluationSchema,
          schemaName: "CvEvaluation",
          userPrompt: "Synthetic timeout test",
          sources: [],
          maxAttempts: 1,
          timeoutMs: 1_000,
          registry: buildRegistry({ fetchFn: abortingFetch() }),
        }),
      ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
    } finally {
      warnSpy.mockRestore();
    }

    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.userId, "user_a"));
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("TIMEOUT");
    expect(job.attempts).toBe(1);

    const reservations = await db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.userId, "user_a"));
    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe("released");

    const ledger = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, "user_a"));
    expect(ledger.filter((e) => e.entryType === "reserve")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "release")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "capture")).toHaveLength(0);

    const [wallet] = await db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.userId, "user_a"));
    expect(wallet.availableBalance).toBe(DEFAULT_WELCOME_CREDITS);
    expect(wallet.reservedBalance).toBe(0);
  });

  it("does not duplicate charging when a timed-out task is retried", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        evaluateCvWithAiService(
          "user_a",
          { timeoutMs: 1_000, maxAttempts: 2 },
          { registry: buildRegistry({ fetchFn: abortingFetch() }) },
        ),
      ).rejects.toBeInstanceOf(AiProviderError);
    } finally {
      warnSpy.mockRestore();
    }

    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.userId, "user_a"));
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(2);

    const reservations = await db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.userId, "user_a"));
    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe("released");

    const ledger = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, "user_a"));
    expect(ledger.filter((e) => e.entryType === "reserve")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "release")).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === "capture")).toHaveLength(0);

    const [wallet] = await db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.userId, "user_a"));
    expect(wallet.availableBalance).toBe(DEFAULT_WELCOME_CREDITS);
    expect(wallet.reservedBalance).toBe(0);
  });

  it("preserves the stored timeout when a consent-paused job is resumed", async () => {
    await updateAiPrivacySettingsService("user_a", {
      aiPrivacyMode: "ask_before_each",
      aiPreferredProvider: "ollama",
    });

    let observed: AiModelConfig | undefined;
    const paused = await evaluateCvWithAiService(
      "user_a",
      { timeoutMs: 60_000 },
      {
        registry: buildRegistry({
          onOllamaGenerate: (config) => {
            observed = config;
          },
        }),
      },
    );
    expect(paused.status).toBe("awaiting_consent");
    expect(observed).toBeUndefined();

    const [pausedJob] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.id, paused.jobId));
    expect(pausedJob.pendingTaskRequest).toMatchObject({ timeoutMs: 60_000 });

    const resumed = await approveAndRunAiJobService("user_a", paused.jobId, {
      registry: buildRegistry({
        onOllamaGenerate: (config) => {
          observed = config;
        },
      }),
    });
    expect(resumed.status).toBe("completed");
    expect(observed?.timeoutMs).toBe(60_000);
  });

  it("never invokes a cloud provider for local_only tasks", async () => {
    let cloudCalled = false;
    await expect(
      evaluateCvWithAiService(
        "user_a",
        { requestedProvider: "openai", consentGranted: true },
        {
          registry: buildRegistry({
            onCloudGenerate: () => {
              cloudCalled = true;
            },
          }),
        },
      ),
    ).rejects.toMatchObject({ code: "PRIVACY_MODE_BLOCKED" });

    expect(cloudCalled).toBe(false);
    const reservations = await db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.userId, "user_a"));
    expect(reservations).toHaveLength(0);
  });
});
