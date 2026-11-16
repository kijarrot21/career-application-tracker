import { JobsListClient } from "@/components/jobs/jobs-list-client";
import { requireUser } from "@/lib/session";
import { getJobSources, getUserSettings } from "@/server/queries/settings";
import { listVacancies } from "@/server/queries/vacancies";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser();
  const [vacancies, sources, settings] = await Promise.all([
    listVacancies(user.id),
    getJobSources(user.id),
    getUserSettings(user.id),
  ]);

  return (
    <JobsListClient
      vacancies={vacancies}
      sources={sources}
      defaultCurrency={settings.currency}
    />
  );
}
