import type { NextRequest } from "next/server";
import type { z } from "zod";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";

export function getAiTaskHttpStatus(result: { status?: string }): number {
  return result.status === "awaiting_consent" ? 202 : 200;
}

export async function handleAiV1JsonEndpoint<
  TSchema extends z.ZodTypeAny,
  TResult extends { status?: string },
>(
  request: NextRequest,
  scope: string,
  schema: TSchema,
  executor: (userId: string, input: z.infer<TSchema>) => Promise<TResult>,
) {
  const auth = await requireV1AuthContext(request, scope);
  if (!auth.ok) return auth.response;

  try {
    const rawBody = await parseV1JsonBody(request);
    const mergedBody = {
      ...rawBody,
      idempotencyKey:
        typeof rawBody.idempotencyKey === "string" &&
        rawBody.idempotencyKey.trim()
          ? rawBody.idempotencyKey
          : auth.ctx.idempotencyKey,
    };

    const validated = schema.parse(mergedBody);
    const result = await executor(auth.ctx.userId, validated);

    return v1Success(result, {
      status: getAiTaskHttpStatus(result),
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
