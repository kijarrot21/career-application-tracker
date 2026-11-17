import type { NextRequest } from "next/server";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { pullSyncChangesService, syncPullSchema } from "@/server/services/sync";

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "sync:pull");
  if (!auth.ok) return auth.response;

  try {
    const body = await parseV1JsonBody(request);
    const parsed = syncPullSchema.parse(body);
    const result = await pullSyncChangesService(auth.ctx.userId, parsed);
    return v1Success(result, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "sync:pull");
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const rawSince = sp.get("sinceCursor");
  const rawLimit = sp.get("limit");

  try {
    const parsed = syncPullSchema.parse({
      deviceId: sp.get("deviceId") ?? "",
      streamKey: sp.get("streamKey") ?? "default",
      sinceCursor: rawSince !== null ? Number(rawSince) : undefined,
      limit: rawLimit !== null ? Number(rawLimit) : 50,
      excludeSelfDevice: sp.get("excludeSelfDevice") === "true",
    });
    const result = await pullSyncChangesService(auth.ctx.userId, parsed);
    return v1Success(result, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
