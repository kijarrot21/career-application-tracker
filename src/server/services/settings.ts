import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  applicationStatusHistory,
  auditLogs,
  companies,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobVacancies,
  recruiterContacts,
  suitabilityEvaluations,
  user,
  userSettings,
} from "@/db/schema";
import { loadSampleDataForUser, removeSampleDataForUser } from "@/db/seed/demo";
import { writeAudit } from "@/lib/audit";
import {
  CURRENCIES,
  SEARCH_STATUSES,
  TIMEZONES,
  WORK_ARRANGEMENTS,
  type SearchStatus,
} from "@/lib/constants";
import { CUSTOM_STAGE_TYPES, STAGE_COLORS } from "@/lib/domain/stages";
import { EDUCATION_LEVELS, type Weights } from "@/lib/domain/suitability";

export const profileSettingsSchema = z.object({
  timezone: z.enum(TIMEZONES).default("Asia/Jakarta"),
  currency: z.enum(CURRENCIES).default("IDR"),
  searchStatus: z.enum(SEARCH_STATUSES).default("actively_searching"),
  headline: z.string().trim().max(160).optional().nullable(),
  skills: z.array(z.string().trim().min(1)).default([]),
  yearsExperience: z.number().int().min(0).max(50).optional().nullable(),
  educationLevel: z.enum(EDUCATION_LEVELS).optional().nullable(),
  expectedSalaryMin: z.number().int().nonnegative().optional().nullable(),
  expectedSalaryMax: z.number().int().nonnegative().optional().nullable(),
  preferredLocations: z.array(z.string().trim().min(1)).default([]),
  preferredArrangements: z.array(z.enum(WORK_ARRANGEMENTS)).default([]),
  includeSampleInAnalytics: z.boolean().optional().nullable(),
});

export async function updateProfileSettingsService(
  userId: string,
  rawInput: z.infer<typeof profileSettingsSchema>,
) {
  const input = profileSettingsSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(userSettings)
    .set({
      timezone: input.timezone,
      currency: input.currency,
      searchStatus: input.searchStatus,
      headline: input.headline || null,
      skills: input.skills,
      yearsExperience: input.yearsExperience ?? null,
      educationLevel: input.educationLevel ?? null,
      expectedSalaryMin: input.expectedSalaryMin ?? null,
      expectedSalaryMax: input.expectedSalaryMax ?? null,
      preferredLocations: input.preferredLocations,
      preferredArrangements: input.preferredArrangements,
      includeSampleInAnalytics:
        input.includeSampleInAnalytics === undefined
          ? null
          : input.includeSampleInAnalytics,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "user_settings",
    entityId: userId,
    action: "update",
    summary: "Updated career profile and preferences",
  });

  return updated;
}

