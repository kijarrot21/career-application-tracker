import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  companies,
  jobSources,
  jobVacancies,
  recruiterContacts,
  suitabilityEvaluations,
  userSettings,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  JOB_PRIORITIES,
  SALARY_PERIODS,
  TRIAGE_STATUSES,
  WORK_ARRANGEMENTS,
  type TriageStatus,
} from "@/lib/constants";
import { todayInTimeZone } from "@/lib/domain/business-days";
import {
  detectSource,
  extractExternalJobId,
  normalizeCompanyName,
  normalizeUrl,
} from "@/lib/domain/duplicates";
import {
  DEFAULT_WEIGHTS,
  EDUCATION_LEVELS,
  overallScore,
  suggestScores,
  type Criterion,
} from "@/lib/domain/suitability";
import { formatCode } from "@/lib/format";
import { getProfileForSuitabilityScoring } from "@/server/queries/career-profile";
import { getUserSettings } from "@/server/queries/settings";

export const vacancyInputSchema = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required").max(160),
    companyIndustry: z.string().trim().max(120).optional().nullable(),
    companyWebsite: z.string().trim().max(300).optional().nullable(),
    title: z.string().trim().min(1, "Position title is required").max(200),
    department: z.string().trim().max(120).optional().nullable(),
    industry: z.string().trim().max(120).optional().nullable(),
    location: z.string().trim().max(160).optional().nullable(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
    workArrangement: z.enum(WORK_ARRANGEMENTS).optional().nullable(),
    salaryMin: z.number().int().nonnegative().optional().nullable(),
    salaryMax: z.number().int().nonnegative().optional().nullable(),
    currency: z.enum(CURRENCIES).default("IDR"),
    salaryPeriod: z.enum(SALARY_PERIODS).default("month"),
    requiredExperienceYears: z.number().int().min(0).max(50).optional().nullable(),
    requiredEducation: z.enum(EDUCATION_LEVELS).optional().nullable(),
    qualifications: z.string().trim().max(10000).optional().nullable(),
    description: z.string().trim().max(25000).optional().nullable(),
    skills: z.array(z.string().trim().min(1)).default([]),
    url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((v) => !v || /^https?:\/\//i.test(v), "URL must start with http:// or https://"),
    sourceId: z.string().uuid().optional().nullable(),
    externalJobId: z.string().trim().max(120).optional().nullable(),
    deadline: z.string().trim().optional().nullable(),
    discoveredOn: z.string().trim().optional().nullable(),
    priority: z.enum(JOB_PRIORITIES).default("medium"),
    triageStatus: z.enum(TRIAGE_STATUSES).default("new"),
    recruiterName: z.string().trim().max(140).optional().nullable(),
    recruiterEmail: z.string().trim().max(160).optional().nullable(),
    recruiterPhone: z.string().trim().max(80).optional().nullable(),
    notes: z.string().trim().max(10000).optional().nullable(),
  })
  .refine(
    (d) =>
      d.salaryMin == null ||
      d.salaryMax == null ||
      d.salaryMin <= d.salaryMax,
    {
      message: "Minimum salary cannot exceed maximum salary",
      path: ["salaryMax"],
    },
  );

export type VacancyInput = z.infer<typeof vacancyInputSchema>;

async function resolveOrCreateCompany(
  userId: string,
  name: string,
  extra?: { industry?: string | null; location?: string | null; website?: string | null },
) {
  const db = await ensureDbReady();
  const norm = normalizeCompanyName(name) || name.toLowerCase().trim();
  const existing = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.normalizedName, norm)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(companies)
    .values({
      userId,
      name: name.trim(),
      normalizedName: norm,
      industry: extra?.industry ?? null,
      location: extra?.location ?? null,
      website: extra?.website ?? null,
    })
    .returning();
  return created;
}

async function resolveSourceId(
  userId: string,
  explicitSourceId: string | null | undefined,
  url: string | null | undefined,
): Promise<string | null> {
  if (explicitSourceId) return explicitSourceId;
  if (!url) return null;
  const detectedKey = detectSource(url);
  if (!detectedKey) return null;
  const db = await ensureDbReady();
  const [src] = await db
    .select()
    .from(jobSources)
    .where(
      and(
        eq(jobSources.key, detectedKey),
        or(isNull(jobSources.userId), eq(jobSources.userId, userId)),
      ),
    )
    .limit(1);
  return src?.id ?? null;
}

