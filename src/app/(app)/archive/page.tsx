import { ArchiveListClient } from "@/components/archive/archive-list-client";
import { isTerminal, isVacancyLevel } from "@/lib/domain/stages";
import { requireUser } from "@/lib/session";
import {
  listArchivableApplications,
  listArchivedApplications,
} from "@/server/queries/archive";
import { getUserSettings, getUserStages } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await requireUser();
  const [data, archivableApps, stages, settings] = await Promise.all([
    listArchivedApplications(user.id, { status: "all" }),
    listArchivableApplications(user.id),
    getUserStages(user.id, false),
    getUserSettings(user.id),
  ]);

  const activeStages = stages
    .filter((s) => !isTerminal(s.stageType) && !isVacancyLevel(s.stageType))
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <ArchiveListClient
      data={data}
      archivableApps={archivableApps}
      activeStages={activeStages}
      defaultCurrency={settings.currency}
    />
  );
}
