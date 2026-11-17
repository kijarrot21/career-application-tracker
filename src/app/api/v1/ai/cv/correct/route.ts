import type { NextRequest } from "next/server";
import {
  cvCorrectionInputSchema,
  suggestCvCorrectionsWithAiService,
} from "@/server/ai/services";
import { handleAiV1JsonEndpoint } from "@/server/api/ai-v1";

export async function POST(request: NextRequest) {
  return handleAiV1JsonEndpoint(
    request,
    "ai:cv:correct",
    cvCorrectionInputSchema,
    (userId, input) => suggestCvCorrectionsWithAiService(userId, input),
  );
}
