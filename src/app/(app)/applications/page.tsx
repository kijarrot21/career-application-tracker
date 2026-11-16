import { ApplicationsViewClient } from "@/components/applications/applications-view-client";
import type { VacancyOptionForSubmission } from "@/components/applications/record-submission-dialog";
import { requireUser } from "@/lib/session";
import { getKanbanBoardData } from "@/server/queries/applications";
import { getJobSources, getUserSettings } from "@/server/queries/settings";
import { listVacancies } from "@/server/queries/vacancies";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [boardData, vacancies, sources, settings] = await Promise.all([
    getKanbanBoardData(user.id),
    listVacancies(user.id),
    getJobSources(user.id),
    getUserSettings(user.id),
  ]);

  const vacancyOptions: VacancyOptionForSubmission[] = vacancies.map((v) => ({
    id: v.id,
    code: v.code,
    title: v.title,
    companyName: v.company.name,
    url: v.url,
    sourceId: v.sourceId,
    department: v.department,
    hasActiveApp: v.applications.some((a) => a.outcome === "active"),
    hasClosedApp: v.applications.some((a) => a.outcome !== "active"),
  }));

  return (
    <ApplicationsViewClient
      boardData={boardData}
      vacancyOptions={vacancyOptions}
      sources={sources}
      defaultCurrency={settings.currency}
      initialView={sp.view === "table" ? "table" : "board"}
      initialOpenNew={sp.new === "1"}
    />
  );
}
