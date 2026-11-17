import { eq, isNull } from "drizzle-orm";
import type { AppDb } from "@/db";
import { applicationStages, jobSources, userSettings } from "@/db/schema";
import { SYSTEM_SOURCES } from "@/lib/domain/duplicates";
import { DEFAULT_STAGES } from "@/lib/domain/stages";
import { DEFAULT_WEIGHTS } from "@/lib/domain/suitability";

/** Seed platform job sources that are shared across all users (`user_id IS NULL`). */
export async function seedSystemSources(db: AppDb): Promise<void> {
  const existing = await db
    .select({ key: jobSources.key })
    .from(jobSources)
    .where(isNull(jobSources.userId));
  const have = new Set(existing.map((r) => r.key));

  for (const s of SYSTEM_SOURCES) {
    if (have.has(s.key)) continue;
    await db
      .insert(jobSources)
      .values({
        userId: null,
        key: s.key,
        name: s.name,
        domains: [...s.domains],
        isSystem: true,
      })
      .onConflictDoNothing();
  }
}

/**
 * Initialize a user's settings row and 13 standard HR recruitment stages.
 * Idempotent: safe to call on user sign-up and on first dashboard load.
 */
export async function ensureUserInitialized(db: AppDb, userId: string): Promise<void> {
  await db
    .insert(userSettings)
    .values({
      userId,
      preferredLocale: "id-ID",
      timezone: "Asia/Jakarta",
      currency: "IDR",
      searchStatus: "actively_searching",
      suitabilityWeights: DEFAULT_WEIGHTS,
      followUpFirstDays: 5,
      followUpSecondDays: 5,
      followUpFinalDays: 10,
      noResponseDays: 30,
    })
    .onConflictDoNothing();

  const existingStages = await db
    .select({ key: applicationStages.key })
    .from(applicationStages)
    .where(eq(applicationStages.userId, userId));

  if (existingStages.length === 0) {
    await db
      .insert(applicationStages)
      .values(
        DEFAULT_STAGES.map((s, idx) => ({
          userId,
          key: s.key,
          name: s.name,
          stageType: s.stageType,
          sortOrder: idx * 10,
          color: s.color,
          isSystem: true,
          isHidden: false,
        })),
      )
      .onConflictDoNothing();
  }
}
