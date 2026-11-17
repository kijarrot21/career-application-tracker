import type { NextRequest } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, ApiError, assertValidUuid } from "@/lib/api/v1";
import {
  approveAndRunAiJobService,
  cancelAiJobService,
} from "@/server/ai/router/ai-task-router";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { getAiJobDetailForUser } from "@/server/queries/ai";

const aiJobActionSchema = z.object({
  action: z.enum(["approve", "cancel"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1AuthContext(request, "ai:jobs:detail");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const jobId = assertValidUuid(id, "AI job ID");
    const detail = await getAiJobDetailForUser(auth.ctx.userId, jobId);

    if (!detail) {
      throw new ApiError(
        API_ERROR_CODES.NOT_FOUND,
        "AI analysis job not found.",
        404,
      );
    }

    return v1Success(detail, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1AuthContext(request, "ai:jobs:action");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const jobId = assertValidUuid(id, "AI job ID");
    const body = await parseV1JsonBody(request);
    const parsed = aiJobActionSchema.parse(body);

    const result =
      parsed.action === "approve"
        ? await approveAndRunAiJobService(auth.ctx.userId, jobId)
        : await cancelAiJobService(auth.ctx.userId, jobId);

    return v1Success(result, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
