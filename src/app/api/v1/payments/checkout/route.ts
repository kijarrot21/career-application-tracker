import type { NextRequest } from "next/server";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import {
  createCheckoutInputSchema,
  createCreditCheckoutOrderService,
} from "@/server/services/payments";

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "payments:checkout");
  if (!auth.ok) return auth.response;

  try {
    const body = await parseV1JsonBody(request);
    const parsed = createCheckoutInputSchema.parse({
      ...body,
      idempotencyKey:
        typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
          ? body.idempotencyKey
          : auth.ctx.idempotencyKey,
    });

    const result = await createCreditCheckoutOrderService(
      auth.ctx.userId,
      parsed,
    );

    return v1Success(result, {
      status: result.deduplicated ? 200 : 201,
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
