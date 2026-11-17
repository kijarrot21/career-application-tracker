import { NextResponse, type NextRequest } from "next/server";
import {
  PAYMENT_PROVIDERS,
  PaymentError,
  PaymentSignatureError,
  type PaymentProviderId,
} from "@/lib/domain/payments";
import { processPaymentWebhookService } from "@/server/services/payments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!PAYMENT_PROVIDERS.includes(provider as PaymentProviderId)) {
    return NextResponse.json(
      { error: "Unsupported payment provider." },
      { status: 404 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read webhook body." },
      { status: 400 },
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
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof PaymentSignatureError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 401 },
      );
    }
    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
