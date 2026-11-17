import { createHmac } from "node:crypto";
import {
  PaymentError,
  PaymentSignatureError,
  type NormalizedPaymentEventStatus,
} from "@/lib/domain/payments";
import { env, isStripeSandboxConfigured } from "@/lib/env";
import {
  constantTimeHexEqual,
  type PaymentCheckoutRequest,
  type PaymentCheckoutResult,
  type PaymentFetchLike,
  type PaymentProviderAdapter,
  type PaymentReconciliationResult,
  type PaymentRefundRequest,
  type PaymentRefundResult,
  type VerifiedWebhookEvent,
} from "./payment-provider.types";

function parseStripeSignatureHeader(header: string): {
  timestamp: number | null;
  v1Signatures: string[];
} {
  let timestamp: number | null = null;
  const v1Signatures: string[] = [];

  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k.trim() === "t") {
      const parsed = Number(v.trim());
      if (Number.isInteger(parsed)) timestamp = parsed;
    } else if (k.trim() === "v1") {
      v1Signatures.push(v.trim());
    }
  }
  return { timestamp, v1Signatures };
}

function mapStripeStatus(
  eventType: string,
  paymentStatus?: string,
): NormalizedPaymentEventStatus {
  if (eventType === "checkout.session.completed" && paymentStatus === "paid") {
    return "paid";
  }
  if (eventType === "checkout.session.async_payment_succeeded") return "paid";
  if (eventType === "checkout.session.expired") return "expired";
  if (
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "payment_intent.payment_failed"
  ) {
    return "failed";
  }
  if (eventType === "charge.refunded") return "refunded";
  return "pending";
}

export class StripeSandboxProvider implements PaymentProviderAdapter {
  readonly id = "stripe" as const;
  readonly name = "Stripe Sandbox (International)";
  readonly supportedCurrencies = ["USD"] as const;

  private readonly fetchFn?: PaymentFetchLike;
  private readonly secretKeyOverride?: string;
  private readonly webhookSecretOverride?: string;

  constructor(options?: {
    fetchFn?: PaymentFetchLike;
    secretKeyOverride?: string;
    webhookSecretOverride?: string;
  }) {
    this.fetchFn = options?.fetchFn;
    this.secretKeyOverride = options?.secretKeyOverride;
    this.webhookSecretOverride = options?.webhookSecretOverride;
  }

  private getSecretKey(): string {
    return (this.secretKeyOverride ?? env.STRIPE_SECRET_KEY).trim();
  }

  private getWebhookSecret(): string {
    return (this.webhookSecretOverride ?? env.STRIPE_WEBHOOK_SECRET).trim();
  }

