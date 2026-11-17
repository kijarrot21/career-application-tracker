import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import type { AiProvider, AiProviderRegistry } from "@/server/ai/providers";
import { cvDataSchema } from "@/server/ai/schemas";
import {
  generateTailoredCvWithAiService,
  parseCvWithAiService,
} from "@/server/ai/services";
import { getAiJobDetailForUser } from "@/server/queries/ai";
import { getUserSettings } from "@/server/queries/settings";
import { recordSubmissionService } from "@/server/services/applications";
import {
  exportAccountJsonService,
  updatePreferredLocaleService,
  updateWorkspaceSettingsService,
} from "@/server/services/settings";
import { createVacancyService } from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_LOCAL = {
  id: "loc-user-1",
  name: "Siti Lokal",
  email: "siti-lokal@example.com",
};

function createStubRegistry(
  seenPrompts: Array<{ systemPrompt: string; userPrompt: string }>,
): AiProviderRegistry {
  const stubProvider: AiProvider = {
    id: "ollama",
    name: "Ollama Stub",
    locality: "local",
    getDefaultModel: () => "llama3.1:8b",
    capabilities: {
      locality: "local",
      structuredOutput: "json_schema",
      jsonMode: true,
      streaming: false,
      vision: false,
      maxContextTokens: 8192,
      supportsSystemRole: true,
    },
    isConfigured: () => true,
    checkHealth: async () => ({
      provider: "ollama",
      locality: "local",
      configured: true,
      available: true,
      defaultModel: "llama3.1:8b",
      models: ["llama3.1:8b"],
    }),
    estimateUsage: () => ({
      inputTokens: 100,
      outputTokens: 100,
      totalTokens: 200,
      estimatedCostUsd: 0,
      latencyMs: 5,
      isEstimated: true,
    }),
    generateStructured: async (req) => {
      seenPrompts.push({
        systemPrompt: req.systemPrompt,
        userPrompt: req.userPrompt,
      });

      const parsedPayload =
        req.taskType === "cv_parse"
          ? cvDataSchema.parse({
              profile: { fullName: "Siti Lokal" },
              experiences: [],
              educations: [],
              skills: [],
              certifications: [],
              projects: [],
              achievements: [],
              spokenLanguages: ["Indonesian"],
              uncertainFields: [],
              extractionNotes: [],
            })
          : {
              cvFormat: req.userPrompt.includes("indonesian_cv")
                ? "indonesian_cv"
                : "international_resume",
              templateStyle: "ats_friendly",
              targetRole: "Backend Engineer",
              candidateName: "Siti Lokal",
              tailoredHeadline: "Backend Engineer",
              contactLine: "siti@example.com",
              tailoredSummary: "Summary",
              highlightedExperiences: [],
              prioritizedSkills: [],
              educations: [],
              certifications: [],
              projects: [],
              spokenLanguages: [],
              groundedCitationIds: [],
              fabricationSelfCheck: "All facts grounded cleanly.",
            };

      return {
        data: parsedPayload as never,
        rawText: JSON.stringify(parsedPayload),
        provider: "ollama",
        locality: "local",
        model: "llama3.1:8b",
        usage: {
          inputTokens: 100,
          outputTokens: 100,
          totalTokens: 200,
          estimatedCostUsd: 0,
          latencyMs: 12,
          isEstimated: false,
        },
      };
    },
  };

  return {
    ollama: stubProvider,
    openai: stubProvider,
    gemini: stubProvider,
  };
}

