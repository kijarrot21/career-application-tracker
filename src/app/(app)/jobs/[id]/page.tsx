import { notFound } from "next/navigation";
import { JobDetailClient } from "@/components/jobs/job-detail-client";
import { requireUser } from "@/lib/session";
import { getJobSources } from "@/server/queries/settings";
import { getVacancyDetail } from "@/server/queries/vacancies";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [vacancy, sources] = await Promise.all([
    getVacancyDetail(user.id, id),
    getJobSources(user.id),
  ]);

  if (!vacancy) {
    notFound();
  }

  return <JobDetailClient vacancy={vacancy} sources={sources} />;
}
