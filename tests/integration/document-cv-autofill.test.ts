import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  aiAnalysisJobs,
  careerProfiles,
  documentVersions,
} from "@/db/schema";
import {
  OllamaProvider,
  type AiProviderRegistry,
} from "@/server/ai/providers";
import {
  approveCvExtractionService,
  cancelCvExtractionService,
  DuplicateCvExtractionError,
  startCvExtractionService,
} from "@/server/services/document-processing";
import { getDocumentVersionFileForUserService, uploadOrVersionDocumentService } from "@/server/services/career";
import { updateAiPrivacySettingsService } from "@/server/services/settings";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const CV_TEXT = `Alice Pratama
Backend Engineer
alice@example.com | +62 812 3456 7890 | Jakarta
PROFESSIONAL SUMMARY
Backend engineer with eight years building payment APIs in Go and PostgreSQL.
WORK EXPERIENCE
PT Nusantara Pay — Senior Backend Engineer — 2022-01-10 to Present
Designed idempotent payment APIs and reduced p99 latency by 40 percent.
EDUCATION
Universitas Indonesia — Bachelor of Computer Science — 2016
SKILLS
Go, PostgreSQL, Kubernetes
CERTIFICATIONS
AWS Certified Developer — Amazon — 2023
PROJECTS
Settlement Pipeline — Led settlement reconciliation using Kafka.
LANGUAGES
Indonesian (native), English (fluent)`;

function registryWithPayload(
  payload: unknown,
  options?: { status?: number },
): AiProviderRegistry {
  const noop = new OllamaProvider({
    fetchFn: async () => new Response("unused", { status: 500 }),
  });
  return {
    ollama: new OllamaProvider({
      fetchFn: async () => {
        if (options?.status && options.status >= 400) {
          return new Response("Upstream error", { status: options.status });
        }
        return new Response(
          JSON.stringify({
            message: { content: JSON.stringify(payload) },
            prompt_eval_count: 140,
            eval_count: 80,
          }),
          { status: 200 },
        );
      },
    }),
    openai: noop,
    gemini: noop,
  };
}

function validPayload() {
  return {
    profile: {
      fullName: "Alice Pratama",
      headline: "Backend Engineer",
      summary: "Eight years building payment APIs.",
      contactEmail: "alice@example.com",
      contactPhone: "+62 812 3456 7890",
      location: "Jakarta",
      totalExperienceYears: 8,
    },
    experiences: [
      {
        companyName: "PT Nusantara Pay",
        jobTitle: "Senior Backend Engineer",
        employmentType: "full_time",
        startDate: "2022-01-10",
        isCurrent: true,
        responsibilities: "Designed idempotent payment APIs.",
        achievements: ["Reduced p99 latency by 40 percent"],
      },
    ],
    educations: [
      {
        institution: "Universitas Indonesia",
        qualification: "bachelor",
        degreeTitle: "Computer Science",
        graduationYear: 2016,
      },
    ],
    skills: [
      { skillName: "Go", category: "technical", proficiencyLevel: "advanced" },
      { skillName: "PostgreSQL", category: "technical" },
    ],
    certifications: [
      {
        name: "AWS Certified Developer",
        issuingOrganization: "Amazon",
        issueDate: "2023-01-01",
      },
    ],
    projects: [
      {
        name: "Settlement Pipeline",
        description: "Led settlement reconciliation using Kafka.",
        technologies: ["Kafka"],
      },
    ],
    spokenLanguages: ["Indonesian", "English"],
    uncertainFields: [],
    extractionNotes: [],
  };
}

