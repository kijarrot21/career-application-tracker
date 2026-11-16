import Link from "next/link";
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
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/jobs"
            className="text-xs font-semibold text-[#006a42] hover:underline dark:text-[#69dca0]"
          >
            &larr; Back to Find Jobs
          </Link>
          <h1 className="text-headline-md mt-1.5 text-[#171d19] dark:text-[#ecf3eb]">
            Add Job Vacancy
          </h1>
          <p className="text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
            Save a job opportunity manually or from an external URL and
            automatically calculate initial suitability.
          </p>
        </div>
      </div>

      <VacancyForm
        sources={sources}
        defaultCurrency={settings.currency}
        initialData={{ discoveredOn: today }}
      />
    </div>
  );
}
