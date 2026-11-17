import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  applicationClosureRecords,
  applications,
  companies,
  documentVersions,
  interviews,
  jobVacancies,
} from "@/db/schema";
import type { AiLocale, AiProviderId } from "@/lib/domain/ai";
import { readDocumentFile } from "@/lib/storage";
import { getMasterCareerProfile } from "@/server/queries/career-profile";
import { extractTextFromDocumentBuffer } from "../extractors/document-text-extractor";
import type { AiProviderRegistry } from "../providers";
import type { AiTaskSourceInput } from "../router/ai-task-router";
import { canonicalSha256, wrapUntrustedDataBlock } from "../security/prompt-guard";

export const aiExecutionOptionsSchema = z.object({
  locale: z.enum(["id", "en"]).optional(),
  requestedProvider: z.enum(["ollama", "openai", "gemini"]).optional(),
  requestedModel: z.string().trim().min(1).max(120).optional(),
  consentGranted: z.boolean().optional(),
  onConsentRequired: z.enum(["pause", "throw"]).optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
  timeoutMs: z.number().int().min(1000).max(180000).optional(),
  checkAvailability: z.boolean().optional(),
  pricingKey: z.string().trim().min(1).max(100).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export interface AiServiceRuntimeOptions {
  locale?: AiLocale;
  requestedProvider?: AiProviderId;
  requestedModel?: string;
  consentGranted?: boolean;
  onConsentRequired?: "pause" | "throw";
  maxAttempts?: number;
  timeoutMs?: number;
  checkAvailability?: boolean;
  registry?: AiProviderRegistry;
}

/**
 * Loads the user's verified Master Career Profile records (strictly filtering
 * `verificationStatus === "verified"` where applicable) for grounded AI context.
 */
export async function loadGroundedProfileContext(userId: string) {
  const master = await getMasterCareerProfile(userId);

  const verifiedProfile = {
    profileId: master.profile.id,
    fullName: master.profile.fullName,
    headline: master.profile.headline,
    summary: master.profile.summary,
    location: master.profile.location,
    country: master.profile.country,
    preferredLanguage: master.profile.preferredLanguage,
    careerLevel: master.profile.careerLevel,
    totalExperienceYears: master.profile.totalExperienceYears,
    targetPositions: master.profile.targetPositions,
    targetIndustries: master.profile.targetIndustries,
    preferredLocations: master.profile.preferredLocations,
    preferredArrangements: master.profile.preferredArrangements,
    salaryCurrency: master.profile.salaryCurrency,
    expectedSalaryMin: master.profile.expectedSalaryMin,
    expectedSalaryMax: master.profile.expectedSalaryMax,
    experiences: master.experiences
      .filter((e) => e.verificationStatus === "verified")
      .map((e) => ({
        id: e.id,
        companyName: e.companyName,
        jobTitle: e.jobTitle,
        employmentType: e.employmentType,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        responsibilities: e.responsibilities,
        achievements: e.achievements,
      })),
    educations: master.educations
      .filter((ed) => ed.verificationStatus === "verified")
      .map((ed) => ({
        id: ed.id,
        institution: ed.institution,
        qualification: ed.qualification,
        degreeTitle: ed.degreeTitle,
        fieldOfStudy: ed.fieldOfStudy,
        graduationYear: ed.graduationYear,
        gpa: ed.gpa,
      })),
    skills: master.skills
      .filter((s) => s.isUserVerified && s.verificationStatus === "verified")
      .map((s) => ({
        id: s.id,
        skillName: s.skillName,
        category: s.category,
        proficiencyLevel: s.proficiencyLevel,
        yearsOfExperience: s.yearsOfExperience,
        evidence: s.evidence,
      })),
    certifications: master.certifications
      .filter((c) => c.verificationStatus === "verified")
      .map((c) => ({
        id: c.id,
        name: c.name,
        issuingOrganization: c.issuingOrganization,
        issueDate: c.issueDate,
        expirationDate: c.expirationDate,
      })),
    projects: master.projects
      .filter((p) => p.verificationStatus === "verified")
      .map((p) => ({
        id: p.id,
        name: p.name,
        organization: p.organization,
        role: p.role,
        startDate: p.startDate,
        endDate: p.endDate,
        isOngoing: p.isOngoing,
        description: p.description,
        achievements: p.achievements,
        technologies: p.technologies,
      })),
  };

  const source: AiTaskSourceInput = {
    sourceType: "career_profile",
    sourceId: master.profile.id,
    sourceLabel: master.profile.fullName,
    sourceHash: canonicalSha256(verifiedProfile),
    isUntrustedExternal: false,
    injectionSignalCount: 0,
  };

  return {
    verifiedProfile,
    serializedJson: JSON.stringify(verifiedProfile, null, 2),
    source,
  };
}

/**
 * Loads a user-owned vacancy and wraps its untrusted external description cleanly.
 */
export async function loadUntrustedVacancyContext(
  userId: string,
  vacancyId: string,
) {
  const db = await ensureDbReady();
  const [row] = await db
    .select({
      vacancy: jobVacancies,
      companyName: companies.name,
    })
    .from(jobVacancies)
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(
      and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)),
    );

  if (!row) {
    throw new Error("Job vacancy not found.");
  }

  const rawText = [
    `Title: ${row.vacancy.title}`,
    `Company: ${row.companyName}`,
    row.vacancy.location ? `Location: ${row.vacancy.location}` : null,
    row.vacancy.workArrangement
      ? `Arrangement: ${row.vacancy.workArrangement}`
      : null,
    row.vacancy.requiredExperienceYears != null
      ? `Required Experience Years: ${row.vacancy.requiredExperienceYears}`
      : null,
    row.vacancy.requiredEducation
      ? `Required Education: ${row.vacancy.requiredEducation}`
      : null,
    row.vacancy.skills.length > 0
      ? `Listed Skills: ${row.vacancy.skills.join(", ")}`
      : null,
    row.vacancy.qualifications
      ? `Qualifications:\n${row.vacancy.qualifications}`
      : null,
    row.vacancy.description
      ? `Description:\n${row.vacancy.description}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const guarded = wrapUntrustedDataBlock("job_vacancy_description", rawText);

  const source: AiTaskSourceInput = {
    sourceType: "job_vacancy",
    sourceId: row.vacancy.id,
    sourceLabel: `${row.companyName} - ${row.vacancy.title}`,
    sourceHash: guarded.sourceHash,
    isUntrustedExternal: true,
    injectionSignalCount: guarded.injectionSignals.length,
  };

  return {
    vacancy: row.vacancy,
    companyName: row.companyName,
    guarded,
    source,
  };
}

/**
 * Loads readable text for a user-owned `document_version` (PDF, DOCX, TXT, MD)
 * or explicit raw text. Throws UnsupportedDocumentFormatError for unsupported formats.
 */
export async function resolveDocumentTextInput(
  userId: string,
  params: { documentVersionId?: string | null; rawText?: string | null },
): Promise<{
  rawText: string;
  sourceType: "document_version" | "raw_text";
  sourceId: string | null;
  sourceLabel: string;
}> {
  if (params.documentVersionId) {
    const db = await ensureDbReady();
    const [ver] = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.id, params.documentVersionId),
          eq(documentVersions.userId, userId),
        ),
      );
    if (!ver) {
      throw new Error("Document version not found.");
    }

    let text = params.rawText?.trim() ?? "";
    if (!text && ver.storageKey) {
      const buf = readDocumentFile(ver.storageKey);
      if (buf) {
        const extracted = extractTextFromDocumentBuffer(
          buf,
          ver.filename || ver.label || "document.txt",
        );
        text = extracted.text;
      }
    }

    if (!text) {
      throw new Error(
        "No readable text found on selected document version. Upload a PDF/DOCX/TXT/MD file or provide cvText explicitly.",
      );
    }

    return {
      rawText: text,
      sourceType: "document_version",
      sourceId: ver.id,
      sourceLabel: ver.label || ver.filename || "Uploaded CV",
    };
  }

  const text = params.rawText?.trim() ?? "";
  if (!text) {
    throw new Error("CV text cannot be empty.");
  }

  return {
    rawText: text,
    sourceType: "raw_text",
    sourceId: null,
    sourceLabel: "Pasted CV Text",
  };
}

/**
 * Loads factual application, interview, and closure history for grounded Career Roadmap.
 * Never fabricates employer rejection reasons when none are recorded.
 */
export async function loadApplicationHistoryContext(userId: string) {
  const db = await ensureDbReady();
  const [userApps, closures, userInterviews] = await Promise.all([
    db
      .select({
        id: applications.id,
        outcome: applications.outcome,
        submittedOn: applications.submittedOn,
        vacancyTitle: jobVacancies.title,
        companyName: companies.name,
      })
      .from(applications)
      .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
      .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.submittedOn))
      .limit(30),
    db
      .select({
        closureOutcome: applicationClosureRecords.closureOutcome,
        closureReason: applicationClosureRecords.closureReason,
        closureNote: applicationClosureRecords.closureNote,
        closedOn: applicationClosureRecords.closedOn,
      })
      .from(applicationClosureRecords)
      .where(eq(applicationClosureRecords.userId, userId))
      .orderBy(desc(applicationClosureRecords.closedOn))
      .limit(20),
    db
      .select({
        interviewType: interviews.interviewType,
        status: interviews.status,
        result: interviews.result,
        feedback: interviews.feedback,
      })
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.startsAt))
      .limit(20),
  ]);

  const outcomeCounts: Record<string, number> = {};
  for (const app of userApps) {
    outcomeCounts[app.outcome] = (outcomeCounts[app.outcome] ?? 0) + 1;
  }

  const documentedFeedbackNotes = [
    ...closures
      .filter((c) => c.closureReason || c.closureNote)
      .map(
        (c) =>
          `[${c.closureOutcome} on ${c.closedOn}] Reason: ${c.closureReason ?? "Not recorded"}${c.closureNote ? ` | Note: ${c.closureNote}` : ""}`,
      ),
    ...userInterviews
      .filter((iv) => iv.feedback)
      .map(
        (iv) =>
          `[Interview ${iv.interviewType} (${iv.result})] Feedback: ${iv.feedback}`,
      ),
  ];

  const payload = {
    totalApplicationsAnalyzed: userApps.length,
    outcomeCounts,
    recentTargetTitles: [...new Set(userApps.map((a) => a.vacancyTitle))].slice(
      0,
      10,
    ),
    documentedFeedbackNotes,
    hasDocumentedRejectionReasons: closures.some(
      (c) => c.closureOutcome === "rejected" && Boolean(c.closureReason),
    ),
  };

  return {
    history: payload,
    serializedJson: JSON.stringify(payload, null, 2),
    source: {
      sourceType: "application" as const,
      sourceId: null,
      sourceLabel: `Application History (${userApps.length} application(s))`,
      sourceHash: canonicalSha256(payload),
      isUntrustedExternal: false,
      injectionSignalCount: 0,
    },
  };
}
