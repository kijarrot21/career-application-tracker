import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { VacancyForm } from "@/components/jobs/vacancy-form";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { requireUser } from "@/lib/session";
import { getJobSources, getUserSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function NewJobVacancyPage() {
  const user = await requireUser();
  const [sources, settings] = await Promise.all([
    getJobSources(user.id),
    getUserSettings(user.id),
  ]);
  const today = todayInTimeZone(settings.timezone);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/jobs"
          className="text-xs font-semibold text-primary-text hover:underline"
        >
          &larr; Back to Find Jobs
        </Link>
      </div>

      <PageHeader
        title="Add Job Vacancy"
        description="Save a job opportunity manually or from an external URL and automatically calculate initial suitability."
      />

      <VacancyForm
        sources={sources}
        defaultCurrency={settings.currency}
        initialData={{ discoveredOn: today }}
      />
    </div>
  );
}
