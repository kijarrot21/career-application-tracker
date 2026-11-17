import { CvStudioClient } from "@/components/cv-studio/cv-studio-client";
import { requireUser } from "@/lib/session";
import { listAiAnalysesForUser } from "@/server/queries/ai";
import { getUserSettings } from "@/server/queries/settings";
import { listVacancies } from "@/server/queries/vacancies";
import { listCvVersionsForProfileImport } from "@/server/services/career-profile";

export const dynamic = "force-dynamic";

export default async function CvStudioPage() {
  const user = await requireUser();
  const [settings, cvVersions, vacancyRows, analyses] = await Promise.all([
    getUserSettings(user.id),
    listCvVersionsForProfileImport(user.id),
    listVacancies(user.id),
    listAiAnalysesForUser(user.id, { limit: 25 }),
  ]);

  const vacancies = vacancyRows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    companyName: row.company.name,
  }));

  return (
    <CvStudioClient
      aiPrivacyMode={settings.aiPrivacyMode}
      cvVersions={cvVersions}
      vacancies={vacancies}
      recentAnalyses={analyses}
    />
  );
}
