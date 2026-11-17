import type { NextRequest } from "next/server";
import { API_ERROR_CODES, ApiError } from "@/lib/api/v1";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "@/lib/domain/payments";
import {
  requireV1WebhookContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { processPaymentWebhookService } from "@/server/services/payments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const wh = requireV1WebhookContext(request, provider);
  if (!wh.ok) return wh.response;

  if (!PAYMENT_PROVIDERS.includes(provider as PaymentProviderId)) {
    return v1Error(
      new ApiError(
        API_ERROR_CODES.NOT_FOUND,
        "Unsupported payment provider.",
        404,
      ),
      { requestId: wh.ctx.requestId },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return v1Error(
      new ApiError(
        API_ERROR_CODES.INVALID_JSON,
        "Failed to read webhook body.",
        400,
      ),
      { requestId: wh.ctx.requestId },
    );
  }

  const headersObj: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value;
  });

  try {
    const result = await processPaymentWebhookService({
      provider: provider as PaymentProviderId,
      rawBody,
      headers: headersObj,
    });

    if (result.processingStatus === "rejected_validation") {
      return v1Error(
        new ApiError(
          API_ERROR_CODES.UNPROCESSABLE_ENTITY,
          result.reason ?? "Webhook payload failed validation.",
          422,
        ),
        { requestId: wh.ctx.requestId },
      );
    }

    return v1Success(result, {
      status: 200,
      requestId: wh.ctx.requestId,
      rateLimit: wh.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: wh.ctx.requestId });
  }
}
