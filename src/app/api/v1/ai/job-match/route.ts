import type { NextRequest } from "next/server";
import {
  jobMatchInputSchema,
  matchJobWithAiService,
} from "@/server/ai/services";
import { handleAiV1JsonEndpoint } from "@/server/api/ai-v1";

const validatedJobMatchSchema = jobMatchInputSchema.refine(
  (d) => Boolean(d.vacancyId || d.jobDescriptionText),
  {
    message: "Either 'vacancyId' or 'jobDescriptionText' must be provided.",
  },
);

export async function POST(request: NextRequest) {
  return handleAiV1JsonEndpoint(
    request,
    "ai:job-match",
    validatedJobMatchSchema,
    (userId, input) => matchJobWithAiService(userId, input),
  );
}
