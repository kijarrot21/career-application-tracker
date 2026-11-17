import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  aiAnalysisJobs,
  aiAnalysisSources,
  aiCareerAnalyses,
  aiFeedback,
  applicationArchiveDocuments,
  applicationArchiveSnapshots,
  applicationClosureRecords,
  applications,
  applicationStages,
  applicationStatusHistory,
  auditLogs,
  careerCertifications,
  careerEducations,
  careerExperiences,
  careerProfiles,
  careerProjects,
  careerSkills,
  companies,
  creditLedger,
  creditReservations,
  creditWallets,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobVacancies,
  paymentOrders,
  paymentTransactions,
  recruiterContacts,
  suitabilityEvaluations,
  syncCheckpoints,
  syncConflicts,
  syncDevices,
  syncEvents,
  syncOutbox,
  user,
  userSettings,
} from "@/db/schema";
import { loadSampleDataForUser, removeSampleDataForUser } from "@/db/seed/demo";
import { writeAudit } from "@/lib/audit";
import { deleteUserStorageDir } from "@/lib/storage";
import {
  AI_PREFERRED_PROVIDERS,
  AI_PRIVACY_MODES,
} from "@/lib/domain/ai";
import { validateLocalAiEndpoint } from "@/server/ai/security/endpoint-validator";
import {
  DEFAULT_LOCALE,
  isValidIsoCurrencyCode,
  normalizeLocale,
  SUPPORTED_LOCALES,
} from "@/lib/i18n";
import {
  SEARCH_STATUSES,
  TIMEZONES,
  WORK_ARRANGEMENTS,
  type SearchStatus,
} from "@/lib/constants";
import { CUSTOM_STAGE_TYPES, STAGE_COLORS } from "@/lib/domain/stages";
import { EDUCATION_LEVELS, type Weights } from "@/lib/domain/suitability";

export const workspaceSettingsSchema = z.object({
  preferredLocale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
  timezone: z.enum(TIMEZONES).default("Asia/Jakarta"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidIsoCurrencyCode, "Unsupported ISO 4217 currency code")
    .default("IDR"),
  searchStatus: z.enum(SEARCH_STATUSES).default("actively_searching"),
  includeSampleInAnalytics: z.boolean().optional().nullable(),
});

export async function updateWorkspaceSettingsService(
  userId: string,
  rawInput: z.input<typeof workspaceSettingsSchema>,
) {
  const input = workspaceSettingsSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(userSettings)
    .set({
      preferredLocale: input.preferredLocale,
      timezone: input.timezone,
      currency: input.currency,
      searchStatus: input.searchStatus,
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
    summary: `Updated workspace locale (${input.preferredLocale}, ${input.timezone}, ${input.currency}) and job search status`,
  });

  return updated;
}

export async function updatePreferredLocaleService(
  userId: string,
  rawLocale: string,
) {
  const preferredLocale = normalizeLocale(rawLocale);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(userSettings)
    .set({
      preferredLocale,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "user_settings",
    entityId: userId,
    action: "update",
    summary: `Switched preferred language to ${preferredLocale}`,
  });

  return updated;
}

export const aiPrivacySettingsSchema = z.object({
  aiPrivacyMode: z.enum(AI_PRIVACY_MODES).default("ask_before_each"),
  aiPreferredProvider: z.enum(AI_PREFERRED_PROVIDERS).default("auto"),
  aiOllamaEndpoint: z.string().trim().max(300).optional().nullable(),
  aiOllamaModel: z.string().trim().max(120).optional().nullable(),
  aiCloudDocumentConsent: z.boolean().default(false),
});

export async function updateAiPrivacySettingsService(
  userId: string,
  rawInput: z.input<typeof aiPrivacySettingsSchema>,
) {
  const input = aiPrivacySettingsSchema.parse(rawInput);

  let normalizedEndpoint: string | null = null;
  if (input.aiOllamaEndpoint && input.aiOllamaEndpoint.trim()) {
    const check = validateLocalAiEndpoint(input.aiOllamaEndpoint);
    if (!check.valid || !check.normalizedUrl) {
      throw new Error(
        check.reason ?? "Invalid local AI endpoint URL configuration.",
      );
    }
    normalizedEndpoint = check.normalizedUrl;
  }

  const db = await ensureDbReady();
  const [updated] = await db
    .update(userSettings)
    .set({
      aiPrivacyMode: input.aiPrivacyMode,
      aiPreferredProvider: input.aiPreferredProvider,
      aiOllamaEndpoint: normalizedEndpoint,
      aiOllamaModel: input.aiOllamaModel?.trim() || null,
      aiCloudDocumentConsent:
        input.aiPrivacyMode === "local_only"
          ? false
          : input.aiCloudDocumentConsent,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "user_settings",
    entityId: userId,
    action: "update",
    summary: `Updated AI privacy settings (${input.aiPrivacyMode}, provider: ${input.aiPreferredProvider})`,
  });

  return updated;
}

