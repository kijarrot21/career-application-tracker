import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  aiAnalysisJobs,
  aiCareerAnalyses,
  careerProfiles,
  documentVersions,
} from "@/db/schema";
import { cvDataSchema } from "@/server/ai/schemas";
import { stageAiParsedCvToProfileService } from "@/server/ai/services";
import {
  applyCvImportReviewService,
  discardCvImportReviewService,
  stageCvImportReviewService,
} from "@/server/services/career-profile";
import { uploadOrVersionDocumentService } from "@/server/services/career";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

function sampleCvData() {
  return cvDataSchema.parse({
    profile: { headline: "Backend Engineer", summary: "Eight years in payments" },
    experiences: [],
    educations: [],
    skills: [{ skillName: "PostgreSQL", category: "technical" }],
    certifications: [],
    projects: [],
    achievements: ["Reduced p99 latency by 40 percent"],
    spokenLanguages: ["Indonesian"],
    languageProficiencies: [
      { language: "English", proficiency: "advanced" },
    ],
    uncertainFields: [
      {
        section: "profile",
        fieldPath: "profile.summary",
        extractedValue: "Eight years",
        reason: "Tenure approximated from work history.",
      },
    ],
    fieldEvidence: [
      {
        section: "profile",
        fieldPath: "profile.headline",
        confidence: 92,
        supportingText: "Backend Engineer appears under the candidate name.",
      },
    ],
    extractionNotes: ["Dates normalized to ISO where possible."],
  });
}

describe("CV import review autofill", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "user_a",
      name: "Alice Pratama",
      email: "alice@example.com",
    });
  }, 30000);

  afterEach(async () => {
    await cleanup();
    rmSync(resolve(process.cwd(), "storage/documents", "user_a"), {
      recursive: true,
      force: true,
    });
  });

  async function stage() {
    const uploaded = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Master CV",
        versionLabel: "v1.0",
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from("%PDF-1.7\nCV text", "utf8"),
        filename: "cv.pdf",
      },
    });
    return uploaded;
  }

  it("carries confidence, evidence and languages into the staged review payload", async () => {
    const uploaded = await stage();
    const [job] = await db
      .insert(aiAnalysisJobs)
      .values({
        userId: "user_a",
        taskType: "cv_parse",
        provider: "ollama",
        locality: "local",
        model: "qwen2.5:7b",
        promptVersionTag: "cv_parse:en:v1.0.0",
        privacyModeAtRun: "local_only",
        inputHash: "hash",
        status: "completed",
        completedAt: new Date(),
      })
      .returning();
    const [analysis] = await db
      .insert(aiCareerAnalyses)
      .values({
        userId: "user_a",
        jobId: job.id,
        taskType: "cv_parse",
        provider: "ollama",
        model: "qwen2.5:7b",
        promptVersionTag: "cv_parse:en:v1.0.0",
        inputHash: "hash",
        resultPayload: sampleCvData() as unknown as Record<string, unknown>,
      })
      .returning();

    await stageAiParsedCvToProfileService("user_a", {
      analysisId: analysis.id,
      sourceDocumentVersionId: uploaded.version.id,
    });

    const [profile] = await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, "user_a"));
    const payload = profile.pendingReviewPayload!;
    expect(payload.reviewMeta?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: "profile.headline", confidence: 92 }),
      ]),
    );
    expect(payload.skills?.some((s) => s.skillName === "English" && s.category === "language")).toBe(true);
    expect(payload.reviewMeta?.unmapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: "achievements" }),
      ]),
    );
  });

  it("finalizes the document version in the same transaction as an accepted apply", async () => {
    const uploaded = await stage();
    await db
      .update(documentVersions)
      .set({ processingStatus: "awaiting_review" })
      .where(eq(documentVersions.id, uploaded.version.id));

    await applyCvImportReviewService("user_a", {
      acceptProfileFields: ["headline"],
      reviewedPayload: {
        sourceDocumentVersionId: uploaded.version.id,
        profilePatch: { headline: "Backend Engineer", summary: "Eight years in payments" },
        skills: [
          {
            tempId: "ai-skill-0",
            skillName: "PostgreSQL",
            category: "technical",
          },
        ],
      },
    });

    const [version] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, uploaded.version.id));
    expect(version.processingStatus).toBe("completed");
    const [profile] = await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, "user_a"));
    expect(profile.headline).toBe("Backend Engineer");
    expect(profile.pendingReviewPayload).toBeNull();
  });

  it("keeps awaiting_review when the profile application fails", async () => {
    const uploaded = await stage();
    await db
      .update(documentVersions)
      .set({ processingStatus: "awaiting_review" })
      .where(eq(documentVersions.id, uploaded.version.id));

    await expect(
      applyCvImportReviewService("user_a", { acceptProfileFields: [] }),
    ).rejects.toThrow(/no staged/i);

    const [version] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, uploaded.version.id));
    expect(version.processingStatus).toBe("awaiting_review");
  });

  it("finalizes the document version after the review is discarded", async () => {
    const uploaded = await stage();
    await stageCvImportReviewService("user_a", {
      sourceDocumentVersionId: uploaded.version.id,
      profilePatch: { headline: "Backend Engineer" },
    });
    await db
      .update(documentVersions)
      .set({ processingStatus: "awaiting_review" })
      .where(eq(documentVersions.id, uploaded.version.id));

    await discardCvImportReviewService("user_a");

    const [version] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, uploaded.version.id));
    expect(version.processingStatus).toBe("completed");
  });
});
