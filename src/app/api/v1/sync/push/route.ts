import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import {
  processSyncPushBatchService,
  pushDeviceOutboxService,
  syncPushBatchSchema,
} from "@/server/services/sync";

const drainOutboxRequestSchema = z.object({
  mode: z.literal("outbox"),
  deviceId: z.string().uuid(),
  streamKey: z.string().trim().min(1).max(80).default("default"),
  ignoreBackoff: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "sync:push");
  if (!auth.ok) return auth.response;

  try {
    const body = await parseV1JsonBody(request);
    if (body.mode === "outbox") {
      const parsed = drainOutboxRequestSchema.parse(body);
      const result = await pushDeviceOutboxService(auth.ctx.userId, {
        deviceId: parsed.deviceId,
        streamKey: parsed.streamKey,
        ignoreBackoff: parsed.ignoreBackoff,
        limit: parsed.limit,
      });
      return v1Success(result, {
        requestId: auth.ctx.requestId,
        rateLimit: auth.ctx.rateLimit,
      });
    }

    const parsed = syncPushBatchSchema.parse(body);
    const result = await processSyncPushBatchService(auth.ctx.userId, parsed);
    return v1Success(result, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