describe("Phase 9 Integration — Localization & Global Readiness", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const isolated = await createIsolatedTestDb();
    db = isolated.db;
    cleanup = isolated.cleanup;
    await createTestUser(db, USER_LOCAL);
  }, 30000);

  afterEach(async () => {
    await cleanup();
  });

  it("initializes new users with id-ID, Asia/Jakarta, and IDR defaults", async () => {
    const settings = await getUserSettings(USER_LOCAL.id);
    expect(settings.preferredLocale).toBe("id-ID");
    expect(settings.timezone).toBe("Asia/Jakarta");
    expect(settings.currency).toBe("IDR");
  });

  it("switches languages, timezones, and configurable currencies without breaking existing ATS records", async () => {
    const vacancy = await createVacancyService(USER_LOCAL.id, {
      companyName: "PT Garuda Digital",
      title: "Platform Engineer",
      currency: "IDR",
      salaryMin: 20000000,
      salaryMax: 30000000,
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["TypeScript", "PostgreSQL"],
    });
    const app = await recordSubmissionService(USER_LOCAL.id, {
      vacancyId: vacancy.id,
      submittedOn: "2026-04-01",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const enSettings = await updateWorkspaceSettingsService(USER_LOCAL.id, {
      preferredLocale: "en-US",
      timezone: "America/New_York",
      currency: "USD",
      searchStatus: "open_to_offers",
    });
    expect(enSettings.preferredLocale).toBe("en-US");
    expect(enSettings.timezone).toBe("America/New_York");
    expect(enSettings.currency).toBe("USD");

    const chfSettings = await updateWorkspaceSettingsService(USER_LOCAL.id, {
      preferredLocale: "en-US",
      timezone: "UTC",
      currency: "CHF",
      searchStatus: "open_to_offers",
    });
    expect(chfSettings.currency).toBe("CHF");

    const backToId = await updatePreferredLocaleService(USER_LOCAL.id, "id-ID");
    expect(backToId.preferredLocale).toBe("id-ID");

    const exported = await exportAccountJsonService(USER_LOCAL.id);
    expect(exported.settings?.preferredLocale).toBe("id-ID");
    expect(exported.applications.some((a) => a.id === app.id)).toBe(true);

    await expect(
      updateWorkspaceSettingsService(USER_LOCAL.id, {
        preferredLocale: "id-ID",
        timezone: "Asia/Jakarta",
        currency: "INVALID99",
        searchStatus: "actively_searching",
      }),
    ).rejects.toThrow();
  });

  it("routes AI prompts and default CV generation formats according to user locale (id-ID vs en-US)", async () => {
    const seenPrompts: Array<{ systemPrompt: string; userPrompt: string }> = [];
    const registry = createStubRegistry(seenPrompts);

    await parseCvWithAiService(
      USER_LOCAL.id,
      {
        cvText:
          "Budi Santoso - Software Engineer with 5 years experience in Jakarta.",
        consentGranted: true,
      },
      { registry },
    );
    expect(seenPrompts[0].systemPrompt).toContain("Bahasa Indonesia");

    const genId = await generateTailoredCvWithAiService(
      USER_LOCAL.id,
      { targetRole: "Backend Engineer", consentGranted: true },
      { registry },
    );
    expect(genId.status).toBe("completed");
    if (genId.status === "completed") {
      const storedJob = await getAiJobDetailForUser(USER_LOCAL.id, genId.jobId);
      expect(storedJob?.job.locale).toBe("id");
      expect(genId.data.cvFormat).toBe("indonesian_cv");
    }

    await updatePreferredLocaleService(USER_LOCAL.id, "en-US");
    await parseCvWithAiService(
      USER_LOCAL.id,
      {
        cvText:
          "Alice Candidate - Principal Software Engineer based in Singapore.",
        consentGranted: true,
      },
      { registry },
    );
    expect(seenPrompts[2].systemPrompt).toContain("professional English");

    const genEn = await generateTailoredCvWithAiService(
      USER_LOCAL.id,
      { targetRole: "Principal Engineer", consentGranted: true },
      { registry },
    );
    expect(genEn.status).toBe("completed");
    if (genEn.status === "completed") {
      const storedJobEn = await getAiJobDetailForUser(
        USER_LOCAL.id,
        genEn.jobId,
      );
      expect(storedJobEn?.job.locale).toBe("en");
      expect(genEn.data.cvFormat).toBe("international_resume");
    }
  });
});
