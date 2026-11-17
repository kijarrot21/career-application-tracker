import { SettingsClient } from "@/components/settings/settings-client";
import { requireUser } from "@/lib/session";
import { getSanitizedProviderStatuses } from "@/server/ai/providers";
import {
  getSampleDataStatus,
  getUserSettings,
  getUserStages,
} from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, stages, sampleStatus] = await Promise.all([
    getUserSettings(user.id),
    getUserStages(user.id, true),
    getSampleDataStatus(user.id),
  ]);
  const aiProviders = getSanitizedProviderStatuses();

  return (
    <SettingsClient
      settings={settings}
      stages={stages}
      sampleStatus={sampleStatus}
      aiProviders={aiProviders}
    />
  );
}
