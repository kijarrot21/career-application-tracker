import { CareerProfileClient } from "@/components/profile/career-profile-client";
import { requireUser } from "@/lib/session";
import { listAiAnalysesForUser } from "@/server/queries/ai";
import { getMasterCareerProfile } from "@/server/queries/career-profile";
import type { AiCareerRoadmap } from "@/server/ai/schemas";

export const dynamic = "force-dynamic";

export default async function CareerProfilePage() {
  const user = await requireUser();
  const [data, roadmapAnalyses] = await Promise.all([
    getMasterCareerProfile(user.id),
    listAiAnalysesForUser(user.id, { taskType: "career_roadmap", limit: 1 }),
  ]);

  const latestRoadmap = roadmapAnalyses[0]?.resultPayload
    ? (roadmapAnalyses[0].resultPayload as AiCareerRoadmap)
    : null;

  return <CareerProfileClient data={data} latestRoadmap={latestRoadmap} />;
}
