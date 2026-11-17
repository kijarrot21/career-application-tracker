import { createHash } from "node:crypto";
import {
  PaymentError,
  PaymentSignatureError,
  type NormalizedPaymentEventStatus,
} from "@/lib/domain/payments";
import { env, isMidtransSandboxConfigured } from "@/lib/env";
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

function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): NormalizedPaymentEventStatus {
  const tx = transactionStatus.toLowerCase();
  const fraud = (fraudStatus ?? "accept").toLowerCase();

  if (tx === "settlement" || (tx === "capture" && fraud === "accept")) {
    return "paid";
  }
  if (tx === "pending") return "pending";
  if (tx === "expire") return "expired";
  if (tx === "refund" || tx === "partial_refund") return "refunded";
  if (tx === "deny" || tx === "cancel" || tx === "failure") return "failed";
  return "pending";
}

function parseMidtransTimestamp(raw?: string): Date | null {
  if (!raw) return null;
  // Midtrans emits either ISO or "YYYY-MM-DD HH:mm:ss" (WIB +07:00)
  const normalized = raw.includes("T")
    ? raw
    : `${raw.replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class MidtransSandboxProvider implements PaymentProviderAdapter {
  readonly id = "midtrans" as const;
  readonly name = "Midtrans Sandbox (Indonesia)";
  readonly supportedCurrencies = ["IDR"] as const;

  private readonly fetchFn?: PaymentFetchLike;
  private readonly serverKeyOverride?: string;
  private readonly allowSandboxWithoutEnvMode?: boolean;

  constructor(options?: {
    fetchFn?: PaymentFetchLike;
    serverKeyOverride?: string;
    allowSandboxWithoutEnvMode?: boolean;
  }) {
    this.fetchFn = options?.fetchFn;
    this.serverKeyOverride = options?.serverKeyOverride;
    this.allowSandboxWithoutEnvMode = options?.allowSandboxWithoutEnvMode;
  }

  private getServerKey(): string {
    return (this.serverKeyOverride ?? env.MIDTRANS_SERVER_KEY).trim();
  }

  private assertSafeSandboxKey(key: string) {
    if (!key) {
      throw new PaymentError(
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "Midtrans sandbox server key is not configured.",
        503,
      );
    }
    if (key.startsWith("Mid-server-")) {
      throw new PaymentError(
        "PRODUCTION_PAYMENTS_DISABLED",
        "Live Midtrans keys are blocked until production payments receive explicit owner approval.",
        403,
      );
    }
  }

  isConfigured(): boolean {
    if (this.serverKeyOverride?.trim()) {
      return !this.serverKeyOverride.trim().startsWith("Mid-server-");
    }
    return this.allowSandboxWithoutEnvMode
      ? Boolean(env.MIDTRANS_SERVER_KEY.trim())
      : isMidtransSandboxConfigured();
  }

  async createCheckout(
    req: PaymentCheckoutRequest,
  ): Promise<PaymentCheckoutResult> {
    const serverKey = this.getServerKey();
    this.assertSafeSandboxKey(serverKey);

    if (req.currency !== "IDR") {
      throw new PaymentError(
        "UNSUPPORTED_CURRENCY",
        "Midtrans adapter accepts IDR only.",
        400,
      );
    }

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.MIDTRANS_SNAP_BASE_URL.replace(/\/+$/, "");
    const auth = Buffer.from(`${serverKey}:`, "utf8").toString("base64");

    const res = await fetchFn(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: req.orderCode,
          gross_amount: req.amount,
        },
        item_details: [
          {
            id: req.packageKey,
            price: req.amount,
            quantity: 1,
            name: `${req.packageName} (${req.creditsToGrant} AI Credits)`.slice(
              0,
              50,
            ),
          },
        ],
        customer_details: {
          first_name: req.userName.slice(0, 50),
          email: req.userEmail,
        },
        callbacks: {
          finish: req.returnUrl,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new PaymentError(
        "CHECKOUT_PROVIDER_ERROR",
        `Midtrans sandbox checkout failed (HTTP ${res.status}): ${errText.slice(0, 150)}`,
        502,
      );
    }

    const body = (await res.json()) as {
      token?: string;
      redirect_url?: string;
    };
    if (!body.redirect_url) {
      throw new PaymentError(
        "CHECKOUT_PROVIDER_ERROR",
        "Midtrans sandbox response omitted redirect_url.",
        502,
      );
    }

    return {
      providerOrderId: body.token ?? req.orderCode,
      checkoutUrl: body.redirect_url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      providerMetadata: { snapToken: body.token ?? null },
    };
  }

  verifyAndParseWebhook(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    now?: Date;
  }): VerifiedWebhookEvent {
    const serverKey = this.getServerKey();
    this.assertSafeSandboxKey(serverKey);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(params.rawBody) as Record<string, unknown>;
    } catch {
      throw new PaymentSignatureError("Malformed JSON webhook body.");
    }

    const orderId = String(payload.order_id ?? "");
    const statusCode = String(payload.status_code ?? "");
    const grossAmountRaw = String(payload.gross_amount ?? "");
    const signatureKey = String(payload.signature_key ?? "");
    const txStatus = String(payload.transaction_status ?? "");
    const fraudStatus =
      typeof payload.fraud_status === "string"
        ? payload.fraud_status
        : undefined;
    const txId = String(payload.transaction_id ?? orderId);
    const currency = String(payload.currency ?? "IDR").toUpperCase();
    const txTimeStr =
      typeof payload.transaction_time === "string"
        ? payload.transaction_time
        : undefined;

    if (!orderId || !statusCode || !grossAmountRaw || !signatureKey) {
      throw new PaymentSignatureError(
        "Missing required Midtrans signature fields.",
      );
    }

    const expectedSig = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmountRaw}${serverKey}`, "utf8")
      .digest("hex");

    if (!constantTimeHexEqual(signatureKey, expectedSig)) {
      throw new PaymentSignatureError("Invalid Midtrans SHA-512 signature.");
    }

    const eventTimestamp = parseMidtransTimestamp(txTimeStr);
    if (eventTimestamp) {
      const nowMs = (params.now ?? new Date()).getTime();
      const ageSeconds = Math.abs(nowMs - eventTimestamp.getTime()) / 1000;
      if (ageSeconds > env.PAYMENT_WEBHOOK_MAX_AGE_SECONDS) {
        throw new PaymentSignatureError(
          `Midtrans webhook timestamp outside replay window (${Math.round(ageSeconds)}s).`,
        );
      }
    }

    const amount = Math.round(Number(grossAmountRaw));
    if (!Number.isFinite(amount)) {
      throw new PaymentSignatureError("Invalid gross_amount in webhook.");
    }

    const externalEventId =
      typeof payload.notification_id === "string" && payload.notification_id
        ? payload.notification_id
        : `${txId}:${txStatus}:${statusCode}`;

    return {
      externalEventId,
      eventType: `midtrans.${txStatus.toLowerCase()}`,
      orderCode: orderId,
      providerTransactionId: txId,
      normalizedStatus: mapMidtransStatus(txStatus, fraudStatus),
      amount,
      currency,
      eventTimestamp,
      rawSummary: {
        transaction_status: txStatus,
        fraud_status: fraudStatus ?? null,
        payment_type: payload.payment_type ?? null,
        status_code: statusCode,
      },
    };
  }

  async fetchOrderStatus(params: {
    orderCode: string;
  }): Promise<PaymentReconciliationResult> {
    const serverKey = this.getServerKey();
    this.assertSafeSandboxKey(serverKey);

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.MIDTRANS_API_BASE_URL.replace(/\/+$/, "");
    const auth = Buffer.from(`${serverKey}:`, "utf8").toString("base64");

    const res = await fetchFn(
      `${baseUrl}/${encodeURIComponent(params.orderCode)}/status`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    if (!res.ok) {
      throw new PaymentError(
        "RECONCILIATION_FAILED",
        `Midtrans status API returned HTTP ${res.status}.`,
        502,
      );
    }

    const body = (await res.json()) as {
      order_id?: string;
      transaction_id?: string;
      transaction_status?: string;
      fraud_status?: string;
      gross_amount?: string;
      currency?: string;
    };

    const parsedAmount = body.gross_amount
      ? Math.round(Number(body.gross_amount))
      : null;

    return {
      orderCode: body.order_id ?? params.orderCode,
      providerTransactionId: body.transaction_id ?? null,
      normalizedStatus: mapMidtransStatus(
        body.transaction_status ?? "pending",
        body.fraud_status,
      ),
      amount: Number.isFinite(parsedAmount) ? parsedAmount : null,
      currency: body.currency ? body.currency.toUpperCase() : "IDR",
      rawSummary: {
        transaction_status: body.transaction_status ?? null,
        fraud_status: body.fraud_status ?? null,
      },
    };
  }

  async issueRefund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const serverKey = this.getServerKey();
    this.assertSafeSandboxKey(serverKey);

    const fetchFn = this.fetchFn ?? fetch;
    const baseUrl = env.MIDTRANS_API_BASE_URL.replace(/\/+$/, "");
    const auth = Buffer.from(`${serverKey}:`, "utf8").toString("base64");

    const res = await fetchFn(
      `${baseUrl}/${encodeURIComponent(req.orderCode)}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          refund_key: req.idempotencyKey,
          amount: req.amount,
          reason: req.reason,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new PaymentError(
        "REFUND_FAILED",
        `Midtrans refund returned HTTP ${res.status}: ${errText.slice(0, 150)}`,
        502,
      );
    }

    const body = (await res.json()) as {
      refund_key?: string;
      transaction_id?: string;
      transaction_status?: string;
    };

    return {
      providerRefundId: body.refund_key ?? req.idempotencyKey,
      status: body.transaction_status === "refund" ? "succeeded" : "pending",
      rawSummary: {
        transaction_status: body.transaction_status ?? "refund",
      },
    };
  }
}
