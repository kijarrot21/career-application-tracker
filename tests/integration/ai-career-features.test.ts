import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  aiCareerAnalyses,
  aiFeedback,
  applications,
  careerProfiles,
  documentVersions,
} from "@/db/schema";
import {
  OllamaProvider,
  type AiProviderRegistry,
} from "@/server/ai/providers";
import { UnsupportedDocumentFormatError } from "@/server/ai/extractors/document-text-extractor";
import { exportCvToDocxBuffer } from "@/server/ai/exporters/cv-exporter";
import {
  CV_EVALUATION_CATEGORIES,
  cvGenerationSchema,
} from "@/server/ai/schemas";
import {
  applyApprovedCvCorrectionsService,
  evaluateCvWithAiService,
  generateCareerRoadmapWithAiService,
  generateTailoredCvWithAiService,
  matchJobWithAiService,
  parseCvBufferWithAiService,
  parseCvWithAiService,
  renderGeneratedCvExportService,
  saveGeneratedCvAsDocumentVersionService,
  stageAiParsedCvToProfileService,
  suggestCvCorrectionsWithAiService,
} from "@/server/ai/services";
import { getAiAnalysisDetailForUser } from "@/server/queries/ai";
import { recordSubmissionService } from "@/server/services/applications";
import { uploadOrVersionDocumentService } from "@/server/services/career";
import {
  saveCareerExperienceService,
  saveCareerSkillService,
  upsertCareerProfileService,
} from "@/server/services/career-profile";
import { updateAiPrivacySettingsService } from "@/server/services/settings";
import { createVacancyService } from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

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