export async function createVacancyService(userId: string, rawInput: VacancyInput) {
  const input = vacancyInputSchema.parse(rawInput);
  const db = await ensureDbReady();
  const [settings, profileForScoring] = await Promise.all([
    getUserSettings(userId),
    getProfileForSuitabilityScoring(userId),
  ]);
  const today = todayInTimeZone(settings.timezone);

  const normUrl = input.url ? normalizeUrl(input.url) : null;
  if (normUrl) {
    const dup = await db
      .select({ id: jobVacancies.id, code: jobVacancies.code })
      .from(jobVacancies)
      .where(and(eq(jobVacancies.userId, userId), eq(jobVacancies.normalizedUrl, normUrl)))
      .limit(1);
    if (dup.length > 0) {
      throw new Error(`A job vacancy with this URL already exists (${dup[0].code}).`);
    }
  }

  const company = await resolveOrCreateCompany(userId, input.companyName, {
    industry: input.companyIndustry ?? input.industry,
    location: input.location,
    website: input.companyWebsite,
  });

  const sourceId = await resolveSourceId(userId, input.sourceId, input.url);
  const externalJobId =
    input.externalJobId || (input.url ? extractExternalJobId(input.url) : null);

  if (input.recruiterName) {
    await db.insert(recruiterContacts).values({
      userId,
      companyId: company.id,
      name: input.recruiterName,
      email: input.recruiterEmail ?? null,
      phone: input.recruiterPhone ?? null,
    });
  }

  const suggestions = suggestScores(
    {
      skills: input.skills,
      requiredExperienceYears: input.requiredExperienceYears ?? null,
      requiredEducation: input.requiredEducation ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currency: input.currency,
      location: input.location ?? null,
      workArrangement: input.workArrangement ?? null,
    },
    profileForScoring,
  );

  const initialScores = {
    skills: suggestions.skills.score,
    experience: suggestions.experience.score,
    education: suggestions.education.score,
    salary: suggestions.salary.score,
    location: suggestions.location.score,
    growth: null,
  };
  const initialOverall = overallScore(initialScores, settings.suitabilityWeights);

  const code = formatCode("JOB", settings.nextJobSeq);

  const [vacancy] = await db
    .insert(jobVacancies)
    .values({
      userId,
      code,
      companyId: company.id,
      sourceId,
      title: input.title,
      department: input.department || null,
      industry: input.industry || input.companyIndustry || null,
      location: input.location || null,
      employmentType: input.employmentType ?? null,
      workArrangement: input.workArrangement ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currency: input.currency,
      salaryPeriod: input.salaryPeriod,
      requiredExperienceYears: input.requiredExperienceYears ?? null,
      requiredEducation: input.requiredEducation ?? null,
      qualifications: input.qualifications || null,
      description: input.description || null,
      skills: input.skills,
      url: input.url || null,
      normalizedUrl: normUrl,
      externalJobId: externalJobId || null,
      deadline: input.deadline || null,
      discoveredOn: input.discoveredOn || today,
      priority: input.priority,
      triageStatus: input.triageStatus,
      triagedAt: input.triageStatus !== "new" ? new Date() : null,
      suitabilityScore: initialOverall,
      notes: input.notes || null,
    })
    .returning();

  await db.insert(suitabilityEvaluations).values({
    userId,
    vacancyId: vacancy.id,
    skillsScore: initialScores.skills,
    experienceScore: initialScores.experience,
    educationScore: initialScores.education,
    salaryScore: initialScores.salary,
    locationScore: initialScores.location,
    growthScore: null,
    suggestions,
    weights: settings.suitabilityWeights ?? DEFAULT_WEIGHTS,
    overallScore: initialOverall,
  });

  await db
    .update(userSettings)
    .set({ nextJobSeq: settings.nextJobSeq + 1 })
    .where(eq(userSettings.userId, userId));

  await writeAudit(db, {
    userId,
    entityType: "job_vacancy",
    entityId: vacancy.id,
    action: "create",
    summary: `Created vacancy ${vacancy.code}: ${vacancy.title} at ${company.name}`,
  });

  return vacancy;
}

