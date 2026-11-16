import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  companies,
  jobSources,
  jobVacancies,
  userSettings,
} from "@/db/schema";
import { ensureUserInitialized } from "@/db/seed/system";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/domain/suitability";

export async function getUserSettings(userId: string) {
  const db = await ensureDbReady();
  await ensureUserInitialized(db, userId);
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return {
    ...settings,
    suitabilityWeights: (settings.suitabilityWeights ?? DEFAULT_WEIGHTS) as Weights,
  };
}

export async function getUserStages(userId: string, includeHidden: boolean = false) {
  const db = await ensureDbReady();
  await ensureUserInitialized(db, userId);
  const rows = await db
    .select()
    .from(applicationStages)
    .where(
      includeHidden
        ? eq(applicationStages.userId, userId)
        : and(eq(applicationStages.userId, userId), eq(applicationStages.isHidden, false)),
    )
    .orderBy(asc(applicationStages.sortOrder), asc(applicationStages.createdAt));
  return rows;
}

export async function getJobSources(userId: string) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(jobSources)
    .where(or(isNull(jobSources.userId), eq(jobSources.userId, userId)))
    .orderBy(asc(jobSources.name));
}

export async function getSampleDataStatus(userId: string) {
  const db = await ensureDbReady();
  const [{ sampleJobs }] = await db
    .select({ sampleJobs: sql<number>`count(*)::int` })
    .from(jobVacancies)
    .where(and(eq(jobVacancies.userId, userId), eq(jobVacancies.isSample, true)));
  const [{ sampleApps }] = await db
    .select({ sampleApps: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.isSample, true)));
  const [{ realApps }] = await db
    .select({ realApps: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.isSample, false)));
  const [{ sampleCompanies }] = await db
    .select({ sampleCompanies: sql<number>`count(*)::int` })
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.isSample, true)));

  return {
    hasSampleData: sampleJobs > 0 || sampleApps > 0 || sampleCompanies > 0,
    sampleJobsCount: sampleJobs,
    sampleAppsCount: sampleApps,
    realAppsCount: realApps,
  };
}
