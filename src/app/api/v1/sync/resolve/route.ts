import type { NextRequest } from "next/server";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import {
  resolveConflictSchema,
  resolveSyncConflictService,
} from "@/server/services/sync";

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "sync:resolve");
  if (!auth.ok) return auth.response;

  try {
    const body = await parseV1JsonBody(request);
    const parsed = resolveConflictSchema.parse(body);
    const result = await resolveSyncConflictService(auth.ctx.userId, parsed);
    return v1Success(result, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