  private assertSafeSandboxKey(key: string) {
    if (!key) {
      throw new PaymentError(
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "Stripe sandbox secret key is not configured.",
        503,
      );
    }
    if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
      throw new PaymentError(
        "PRODUCTION_PAYMENTS_DISABLED",
        "Live Stripe keys are blocked until production payments receive explicit owner approval.",
        403,
      );
    }
  }

  isConfigured(): boolean {
    if (this.secretKeyOverride?.trim()) {
      return !this.secretKeyOverride.trim().startsWith("sk_live_");
    }
    return isStripeSandboxConfigured();
  }

  async createCheckout(
    req: PaymentCheckoutRequest,
  ): Promise<PaymentCheckoutResult> {
    const secretKey = this.getSecretKey();
    this.assertSafeSandboxKey(secretKey);

    if (req.currency !== "USD") {
      throw new PaymentError(
        "UNSUPPORTED_CURRENCY",
        "Stripe adapter expects USD cents.",
        400,
      );
    }

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.STRIPE_API_BASE_URL.replace(/\/+$/, "");

    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: req.orderCode,
      success_url: req.returnUrl,
      cancel_url: req.returnUrl,
      customer_email: req.userEmail,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(req.amount),
      "line_items[0][price_data][product_data][name]": `${req.packageName} (${req.creditsToGrant} AI Credits)`,
      "metadata[order_code]": req.orderCode,
      "metadata[package_key]": req.packageKey,
    });

    const res = await fetchFn(`${baseUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${secretKey}`,
        "Idempotency-Key": req.idempotencyKey,
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new PaymentError(
        "CHECKOUT_PROVIDER_ERROR",
        `Stripe checkout failed (HTTP ${res.status}): ${errText.slice(0, 150)}`,
        502,
      );
    }

    const body = (await res.json()) as {
      id?: string;
      url?: string;
      expires_at?: number;
    };
    if (!body.id || !body.url) {
      throw new PaymentError(
        "CHECKOUT_PROVIDER_ERROR",
        "Stripe response omitted session id or checkout url.",
        502,
      );
    }

    return {
      providerOrderId: body.id,
      checkoutUrl: body.url,
      expiresAt: body.expires_at ? new Date(body.expires_at * 1000) : null,
      providerMetadata: { sessionId: body.id },
    };
  }

  verifyAndParseWebhook(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    now?: Date;
  }): VerifiedWebhookEvent {
    const webhookSecret = this.getWebhookSecret();
    if (!webhookSecret) {
      throw new PaymentSignatureError(
        "STRIPE_WEBHOOK_SECRET is not configured on the server.",
      );
    }

    const sigHeader =
      params.headers["stripe-signature"] ??
      params.headers["Stripe-Signature"] ??
      "";
    const { timestamp, v1Signatures } = parseStripeSignatureHeader(sigHeader);

    if (!timestamp || v1Signatures.length === 0) {
      throw new PaymentSignatureError("Missing Stripe-Signature header parts.");
    }

    const nowSec = Math.floor((params.now ?? new Date()).getTime() / 1000);
    const ageSec = Math.abs(nowSec - timestamp);
    if (ageSec > env.PAYMENT_WEBHOOK_MAX_AGE_SECONDS) {
      throw new PaymentSignatureError(
        `Stripe webhook timestamp expired (${ageSec}s outside tolerance).`,
      );
    }

    const expectedHmac = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${params.rawBody}`, "utf8")
      .digest("hex");

    const sigMatched = v1Signatures.some((sig) =>
      constantTimeHexEqual(sig, expectedHmac),
    );
    if (!sigMatched) {
      throw new PaymentSignatureError("Invalid Stripe HMAC-SHA256 signature.");
    }

    let event: {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    try {
      event = JSON.parse(params.rawBody) as typeof event;
    } catch {
      throw new PaymentSignatureError("Malformed Stripe webhook JSON.");
    }

    const obj = event.data?.object ?? {};
    const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
    const orderCode = String(
      obj.client_reference_id ?? metadata.order_code ?? "",
    );
    const amountRaw = Number(obj.amount_total ?? obj.amount ?? 0);
    const currency = String(obj.currency ?? "").toUpperCase();
    const eventType = String(event.type ?? "unknown");
    const paymentStatus =
      typeof obj.payment_status === "string" ? obj.payment_status : undefined;

    return {
      externalEventId: String(event.id ?? ""),
      eventType,
      orderCode,
      providerTransactionId: String(obj.payment_intent ?? obj.id ?? ""),
      normalizedStatus: mapStripeStatus(eventType, paymentStatus),
      amount: Math.round(amountRaw),
      currency,
      eventTimestamp: new Date(timestamp * 1000),
      rawSummary: {
        eventId: event.id ?? null,
        type: eventType,
        payment_status: paymentStatus ?? null,
      },
    };
  }

  async fetchOrderStatus(params: {
    orderCode: string;
    providerOrderId?: string | null;
  }): Promise<PaymentReconciliationResult> {
    const secretKey = this.getSecretKey();
    this.assertSafeSandboxKey(secretKey);

    if (!params.providerOrderId) {
      throw new PaymentError(
        "RECONCILIATION_FAILED",
        "Missing Stripe checkout session ID for order reconciliation.",
        400,
      );
    }

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.STRIPE_API_BASE_URL.replace(/\/+$/, "");
    const res = await fetchFn(
      `${baseUrl}/checkout/sessions/${encodeURIComponent(params.providerOrderId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    if (!res.ok) {
      throw new PaymentError(
        "RECONCILIATION_FAILED",
        `Stripe session retrieval returned HTTP ${res.status}.`,
        502,
      );
    }

    const body = (await res.json()) as {
      id?: string;
      payment_intent?: string;
      payment_status?: string;
      status?: string;
      amount_total?: number;
      currency?: string;
      client_reference_id?: string;
    };

    const normalizedStatus: NormalizedPaymentEventStatus =
      body.payment_status === "paid"
        ? "paid"
        : body.status === "expired"
          ? "expired"
          : "pending";

    return {
      orderCode: body.client_reference_id ?? params.orderCode,
      providerTransactionId: body.payment_intent ?? body.id ?? null,
      normalizedStatus,
      amount: body.amount_total ?? null,
      currency: body.currency ? body.currency.toUpperCase() : "USD",
      rawSummary: {
        session_status: body.status ?? null,
        payment_status: body.payment_status ?? null,
      },
    };
  }

  async issueRefund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const secretKey = this.getSecretKey();
    this.assertSafeSandboxKey(secretKey);

    if (!req.providerTransactionId) {
      throw new PaymentError(
        "REFUND_FAILED",
        "Missing Stripe payment_intent ID for refund.",
        400,
      );
    }

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.STRIPE_API_BASE_URL.replace(/\/+$/, "");
    const form = new URLSearchParams({
      payment_intent: req.providerTransactionId,
      amount: String(req.amount),
      reason: "requested_by_customer",
    });

    const res = await fetchFn(`${baseUrl}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${secretKey}`,
        "Idempotency-Key": req.idempotencyKey,
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new PaymentError(
        "REFUND_FAILED",
        `Stripe refund failed (HTTP ${res.status}): ${errText.slice(0, 150)}`,
        502,
      );
    }

    const body = (await res.json()) as { id?: string; status?: string };
    return {
      providerRefundId: body.id ?? req.idempotencyKey,
      status: body.status === "succeeded" ? "succeeded" : "pending",
      rawSummary: { refundId: body.id ?? null, status: body.status ?? null },
    };
  }
}
