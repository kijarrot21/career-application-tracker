import type { NextRequest } from "next/server";
import { assertValidUuid } from "@/lib/api/v1";
import {
  analyzeArchivedApplicationInputSchema,
  analyzeArchivedApplicationWithAiService,
} from "@/server/ai/services";
import { getAiTaskHttpStatus } from "@/server/api/ai-v1";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";

const archiveAnalyzeBodySchema = analyzeArchivedApplicationInputSchema.omit({
  closureRecordId: true,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1AuthContext(request, "archive:analyze");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const closureRecordId = assertValidUuid(id, "archive record ID");
    const rawBody = await parseV1JsonBody(request);
    const parsedBody = archiveAnalyzeBodySchema.parse(rawBody);

    const result = await analyzeArchivedApplicationWithAiService(
      auth.ctx.userId,
      {
        ...parsedBody,
        closureRecordId,
        idempotencyKey: parsedBody.idempotencyKey ?? auth.ctx.idempotencyKey,
      },
    );

    return v1Success(result, {
      status: getAiTaskHttpStatus(result),
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