export async function updateVacancyService(
  userId: string,
  vacancyId: string,
  rawInput: VacancyInput,
) {
  const input = vacancyInputSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [existing] = await db
    .select()
    .from(jobVacancies)
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)));
  if (!existing) {
    throw new Error("Vacancy not found.");
  }

  const normUrl = input.url ? normalizeUrl(input.url) : null;
  if (normUrl && normUrl !== existing.normalizedUrl) {
    const dup = await db
      .select({ id: jobVacancies.id, code: jobVacancies.code })
      .from(jobVacancies)
      .where(and(eq(jobVacancies.userId, userId), eq(jobVacancies.normalizedUrl, normUrl)))
      .limit(1);
    if (dup.length > 0 && dup[0].id !== vacancyId) {
      throw new Error(`Another vacancy already uses this URL (${dup[0].code}).`);
    }
  }

  const company = await resolveOrCreateCompany(userId, input.companyName, {
    industry: input.companyIndustry ?? input.industry,
    location: input.location,
    website: input.companyWebsite,
  });
  const sourceId = await resolveSourceId(userId, input.sourceId, input.url);
  const externalJobId =
    input.externalJobId || (input.url ? extractExternalJobId(input.url) : null);

  const [updated] = await db
    .update(jobVacancies)
    .set({
      companyId: company.id,
      sourceId,
      title: input.title,
      department: input.department || null,
      industry: input.industry || null,
      location: input.location || null,
      employmentType: input.employmentType ?? null,
      workArrangement: input.workArrangement ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currency: input.currency,
      salaryPeriod: input.salaryPeriod,
      requiredExperienceYears: input.requiredExperienceYears ?? null,
      requiredEducation: input.requiredEducation ?? null,
      qualifications: input.qualifications || null,
      description: input.description || null,
      skills: input.skills,
      url: input.url || null,
      normalizedUrl: normUrl,
      externalJobId: externalJobId || null,
      deadline: input.deadline || null,
      discoveredOn: input.discoveredOn || existing.discoveredOn,
      priority: input.priority,
      triageStatus: input.triageStatus,
      notes: input.notes || null,
    })
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "job_vacancy",
    entityId: vacancyId,
    action: "update",
    summary: `Updated vacancy ${existing.code}`,
  });

  return updated;
}

export async function setVacancyTriageService(
  userId: string,
  vacancyId: string,
  triageStatus: TriageStatus,
) {
  const db = await ensureDbReady();
  const [updated] = await db
    .update(jobVacancies)
    .set({
      triageStatus,
      triagedAt: new Date(),
    })
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Vacancy not found.");
  }

  await writeAudit(db, {
    userId,
    entityType: "job_vacancy",
    entityId: vacancyId,
    action: "triage_change",
    summary: `Changed triage of ${updated.code} to ${triageStatus}`,
  });

  return updated;
}

export const suitabilityInputSchema = z.object({
  skills: z.number().int().min(0).max(100).nullable(),
  experience: z.number().int().min(0).max(100).nullable(),
  education: z.number().int().min(0).max(100).nullable(),
  salary: z.number().int().min(0).max(100).nullable(),
  location: z.number().int().min(0).max(100).nullable(),
  growth: z.number().int().min(0).max(100).nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function saveSuitabilityService(
  userId: string,
  vacancyId: string,
  rawScores: z.infer<typeof suitabilityInputSchema>,
) {
  const scores = suitabilityInputSchema.parse(rawScores);
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);

  const [vacancy] = await db
    .select()
    .from(jobVacancies)
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)));
  if (!vacancy) throw new Error("Vacancy not found.");

  const scoreMap: Record<Criterion, number | null> = {
    skills: scores.skills,
    experience: scores.experience,
    education: scores.education,
    salary: scores.salary,
    location: scores.location,
    growth: scores.growth,
  };
  const overall = overallScore(scoreMap, settings.suitabilityWeights);

  await db
    .insert(suitabilityEvaluations)
    .values({
      userId,
      vacancyId,
      skillsScore: scores.skills,
      experienceScore: scores.experience,
      educationScore: scores.education,
      salaryScore: scores.salary,
      locationScore: scores.location,
      growthScore: scores.growth,
      weights: settings.suitabilityWeights ?? DEFAULT_WEIGHTS,
      overallScore: overall,
      notes: scores.notes ?? null,
    })
    .onConflictDoUpdate({
      target: suitabilityEvaluations.vacancyId,
      set: {
        skillsScore: scores.skills,
        experienceScore: scores.experience,
        educationScore: scores.education,
        salaryScore: scores.salary,
        locationScore: scores.location,
        growthScore: scores.growth,
        weights: settings.suitabilityWeights ?? DEFAULT_WEIGHTS,
        overallScore: overall,
        notes: scores.notes ?? null,
        updatedAt: new Date(),
      },
    });

  await db
    .update(jobVacancies)
    .set({ suitabilityScore: overall, updatedAt: new Date() })
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)));

  return { overallScore: overall };
}

export async function deleteVacancyService(userId: string, vacancyId: string) {
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(jobVacancies)
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)))
    .returning();
  if (!deleted) throw new Error("Vacancy not found.");

  await writeAudit(db, {
    userId,
    entityType: "job_vacancy",
    entityId: vacancyId,
    action: "delete",
    summary: `Deleted vacancy ${deleted.code} (${deleted.title})`,
  });
  return deleted;
}
