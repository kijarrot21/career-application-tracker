import { SettingsClient } from "@/components/settings/settings-client";
import { requireUser } from "@/lib/session";
import { getSanitizedProviderStatuses } from "@/server/ai/providers";
import { getOnboardingPreferencesService } from "@/server/services/onboarding";
import { detectProgress } from "@/server/services/progress";
import {
  getSampleDataStatus,
  getUserSettings,
  getUserStages,
} from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, stages, sampleStatus, onboarding, progress] =
    await Promise.all([
      getUserSettings(user.id),
      getUserStages(user.id, true),
      getSampleDataStatus(user.id),
      getOnboardingPreferencesService(user.id),
      detectProgress(user.id),
    ]);
  const aiProviders = getSanitizedProviderStatuses();

  return (
    <SettingsClient
      settings={settings}
      stages={stages}
      sampleStatus={sampleStatus}
      aiProviders={aiProviders}
      onboarding={onboarding}
      progress={progress}
    />
  );
}