export async function updateSearchStatusService(
  userId: string,
  searchStatus: SearchStatus,
) {
  const db = await ensureDbReady();
  const [updated] = await db
    .update(userSettings)
    .set({ searchStatus, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning();
  return updated;
}

export const followUpSettingsSchema = z.object({
  followUpFirstDays: z.number().int().min(1).max(60),
  followUpSecondDays: z.number().int().min(1).max(60),
  followUpFinalDays: z.number().int().min(0).max(90),
  noResponseDays: z.number().int().min(7).max(365),
  holidays: z.array(z.string().trim().min(10)).optional(),
});

export async function updateFollowUpSettingsService(
  userId: string,
  rawInput: z.infer<typeof followUpSettingsSchema>,
) {
  const input = followUpSettingsSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(userSettings)
    .set({
      followUpFirstDays: input.followUpFirstDays,
      followUpSecondDays: input.followUpSecondDays,
      followUpFinalDays: input.followUpFinalDays,
      noResponseDays: input.noResponseDays,
      holidays: input.holidays ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "user_settings",
    entityId: userId,
    action: "update",
    summary: "Updated follow-up and No Response thresholds",
  });

  return updated;
}

export const suitabilityWeightsSchema = z.object({
  skills: z.number().int().min(0).max(100),
  experience: z.number().int().min(0).max(100),
  education: z.number().int().min(0).max(100),
  salary: z.number().int().min(0).max(100),
  location: z.number().int().min(0).max(100),
  growth: z.number().int().min(0).max(100),
});

export async function updateSuitabilityWeightsService(
  userId: string,
  rawWeights: Weights,
) {
  const weights = suitabilityWeightsSchema.parse(rawWeights);
  const total =
    weights.skills +
    weights.experience +
    weights.education +
    weights.salary +
    weights.location +
    weights.growth;
  if (total <= 0) {
    throw new Error("At least one criterion must have a weight greater than zero.");
  }

  const db = await ensureDbReady();
  const [updated] = await db
    .update(userSettings)
    .set({ suitabilityWeights: weights, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning();
  return updated;
}

export const customStageSchema = z.object({
  stageId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Stage name is required").max(60),
  stageType: z.enum(CUSTOM_STAGE_TYPES as unknown as [string, ...string[]]).optional(),
  color: z.enum(STAGE_COLORS).default("indigo"),
});

export async function saveStageService(
  userId: string,
  rawInput: z.infer<typeof customStageSchema>,
) {
  const input = customStageSchema.parse(rawInput);
  const db = await ensureDbReady();

  if (input.stageId) {
    const [updated] = await db
      .update(applicationStages)
      .set({
        name: input.name,
        color: input.color,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(applicationStages.id, input.stageId),
          eq(applicationStages.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Stage not found.");
    return updated;
  }

  const existing = await db
    .select()
    .from(applicationStages)
    .where(eq(applicationStages.userId, userId))
    .orderBy(asc(applicationStages.sortOrder));

  // Place new custom stage right before "Offer"
  const offerIdx = existing.findIndex((s) => s.stageType === "offer");
  const sortOrder =
    offerIdx > 0
      ? Math.floor((existing[offerIdx - 1].sortOrder + existing[offerIdx].sortOrder) / 2)
      : 75;
  const slug = `custom_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;

  const [created] = await db
    .insert(applicationStages)
    .values({
      userId,
      key: slug,
      name: input.name,
      stageType: (input.stageType as "screening" | "interview" | "assessment") ?? "interview",
      sortOrder,
      color: input.color,
      isSystem: false,
      isHidden: false,
    })
    .returning();

  return created;
}

export async function reorderStagesService(userId: string, orderedStageIds: string[]) {
  const db = await ensureDbReady();
  for (let i = 0; i < orderedStageIds.length; i++) {
    await db
      .update(applicationStages)
      .set({ sortOrder: i * 10, updatedAt: new Date() })
      .where(
        and(
          eq(applicationStages.id, orderedStageIds[i]),
          eq(applicationStages.userId, userId),
        ),
      );
  }
}

export async function toggleStageHiddenService(
  userId: string,
  stageId: string,
  isHidden: boolean,
) {
  const db = await ensureDbReady();
  if (isHidden) {
    const [{ inUse }] = await db
      .select({ inUse: sql<number>`count(*)::int` })
      .from(applications)
      .where(
        and(eq(applications.userId, userId), eq(applications.currentStageId, stageId)),
      );
    if (inUse > 0) {
      throw new Error(
        `Cannot hide this stage while ${inUse} application(s) are currently in it.`,
      );
    }
  }
  const [updated] = await db
    .update(applicationStages)
    .set({ isHidden, updatedAt: new Date() })
    .where(and(eq(applicationStages.id, stageId), eq(applicationStages.userId, userId)))
    .returning();
  return updated;
}

export async function loadSampleDataService(userId: string) {
  const db = await ensureDbReady();
  await loadSampleDataForUser(db, userId);
  await writeAudit(db, {
    userId,
    entityType: "sample_data",
    entityId: userId,
    action: "sample_load",
    summary: "Loaded sample demonstration records",
  });
}

export async function removeSampleDataService(userId: string) {
  const db = await ensureDbReady();
  await removeSampleDataForUser(db, userId);
  await writeAudit(db, {
    userId,
    entityType: "sample_data",
    entityId: userId,
    action: "sample_remove",
    summary: "Removed sample demonstration records",
  });
}

export async function exportAccountJsonService(userId: string) {
  const db = await ensureDbReady();
  const [accountUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const stages = await db
    .select()
    .from(applicationStages)
    .where(eq(applicationStages.userId, userId))
    .orderBy(asc(applicationStages.sortOrder));

  const userCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.userId, userId));

  const contacts = await db
    .select()
    .from(recruiterContacts)
    .where(eq(recruiterContacts.userId, userId));

  const vacancies = await db
    .select()
    .from(jobVacancies)
    .where(eq(jobVacancies.userId, userId));

  const evaluations = await db
    .select()
    .from(suitabilityEvaluations)
    .where(eq(suitabilityEvaluations.userId, userId));

  const userApps = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId));

  const statusHistory = await db
    .select()
    .from(applicationStatusHistory)
    .where(eq(applicationStatusHistory.userId, userId));

  const comms = await db
    .select()
    .from(emailCommunications)
    .where(eq(emailCommunications.userId, userId));

  const userInterviews = await db
    .select()
    .from(interviews)
    .where(eq(interviews.userId, userId));

  const offers = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId));

  const tasks = await db
    .select()
    .from(followUpTasks)
    .where(eq(followUpTasks.userId, userId));

  const audits = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));

  await writeAudit(db, {
    userId,
    entityType: "user_account",
    entityId: userId,
    action: "export",
    summary: "Exported full account data as JSON",
  });

  return {
    exportedAt: new Date().toISOString(),
    user: accountUser,
    settings,
    stages,
    companies: userCompanies,
    recruiterContacts: contacts,
    jobVacancies: vacancies,
    suitabilityEvaluations: evaluations,
    applications: userApps,
    applicationStatusHistory: statusHistory,
    communications: comms,
    interviews: userInterviews,
    jobOffers: offers,
    followUpTasks: tasks,
    auditLogs: audits,
  };
}

export async function deleteUserAccountService(userId: string) {
  const db = await ensureDbReady();
  await db.delete(user).where(eq(user.id, userId));
}
