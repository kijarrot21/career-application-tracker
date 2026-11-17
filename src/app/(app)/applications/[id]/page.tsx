import { notFound } from "next/navigation";
import { ApplicationDetailClient } from "@/components/applications/application-detail-client";
import { requireUser } from "@/lib/session";
import { getApplicationDetail } from "@/server/queries/applications";
import { getActiveArchiveForApplication } from "@/server/queries/archive";
import { getApplicationCareerExtras } from "@/server/queries/career";
import { getJobSources } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [app, sources, careerExtras, activeArchive] = await Promise.all([
    getApplicationDetail(user.id, id),
    getJobSources(user.id),
    getApplicationCareerExtras(user.id, id),
    getActiveArchiveForApplication(user.id, id),
  ]);

  if (!app) {
    notFound();
  }

  return (
    <ApplicationDetailClient
      app={app}
      sources={sources}
      careerExtras={careerExtras}
      activeArchive={activeArchive}
    />
  );
}