describe("Phase 4 AI Career Features integration tests (in-memory PGlite)", () => {
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

    await upsertCareerProfileService("user_a", {
      fullName: "Alice Pratama",
      headline: "Senior Backend Engineer",
      summary: "7 years shipping payment APIs in Jakarta.",
      contactEmail: "alice@example.com",
      location: "Jakarta",
      country: "Indonesia",
      preferredLanguage: "bilingual",
      careerLevel: "senior",
      totalExperienceYears: 7,
      targetPositions: ["Staff Engineer"],
      targetIndustries: ["Fintech"],
      preferredLocations: ["Jakarta"],
      preferredArrangements: ["hybrid"],
      salaryCurrency: "IDR",
      expectedSalaryMin: 35_000_000,
      expectedSalaryMax: 45_000_000,
      salaryPeriod: "month",
      syncToSuitabilitySettings: false,
    });

    await saveCareerExperienceService("user_a", {
      companyName: "PT Nusantara Pay",
      jobTitle: "Senior Backend Engineer",
      employmentType: "full_time",
      location: "Jakarta",
      startDate: "2022-01-10",
      isCurrent: true,
      responsibilities: "Designed idempotent payment APIs.",
      achievements: ["Reduced p99 latency by 40%"],
    });

    await saveCareerSkillService("user_a", {
      skillName: "Go",
      category: "technical",
      proficiencyLevel: "expert",
      yearsOfExperience: 5,
      isUserVerified: true,
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
  }, 15000);

  it("Feature A: extracts and parses stored DOCX CV without overwriting verified data, flags uncertainFields, and stages review", async () => {
    const sampleDocx = exportCvToDocxBuffer(
      cvGenerationSchema.parse({
        cvFormat: "international_resume",
        templateStyle: "ats_friendly",
        targetRole: "Backend Engineer",
        candidateName: "Alice Pratama",
        tailoredHeadline: "Backend Engineer",
        tailoredSummary: "Experienced Go engineer.",
        highlightedExperiences: [
          {
            companyName: "PT Fintech Maju",
            jobTitle: "Software Engineer",
            relevantBullets: ["Built settlement pipeline"],
          },
        ],
        prioritizedSkills: ["Go", "PostgreSQL"],
        educations: [],
        projects: [],
        certifications: [],
        spokenLanguages: ["Indonesian"],
        groundedCitationIds: ["exp-1"],
        fabricationSelfCheck: "Verified",
      }),
    );

    const uploaded = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Alice DOCX CV",
        versionLabel: "v1-docx",
        linkRole: "cv",
      },
      file: { buffer: sampleDocx, filename: "alice.docx" },
    });

    const parsedRes = await parseCvWithAiService(
      "user_a",
      { documentVersionId: uploaded.version.id },
      {
        registry: registryWithPayload({
          profile: { fullName: "Alice Pratama", headline: "Imported Draft Title" },
          experiences: [
            {
              companyName: "PT Fintech Maju",
              jobTitle: "Software Engineer",
              employmentType: "full_time",
              startDate: "2020-01-01",
              endDate: "2021-12-31",
              isCurrent: false,
              achievements: ["Built settlement pipeline"],
            },
          ],
          educations: [],
          skills: [
            {
              skillName: "PostgreSQL",
              category: "technical",
              proficiencyLevel: "advanced",
            },
          ],
          certifications: [],
          projects: [],
          achievements: ["Built settlement pipeline"],
          spokenLanguages: ["Indonesian"],
          uncertainFields: [
            {
              section: "experiences",
              fieldPath: "experiences[0].startDate",
              extractedValue: "2020",
              reason: "Day defaulted for review.",
            },
          ],
          extractionNotes: [],
        }),
      },
    );

    expect(parsedRes.status).toBe("completed");
    if (parsedRes.status !== "completed") throw new Error("Expected completed");
    expect(parsedRes.data.uncertainFields).toHaveLength(1);

    // Stage into Career Profile review, verified headline must remain untouched!
    await stageAiParsedCvToProfileService("user_a", {
      analysisId: parsedRes.analysisId,
      sourceDocumentVersionId: uploaded.version.id,
    });

    const [profileAfterStage] = await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, "user_a"));
    expect(profileAfterStage.headline).toBe("Senior Backend Engineer");
    expect(profileAfterStage.pendingReviewPayload?.experiences).toHaveLength(1);

    // Unsupported image file buffer fails cleanly
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    await expect(
      parseCvBufferWithAiService("user_a", {
        buffer: pngBuf,
        filename: "scan.png",
      }),
    ).rejects.toThrow(UnsupportedDocumentFormatError);
  });

  it("Feature B & C: evaluates 10 CV dimensions without hiring-probability claim and matches Profile + CV against job vacancy", async () => {
    const evalRes = await evaluateCvWithAiService(
      "user_a",
      { targetRole: "Staff Backend Engineer" },
      {
        registry: registryWithPayload({
          overallScore: 87,
          summary: "Clear impact metrics across core backend responsibilities.",
          categoryScores: CV_EVALUATION_CATEGORIES.map((category) => ({
            category,
            score: 87,
            evidence: "Reduced p99 latency by 40%.",
            feedback: "Strong coverage.",
          })),
          evidence: ["Reduced p99 latency by 40% at PT Nusantara Pay"],
          weaknesses: ["Missing Kubernetes certification"],
          recommendations: ["Quantify settlement throughput"],
          priorityActions: [
            {
              priority: "high",
              section: "skills",
              recommendation: "Highlight distributed systems tools",
              groundedReason: "Only Go currently verified.",
            },
          ],
        }),
      },
    );

    expect(evalRes.status).toBe("completed");
    if (evalRes.status !== "completed") throw new Error("Expected completed");
    expect(evalRes.data.categoryScores).toHaveLength(10);
    expect(evalRes.data.scoreDisclaimer).toContain("not measure or predict hiring probability");

    // Create a CV text document + Vacancy for Feature C
    const cvDoc = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "custom_cv",
        title: "Backend Plain CV",
        versionLabel: "v1-txt",
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from("Alice Pratama - Senior Go Engineer with 7 years payment API design.", "utf8"),
        filename: "alice-cv.txt",
      },
    });

    const vacancy = await createVacancyService("user_a", {
      companyName: "Garuda Fintech",
      title: "Staff Backend Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["Go", "Kafka"],
      description: "Looking for Go payment engineers familiar with Kafka.",
      discoveredOn: "2026-11-17",
    });

    const matchRes = await matchJobWithAiService(
      "user_a",
      {
        vacancyId: vacancy.id,
        documentVersionId: cvDoc.version.id,
      },
      {
        registry: registryWithPayload({
          overallMatchScore: 84,
          confidenceScore: 91,
          summary: "Strong Go match; Kafka gap noted.",
          matchingSkills: ["Go"],
          missingSkills: ["Kafka"],
          qualificationGaps: ["No verified Kafka production experience"],
          transferableSkills: ["Idempotent payment APIs"],
          recommendations: ["Emphasize async settlement queues"],
          requirementMatches: [],
          missingRequirements: ["Kafka"],
          tailoredPitchPoints: ["40% latency reduction"],
          riskFlags: [],
        }),
      },
    );

    expect(matchRes.status).toBe("completed");
    if (matchRes.status !== "completed") throw new Error("Expected completed");
    expect(matchRes.data.matchingSkills).toEqual(["Go"]);
    expect(matchRes.data.missingSkills).toEqual(["Kafka"]);

    const detail = await getAiAnalysisDetailForUser("user_a", matchRes.analysisId);
    const sourceTypes = new Set(detail?.sources.map((s) => s.sourceType));
    expect(sourceTypes.has("career_profile")).toBe(true);
    expect(sourceTypes.has("document_version")).toBe(true);
    expect(sourceTypes.has("job_vacancy")).toBe(true);
  });

  it("Feature D & E: requires user approval before applying CV corrections and saves generated PDF/DOCX as new CV versions without overwriting originals", async () => {
    const origDoc = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Master CV",
        versionLabel: "v1-original",
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from("Worked on payment APIs.", "utf8"),
        filename: "master-cv.txt",
      },
    });

    // Feature D: Suggest corrections
    const corrRes = await suggestCvCorrectionsWithAiService(
      "user_a",
      { documentVersionId: origDoc.version.id },
      {
        registry: registryWithPayload({
          overallScore: 76,
          summary: "Two targeted wording improvements.",
          suggestions: [
            {
              section: "experience_bullet",
              originalText: "Worked on payment APIs.",
              suggestedText: "Engineered idempotent payment APIs and reduced p99 latency by 40%.",
              reason: "Uses verified outcome from Master Career Profile.",
              category: "achievement_improvement",
              groundedInProfileFact: "PT Nusantara Pay achievement",
            },
            {
              section: "summary",
              originalText: "Backend dev.",
              suggestedText: "Senior Backend Engineer with 7 years in Jakarta fintech.",
              reason: "Clearer positioning.",
              category: "professional_wording",
              groundedInProfileFact: "Master profile headline & years",
            },
          ],
          requiresUserReview: true,
        }),
      },
    );
    expect(corrRes.status).toBe("completed");
    if (corrRes.status !== "completed") throw new Error("Expected completed");

    // Must reject applying with empty approval list
    await expect(
      applyApprovedCvCorrectionsService("user_a", {
        analysisId: corrRes.analysisId,
        approvedIndexes: [],
      }),
    ).rejects.toThrow();

    // Approve ONLY index 0 and save as a NEW version on existing document
    const applied = await applyApprovedCvCorrectionsService("user_a", {
      analysisId: corrRes.analysisId,
      approvedIndexes: [0],
      baseText: "Worked on payment APIs.",
      saveAsNewDocumentVersion: true,
      documentId: origDoc.documentId,
      versionLabel: "v2-approved-edits",
    });

    expect(applied.approvedCount).toBe(1);
    expect(applied.revisedText).toContain("reduced p99 latency by 40%");
    expect(applied.createdVersion?.versionNo).toBe(2);

    // Original v1 document version remains completely intact
    const allVersions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, origDoc.documentId));
    expect(allVersions).toHaveLength(2);
    expect(allVersions.find((v) => v.versionNo === 1)?.sha256).toBe(
      origDoc.version.sha256,
    );

    const fbRows = await db
      .select()
      .from(aiFeedback)
      .where(eq(aiFeedback.analysisId, corrRes.analysisId));
    expect(fbRows[0]?.actionTaken).toBe("partially_accepted");

    // Feature E: Generate Indonesian CV & export PDF/DOCX + save new version
    const genRes = await generateTailoredCvWithAiService(
      "user_a",
      {
        targetRole: "Staff Backend Engineer",
        cvFormat: "indonesian_cv",
        templateStyle: "technical",
      },
      {
        registry: registryWithPayload({
          cvFormat: "indonesian_cv",
          templateStyle: "technical",
          targetRole: "Staff Backend Engineer",
          candidateName: "Alice Pratama",
          contactLine: "Jakarta | alice@example.com",
          tailoredHeadline: "Senior Backend Engineer - Fintech Payments",
          tailoredSummary: "Berpengalaman 7 tahun membangun sistem pembayaran di Jakarta.",
          highlightedExperiences: [
            {
              companyName: "PT Nusantara Pay",
              jobTitle: "Senior Backend Engineer",
              relevantBullets: ["Menurunkan latensi p99 sebesar 40%"],
            },
          ],
          prioritizedSkills: ["Go"],
          educations: [],
          projects: [],
          certifications: [],
          spokenLanguages: ["Bahasa Indonesia", "English"],
          groundedCitationIds: ["exp-1"],
          fabricationSelfCheck: "Hanya memakai fakta terverifikasi dari Master Career Profile.",
        }),
      },
    );
    expect(genRes.status).toBe("completed");
    if (genRes.status !== "completed") throw new Error("Expected completed");

    const pdfExport = await renderGeneratedCvExportService("user_a", {
      analysisId: genRes.analysisId,
      format: "pdf",
    });
    expect(pdfExport.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const docxExport = await renderGeneratedCvExportService("user_a", {
      analysisId: genRes.analysisId,
      format: "docx",
    });
    expect(docxExport.buffer.subarray(0, 2).toString("latin1")).toBe("PK");

    const savedPdfVer = await saveGeneratedCvAsDocumentVersionService("user_a", {
      analysisId: genRes.analysisId,
      exportFormat: "pdf",
      documentId: origDoc.documentId,
      versionLabel: "v3-ai-generated-pdf",
    });
    expect(savedPdfVer.version.versionNo).toBe(3);
    expect(savedPdfVer.mimeType).toBe("application/pdf");

    // Cross-user access prevention on export & version saving
    await expect(
      renderGeneratedCvExportService("user_b", {
        analysisId: genRes.analysisId,
        format: "pdf",
      }),
    ).rejects.toThrow("Generated CV analysis not found.");
  });

  it("Feature F: builds Career Roadmap from profile + application history and handles provider failures cleanly", async () => {
    const vacancy = await createVacancyService("user_a", {
      companyName: "IndoBank Digital",
      title: "Staff Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["Go", "Kubernetes"],
      discoveredOn: "2026-11-10",
    });

    await recordSubmissionService("user_a", {
      vacancyId: vacancy.id,
      submittedOn: "2026-11-11",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, "user_a"));
    expect(apps).toHaveLength(1);

    const roadmapRes = await generateCareerRoadmapWithAiService(
      "user_a",
      { targetRole: "Staff Backend Engineer" },
      {
        registry: registryWithPayload({
          targetRole: "Staff Backend Engineer",
          readinessScore: 81,
          summary: "Strong backend trajectory; focus on platform architecture.",
          careerStrengths: [
            {
              strength: "Payment API Reliability",
              groundedEvidence: "Reduced p99 latency by 40% at PT Nusantara Pay",
            },
          ],
          developmentGaps: [
            {
              gap: "Kubernetes production orchestration",
              priority: "high",
              groundedReason: "Not listed in verified skills.",
            },
          ],
          targetRoles: ["Staff Backend Engineer", "Principal Payment Architect"],
          recommendedSkills: [
            {
              skill: "Kubernetes",
              priority: "high",
              reason: "Requested across shortlisted Staff Engineer roles.",
            },
          ],
          learningPriorities: ["Kubernetes operators & multi-region failover"],
          milestones: [
            {
              phase: "Quarter 1-2",
              timeframe: "Months 1-6",
              focusArea: "Platform Infrastructure",
              actions: ["Complete CKAD labs"],
              measurableOutcome: "2 production Helm charts",
            },
          ],
          sixMonthPlan: [
            {
              phase: "6-Month Foundation",
              timeframe: "Months 1-6",
              focusArea: "Kubernetes & Observability",
              actions: ["Ship OpenTelemetry tracing"],
              measurableOutcome: "End-to-end p99 SLO dashboard",
            },
          ],
          twelveMonthPlan: [
            {
              phase: "12-Month Leadership",
              timeframe: "Months 7-12",
              focusArea: "Staff Architecture Scope",
              actions: ["Lead cross-squad settlement RFC"],
              measurableOutcome: "Adopted architecture RFC",
            },
          ],
          recommendedCertifications: ["CKAD"],
          recommendedProjects: ["Distributed Ledger Benchmark"],
          verifiedFacts: ["7 years experience; active application to IndoBank Digital"],
          aiInferences: [
            {
              inference: "Adding Kubernetes evidence aligns well with fintech Staff roles.",
              basis: "Vacancy skill requirements vs verified profile",
              confidence: "high",
            },
          ],
          applicationHistoryInsights: {
            applicationsAnalyzed: 1,
            documentedOutcomesSummary: "1 active application submitted on 2026-11-11.",
            unknownRejectionReasonsNote:
              "No rejection reasons are documented in history; none inferred.",
          },
        }),
      },
    );

    expect(roadmapRes.status).toBe("completed");
    if (roadmapRes.status !== "completed") throw new Error("Expected completed");
    expect(roadmapRes.data.sixMonthPlan).toHaveLength(1);
    expect(roadmapRes.data.twelveMonthPlan).toHaveLength(1);
    expect(roadmapRes.data.verifiedFacts.length).toBeGreaterThan(0);
    expect(roadmapRes.data.aiInferences.length).toBeGreaterThan(0);

    const detail = await getAiAnalysisDetailForUser(
      "user_a",
      roadmapRes.analysisId,
    );
    expect(detail?.sources.some((s) => s.sourceType === "application")).toBe(
      true,
    );

    // Provider error handling check
    await expect(
      generateCareerRoadmapWithAiService(
        "user_a",
        { targetRole: "Staff Backend Engineer" },
        { registry: registryWithPayload({}, { status: 503 }) },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    // Persisted completed analysis remains queryable
    const allSaved = await db
      .select()
      .from(aiCareerAnalyses)
      .where(eq(aiCareerAnalyses.userId, "user_a"));
    expect(allSaved.some((a) => a.id === roadmapRes.analysisId)).toBe(true);
  });
});
