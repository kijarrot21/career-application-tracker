import { ShortlistClient } from "@/components/jobs/shortlist-client";
import { requireUser } from "@/lib/session";
import { getJobSources, getUserSettings } from "@/server/queries/settings";
import { listShortlistVacancies } from "@/server/queries/vacancies";

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const user = await requireUser();
  const [vacancies, sources, settings] = await Promise.all([
    listShortlistVacancies(user.id),
    getJobSources(user.id),
    getUserSettings(user.id),
  ]);

  return (
    <ShortlistClient
      vacancies={vacancies}
      sources={sources}
      defaultCurrency={settings.currency}
    />
  );
}