describe("CV autofill lifecycle", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;
  const createdStorageUserIds = ["user_a", "user_b"];

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "user_a",
      name: "Alice Pratama",
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
  }, 30000);

  afterEach(async () => {
    await cleanup();
    for (const uid of createdStorageUserIds) {
      rmSync(resolve(process.cwd(), "storage/documents", uid), {
        recursive: true,
        force: true,
      });
    }
  });

  async function uploadCv(filename = "cv.txt", label = "v1.0") {
    return uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Master CV",
        versionLabel: label,
        linkRole: "cv",
      },
      file: { buffer: Buffer.from(CV_TEXT, "utf8"), filename },
    });
  }

  async function versionState(versionId: string) {
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, versionId));
    return row;
  }

  it("extracts a CV, stages pending review, and leaves verified profile data intact", async () => {
    const uploaded = await uploadCv();

    const result = await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    expect(result.status).toBe("awaiting_review");
    const version = await versionState(uploaded.version.id);
    expect(version.processingStatus).toBe("awaiting_review");
    expect(version.processingAttempts).toBe(1);
    expect(version.aiJobId).toBeTruthy();
    expect(version.aiAnalysisId).toBeTruthy();

    const [profile] = await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, "user_a"));
    expect(profile.pendingReviewPayload?.experiences).toHaveLength(1);
    expect(
      profile.pendingReviewPayload?.skills?.filter(
        (skill) => skill.category === "language",
      ),
    ).toHaveLength(2);
    expect(profile.headline).toBeNull();
  });

  it("blocks duplicate processing while a version is awaiting review", async () => {
    const uploaded = await uploadCv();
    await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    await expect(
      startCvExtractionService("user_a", uploaded.version.id, {
        registry: registryWithPayload(validPayload()),
      }),
    ).rejects.toBeInstanceOf(DuplicateCvExtractionError);
    expect((await versionState(uploaded.version.id)).processingAttempts).toBe(1);
  });

  it("keeps the document and allows a fresh attempt after provider failure", async () => {
    const uploaded = await uploadCv();

    const failed = await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload({}, { status: 503 }),
    });
    expect(failed.status).toBe("failed");
    expect((await versionState(uploaded.version.id)).processingStatus).toBe("failed");
    expect((await getDocumentVersionFileForUserService("user_a", uploaded.version.id))?.buffer.length).toBeGreaterThan(0);

    const retried = await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });
    expect(retried.status).toBe("awaiting_review");
    const version = await versionState(uploaded.version.id);
    expect(version.processingAttempts).toBe(2);
  });

  it("pauses for consent and stages the result after approval", async () => {
    await updateAiPrivacySettingsService("user_a", {
      aiPrivacyMode: "ask_before_each",
      aiPreferredProvider: "ollama",
    });
    const uploaded = await uploadCv();

    const paused = await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });
    expect(paused.status).toBe("awaiting_consent");
    const queuedVersion = await versionState(uploaded.version.id);
    expect(queuedVersion.processingStatus).toBe("queued");
    expect(queuedVersion.aiJobId).toBeTruthy();

    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.id, queuedVersion.aiJobId!));
    expect(job.status).toBe("awaiting_consent");

    const approved = await approveCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });
    expect(approved.status).toBe("awaiting_review");
    expect((await versionState(uploaded.version.id)).processingStatus).toBe("awaiting_review");
  });

  it("cancels a consent-paused extraction consistently", async () => {
    await updateAiPrivacySettingsService("user_a", {
      aiPrivacyMode: "ask_before_each",
      aiPreferredProvider: "ollama",
    });
    const uploaded = await uploadCv();
    await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    await cancelCvExtractionService("user_a", uploaded.version.id);

    const version = await versionState(uploaded.version.id);
    expect(version.processingStatus).toBe("failed");
    expect(version.processingError).toBe("CANCELLED");
    const [job] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(and(eq(aiAnalysisJobs.id, version.aiJobId!), eq(aiAnalysisJobs.userId, "user_a")));
    expect(job.status).toBe("cancelled");
  });

  it("rejects an unsupported format without creating an AI job", async () => {
    const uploaded = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Scanned CV",
        versionLabel: "v1.0",
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]),
        filename: "scan.png",
      },
    });

    const result = await startCvExtractionService("user_a", uploaded.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    expect(result.status).toBe("failed");
    const version = await versionState(uploaded.version.id);
    expect(version.processingError).toBe("UNSUPPORTED_DOCUMENT");
    expect(version.aiJobId).toBeNull();
  });

  it("does not overwrite a pending review staged from another CV version", async () => {
    const first = await uploadCv("cv-v1.txt", "v1.0");
    await startCvExtractionService("user_a", first.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    const second = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        documentId: first.documentId,
        category: "master_cv",
        title: "Master CV",
        versionLabel: "v2.0",
        linkRole: "cv",
      },
      file: { buffer: Buffer.from(CV_TEXT, "utf8"), filename: "cv-v2.txt" },
    });

    const result = await startCvExtractionService("user_a", second.version.id, {
      registry: registryWithPayload(validPayload()),
    });

    expect(result.status).toBe("failed");
    expect((await versionState(second.version.id)).processingError).toBe(
      "PENDING_REVIEW_EXISTS",
    );
    const [profile] = await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, "user_a"));
    expect(profile.pendingReviewPayload?.sourceDocumentVersionId).toBe(
      first.version.id,
    );
  });
});
