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
            className="text-xs font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
          >
            &larr; Back to Find Jobs
          </Link>
          <h1 className="text-headline-md mt-1 text-[#0F172A] dark:text-slate-100">
            Add Job Vacancy
          </h1>
          <p className="text-[13px] text-[#64748B]">
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
