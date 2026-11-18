import { eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { ensureUserInitialized } from "@/db/seed/system";
import { userSettings } from "@/db/schema";
import {
  DEFAULT_ONBOARDING_STATE,
  onboardingStateSchema,
  type OnboardingState,
} from "@/lib/domain/onboarding";

/**
 * Read the user's own onboarding preferences. Malformed legacy values fall
 * back to the documented default instead of failing the request.
 */
export async function getOnboardingState(
  userId: string,
): Promise<OnboardingState> {
  const db = await ensureDbReady();

  const read = async () => {
    const [row] = await db
      .select({ state: userSettings.onboardingState })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row?.state;
  };

  let stored = await read();
  if (stored === undefined) {
    await ensureUserInitialized(db, userId);
    stored = await read();
  }
  if (stored === undefined) return { ...DEFAULT_ONBOARDING_STATE };

  const parsed = onboardingStateSchema.safeParse(stored);
  return parsed.success ? parsed.data : { ...DEFAULT_ONBOARDING_STATE };
}
