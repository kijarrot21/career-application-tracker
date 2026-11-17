import type { NextRequest } from "next/server";
import {
  generateTailoredCvInputSchema,
  generateTailoredCvWithAiService,
} from "@/server/ai/services";
import { handleAiV1JsonEndpoint } from "@/server/api/ai-v1";

const validatedGenerateSchema = generateTailoredCvInputSchema.refine(
  (d) => Boolean(d.vacancyId || d.targetRole),
  {
    message: "Either 'vacancyId' or 'targetRole' must be provided.",
  },
);

export async function POST(request: NextRequest) {
  return handleAiV1JsonEndpoint(
    request,
    "ai:cv:generate",
    validatedGenerateSchema,
    (userId, input) => generateTailoredCvWithAiService(userId, input),
  );
}