export const profileSettingsSchema = z.object({
  timezone: z.enum(TIMEZONES).default("Asia/Jakarta"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidIsoCurrencyCode, "Unsupported ISO 4217 currency code")
    .default("IDR"),
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

  await writeAudit(db, {
    userId,
    entityType: "user_account",
    entityId: userId,
    action: "export",
    summary: "Exported full account data as JSON",
  });

  const audits = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));

  const closureRecords = await db
    .select()
    .from(applicationClosureRecords)
    .where(eq(applicationClosureRecords.userId, userId));

  const archiveSnapshots = await db
    .select()
    .from(applicationArchiveSnapshots)
    .where(eq(applicationArchiveSnapshots.userId, userId));

  const archiveDocuments = await db
    .select()
    .from(applicationArchiveDocuments)
    .where(eq(applicationArchiveDocuments.userId, userId));

  const [careerProfile] = await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId));

  const profileExperiences = await db
    .select()
    .from(careerExperiences)
    .where(eq(careerExperiences.userId, userId));

  const profileEducations = await db
    .select()
    .from(careerEducations)
    .where(eq(careerEducations.userId, userId));

  const profileSkills = await db
    .select()
    .from(careerSkills)
    .where(eq(careerSkills.userId, userId));

  const profileCertifications = await db
    .select()
    .from(careerCertifications)
    .where(eq(careerCertifications.userId, userId));

  const profileProjects = await db
    .select()
    .from(careerProjects)
    .where(eq(careerProjects.userId, userId));

  const aiJobs = await db
    .select({
      id: aiAnalysisJobs.id,
      taskType: aiAnalysisJobs.taskType,
      provider: aiAnalysisJobs.provider,
      locality: aiAnalysisJobs.locality,
      model: aiAnalysisJobs.model,
      promptVersionTag: aiAnalysisJobs.promptVersionTag,
      locale: aiAnalysisJobs.locale,
      privacyModeAtRun: aiAnalysisJobs.privacyModeAtRun,
      consentRequired: aiAnalysisJobs.consentRequired,
      consentGranted: aiAnalysisJobs.consentGranted,
      consentGrantedAt: aiAnalysisJobs.consentGrantedAt,
      inputHash: aiAnalysisJobs.inputHash,
      status: aiAnalysisJobs.status,
      attempts: aiAnalysisJobs.attempts,
      errorCode: aiAnalysisJobs.errorCode,
      errorMessage: aiAnalysisJobs.errorMessage,
      usageMetadata: aiAnalysisJobs.usageMetadata,
      startedAt: aiAnalysisJobs.startedAt,
      completedAt: aiAnalysisJobs.completedAt,
      createdAt: aiAnalysisJobs.createdAt,
    })
    .from(aiAnalysisJobs)
    .where(eq(aiAnalysisJobs.userId, userId));

  const aiAnalyses = await db
    .select()
    .from(aiCareerAnalyses)
    .where(eq(aiCareerAnalyses.userId, userId));

  const aiSources = await db
    .select()
    .from(aiAnalysisSources)
    .where(eq(aiAnalysisSources.userId, userId));

  const aiUserFeedback = await db
    .select()
    .from(aiFeedback)
    .where(eq(aiFeedback.userId, userId));

  const [wallet] = await db
    .select()
    .from(creditWallets)
    .where(eq(creditWallets.userId, userId));

  const reservations = await db
    .select()
    .from(creditReservations)
    .where(eq(creditReservations.userId, userId));

  const ledgerEntries = await db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));

  const userPaymentOrders = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.userId, userId));

  const userPaymentTransactions = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.userId, userId));

  const userSyncDevices = await db
    .select()
    .from(syncDevices)
    .where(eq(syncDevices.userId, userId));

  const userSyncCheckpoints = await db
    .select()
    .from(syncCheckpoints)
    .where(eq(syncCheckpoints.userId, userId));

  const userSyncOutbox = await db
    .select()
    .from(syncOutbox)
    .where(eq(syncOutbox.userId, userId));

  const userSyncConflicts = await db
    .select()
    .from(syncConflicts)
    .where(eq(syncConflicts.userId, userId));

  const userSyncEvents = await db
    .select()
    .from(syncEvents)
    .where(eq(syncEvents.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    user: accountUser,
    settings,
    stages,
    careerProfile: careerProfile ?? null,
    careerExperiences: profileExperiences,
    careerEducations: profileEducations,
    careerSkills: profileSkills,
    careerCertifications: profileCertifications,
    careerProjects: profileProjects,
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
    applicationClosureRecords: closureRecords,
    applicationArchiveSnapshots: archiveSnapshots,
    applicationArchiveDocuments: archiveDocuments,
    aiAnalysisJobs: aiJobs,
    aiCareerAnalyses: aiAnalyses,
    aiAnalysisSources: aiSources,
    aiFeedback: aiUserFeedback,
    creditWallet: wallet ?? null,
    creditReservations: reservations,
    creditLedger: ledgerEntries,
    paymentOrders: userPaymentOrders,
    paymentTransactions: userPaymentTransactions,
    syncDevices: userSyncDevices,
    syncCheckpoints: userSyncCheckpoints,
    syncOutbox: userSyncOutbox,
    syncConflicts: userSyncConflicts,
    syncEvents: userSyncEvents,
    auditLogs: audits,
  };
}

export async function deleteUserAccountService(userId: string) {
  const db = await ensureDbReady();
  deleteUserStorageDir(userId);
  await db.delete(user).where(eq(user.id, userId));
}
