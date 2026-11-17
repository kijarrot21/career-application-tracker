import type { NextRequest } from "next/server";
import {
  evaluateCvInputSchema,
  evaluateCvWithAiService,
} from "@/server/ai/services";
import { handleAiV1JsonEndpoint } from "@/server/api/ai-v1";

export async function POST(request: NextRequest) {
  return handleAiV1JsonEndpoint(
    request,
    "ai:cv:evaluate",
    evaluateCvInputSchema,
    (userId, input) => evaluateCvWithAiService(userId, input),
  );
}
