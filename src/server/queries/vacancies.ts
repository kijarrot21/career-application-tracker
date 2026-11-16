import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  companies,
  jobSources,
  jobVacancies,
  suitabilityEvaluations,
} from "@/db/schema";
import type { JobPriority, TriageStatus } from "@/lib/constants";
import {
  normalizeCompanyName,
  normalizeTitle,
  normalizeUrl,
} from "@/lib/domain/duplicates";
import { suggestScores } from "@/lib/domain/suitability";
import { getUserSettings } from "./settings";

export interface VacancyFilters {
  search?: string;
  triageStatus?: TriageStatus | "all";
  priority?: JobPriority | "all";
  sourceId?: string | "all";
  workArrangement?: "onsite" | "hybrid" | "remote" | "all";
  industry?: string;
  sort?: "newest" | "score_desc" | "deadline_asc" | "salary_desc";
}

export async function listVacancies(userId: string, filters: VacancyFilters = {}) {
  const db = await ensureDbReady();

  const rows = await db
    .select({
      vacancy: jobVacancies,
      company: companies,
      source: jobSources,
    })
    .from(jobVacancies)
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .leftJoin(jobSources, eq(jobVacancies.sourceId, jobSources.id))
    .where(
      and(
        eq(jobVacancies.userId, userId),
        filters.triageStatus && filters.triageStatus !== "all"
          ? eq(jobVacancies.triageStatus, filters.triageStatus)
          : undefined,
        filters.priority && filters.priority !== "all"
          ? eq(jobVacancies.priority, filters.priority)
          : undefined,
        filters.sourceId && filters.sourceId !== "all"
          ? eq(jobVacancies.sourceId, filters.sourceId)
          : undefined,
        filters.workArrangement && filters.workArrangement !== "all"
          ? eq(jobVacancies.workArrangement, filters.workArrangement)
          : undefined,
        filters.industry ? ilike(jobVacancies.industry, `%${filters.industry}%`) : undefined,
        filters.search
          ? or(
              ilike(jobVacancies.title, `%${filters.search}%`),
              ilike(companies.name, `%${filters.search}%`),
              ilike(jobVacancies.location, `%${filters.search}%`),
              ilike(jobVacancies.code, `%${filters.search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(
      filters.sort === "score_desc"
        ? desc(sql`coalesce(${jobVacancies.suitabilityScore}, -1)`)
        : filters.sort === "deadline_asc"
          ? asc(sql`coalesce(${jobVacancies.deadline}, '9999-12-31')`)
          : filters.sort === "salary_desc"
            ? desc(sql`coalesce(${jobVacancies.salaryMax}, ${jobVacancies.salaryMin}, 0)`)
            : desc(jobVacancies.discoveredOn),
      desc(jobVacancies.createdAt),
    );

  // Attach application summary per vacancy
  const vacancyIds = rows.map((r) => r.vacancy.id);
  const appRows =
    vacancyIds.length > 0
      ? await db
          .select({
            id: applications.id,
            code: applications.code,
            vacancyId: applications.vacancyId,
            outcome: applications.outcome,
            submittedOn: applications.submittedOn,
            stageName: applicationStages.name,
            stageColor: applicationStages.color,
          })
          .from(applications)
          .innerJoin(
            applicationStages,
            eq(applications.currentStageId, applicationStages.id),
          )
          .where(
            and(
              eq(applications.userId, userId),
              inArray(applications.vacancyId, vacancyIds),
            ),
          )
      : [];

  const appsByVacancy = new Map<string, typeof appRows>();
  for (const a of appRows) {
    const list = appsByVacancy.get(a.vacancyId) ?? [];
    list.push(a);
    appsByVacancy.set(a.vacancyId, list);
  }

  return rows.map((r) => ({
    ...r.vacancy,
    company: r.company,
    source: r.source,
    applications: appsByVacancy.get(r.vacancy.id) ?? [],
  }));
}

export async function listShortlistVacancies(userId: string) {
  const all = await listVacancies(userId, { sort: "score_desc" });
  return all.filter(
    (v) => v.triageStatus === "shortlisted" || v.triageStatus === "interested",
  );
}

export async function getVacancyDetail(userId: string, vacancyId: string) {
  const db = await ensureDbReady();
  const [row] = await db
    .select({
      vacancy: jobVacancies,
      company: companies,
      source: jobSources,
      evaluation: suitabilityEvaluations,
    })
    .from(jobVacancies)
    .innerJoin(
      companies,
      and(eq(jobVacancies.companyId, companies.id), eq(companies.userId, userId)),
    )
    .leftJoin(jobSources, eq(jobVacancies.sourceId, jobSources.id))
    .leftJoin(
      suitabilityEvaluations,
      and(
        eq(suitabilityEvaluations.vacancyId, jobVacancies.id),
        eq(suitabilityEvaluations.userId, userId),
      ),
    )
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)));

  if (!row) return null;

  const settings = await getUserSettings(userId);
  const computedSuggestions = suggestScores(
    {
      skills: row.vacancy.skills ?? [],
      requiredExperienceYears: row.vacancy.requiredExperienceYears,
      requiredEducation: row.vacancy.requiredEducation,
      salaryMin: row.vacancy.salaryMin,
      salaryMax: row.vacancy.salaryMax,
      currency: row.vacancy.currency,
      location: row.vacancy.location,
      workArrangement: row.vacancy.workArrangement,
    },
    {
      skills: settings.skills ?? [],
      yearsExperience: settings.yearsExperience,
      educationLevel: settings.educationLevel,
      expectedSalaryMin: settings.expectedSalaryMin,
      currency: settings.currency,
      preferredLocations: settings.preferredLocations ?? [],
      preferredArrangements: (settings.preferredArrangements ?? []) as (
        | "onsite"
        | "hybrid"
        | "remote"
      )[],
    },
  );

  const linkedApplications = await db
    .select({
      app: applications,
      stage: applicationStages,
    })
    .from(applications)
    .innerJoin(applicationStages, eq(applications.currentStageId, applicationStages.id))
    .where(and(eq(applications.userId, userId), eq(applications.vacancyId, vacancyId)))
    .orderBy(desc(applications.attemptNumber));

  return {
    ...row.vacancy,
    company: row.company,
    source: row.source,
    evaluation: row.evaluation,
    suggestions: computedSuggestions,
    weights: settings.suitabilityWeights,
    applications: linkedApplications.map((a) => ({
      ...a.app,
      stage: a.stage,
    })),
  };
}

export async function checkDuplicateVacancy(
  userId: string,
  params: {
    url?: string | null;
    companyName?: string | null;
    title?: string | null;
    excludeId?: string;
  },
) {
  const db = await ensureDbReady();
  const normUrl = params.url ? normalizeUrl(params.url) : null;

  if (normUrl) {
    const existingByUrl = await db
      .select({
        id: jobVacancies.id,
        code: jobVacancies.code,
        title: jobVacancies.title,
        companyName: companies.name,
      })
      .from(jobVacancies)
      .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
      .where(
        and(
          eq(jobVacancies.userId, userId),
          eq(jobVacancies.normalizedUrl, normUrl),
        ),
      );
    const match = existingByUrl.find((r) => r.id !== params.excludeId);
    if (match) {
      return {
        isDuplicateUrl: true,
        isSimilarRole: false,
        existing: match,
      };
    }
  }

  if (params.companyName && params.title) {
    const normCo = normalizeCompanyName(params.companyName);
    const normTitle = normalizeTitle(params.title);
    const candidates = await db
      .select({
        id: jobVacancies.id,
        code: jobVacancies.code,
        title: jobVacancies.title,
        companyName: companies.name,
        normalizedCompanyName: companies.normalizedName,
      })
      .from(jobVacancies)
      .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
      .where(eq(jobVacancies.userId, userId));

    const match = candidates.find(
      (c) =>
        c.id !== params.excludeId &&
        c.normalizedCompanyName.replace(/ sample$/, "") === normCo &&
        normalizeTitle(c.title) === normTitle,
    );
    if (match) {
      return {
        isDuplicateUrl: false,
        isSimilarRole: true,
        existing: match,
      };
    }
  }

  return { isDuplicateUrl: false, isSimilarRole: false, existing: null };
}
