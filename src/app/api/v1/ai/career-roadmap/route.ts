import type { NextRequest } from "next/server";
import {
  careerRoadmapInputSchema,
  generateCareerRoadmapWithAiService,
} from "@/server/ai/services";
import { handleAiV1JsonEndpoint } from "@/server/api/ai-v1";

export async function POST(request: NextRequest) {
  return handleAiV1JsonEndpoint(
    request,
    "ai:career-roadmap",
    careerRoadmapInputSchema,
    (userId, input) => generateCareerRoadmapWithAiService(userId, input),
  );
}
