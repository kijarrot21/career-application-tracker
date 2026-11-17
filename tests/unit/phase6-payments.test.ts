import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PaymentSignatureError } from "@/lib/domain/payments";
import {
  MidtransSandboxProvider,
  StripeSandboxProvider,
} from "@/server/payments/providers";

const MIDTRANS_SB_KEY = "SB-Mid-server-test-sandbox-key";
const STRIPE_SB_KEY = "sk_test_mock_sandbox_key";
const STRIPE_WH_SECRET = "whsec_test_sandbox_secret";

function signMidtrans(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}) {
  return createHash("sha512")
    .update(
      `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`,
      "utf8",
    )
    .digest("hex");
}

function signStripe(timestampSec: number, rawBody: string, secret: string) {
  const sig = createHmac("sha256", secret)
    .update(`${timestampSec}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestampSec},v1=${sig}`;
}

describe("Phase 6 Payment Architecture unit tests - gateway adapters & webhook crypto", () => {
  it("verifies Midtrans SHA-512 signatures and rejects invalid signatures or stale replay timestamps", async () => {
    const adapter = new MidtransSandboxProvider({
      serverKeyOverride: MIDTRANS_SB_KEY,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            token: "snap-tok-123",
            redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-tok-123",
          }),
          { status: 201 },
        ),
    });

    expect(adapter.isConfigured()).toBe(true);
    const checkout = await adapter.createCheckout({
      orderCode: "ORD-20261117-AAAA1111",
      userId: "user_a",
      userEmail: "alice@example.com",
      userName: "Alice",
      packageKey: "starter_50",
      packageName: "Starter Pack",
      creditsToGrant: 50,
      amount: 49_000,
      currency: "IDR",
      returnUrl: "http://localhost:3000/credits",
      idempotencyKey: "chk-1",
    });
    expect(checkout.checkoutUrl).toContain("sandbox.midtrans.com");

    const now = new Date("2026-11-17T06:00:00Z");
    const validBody = JSON.stringify({
      order_id: "ORD-20261117-AAAA1111",
      status_code: "200",
      gross_amount: "49000.00",
      transaction_status: "settlement",
      fraud_status: "accept",
      transaction_id: "mtx-001",
      currency: "IDR",
      transaction_time: "2026-11-17T05:59:30Z",
      signature_key: signMidtrans({
        orderId: "ORD-20261117-AAAA1111",
        statusCode: "200",
        grossAmount: "49000.00",
        serverKey: MIDTRANS_SB_KEY,
      }),
    });

    const parsed = adapter.verifyAndParseWebhook({
      rawBody: validBody,
      headers: {},
      now,
    });
    expect(parsed.normalizedStatus).toBe("paid");
    expect(parsed.amount).toBe(49_000);
    expect(parsed.currency).toBe("IDR");

    // Tampered signature
    const badSigBody = JSON.stringify({
      ...JSON.parse(validBody),
      signature_key: "0".repeat(128),
    });
    expect(() =>
      adapter.verifyAndParseWebhook({ rawBody: badSigBody, headers: {}, now }),
    ).toThrow(PaymentSignatureError);

    // Replay attack: timestamp 1 hour old (exceeds 300s tolerance)
    const oldBody = JSON.stringify({
      order_id: "ORD-20261117-AAAA1111",
      status_code: "200",
      gross_amount: "49000.00",
      transaction_status: "settlement",
      transaction_time: "2026-11-17T04:00:00Z",
      signature_key: signMidtrans({
        orderId: "ORD-20261117-AAAA1111",
        statusCode: "200",
        grossAmount: "49000.00",
        serverKey: MIDTRANS_SB_KEY,
      }),
    });
    expect(() =>
      adapter.verifyAndParseWebhook({ rawBody: oldBody, headers: {}, now }),
    ).toThrow(PaymentSignatureError);
  });

  it("verifies Stripe HMAC-SHA256 signatures, enforces replay windows, and blocks live production keys", async () => {
    // Live production Stripe key must be refused cleanly
    const liveBlocked = new StripeSandboxProvider({
      secretKeyOverride: "sk_live_forbidden_key",
      webhookSecretOverride: STRIPE_WH_SECRET,
    });
    expect(liveBlocked.isConfigured()).toBe(false);
    await expect(
      liveBlocked.createCheckout({
        orderCode: "ORD-1",
        userId: "u1",
        userEmail: "a@b.com",
        userName: "A",
        packageKey: "starter_50",
        packageName: "Starter",
        creditsToGrant: 50,
        amount: 350,
        currency: "USD",
        returnUrl: "http://localhost:3000/credits",
        idempotencyKey: "k1",
      }),
    ).rejects.toMatchObject({ code: "PRODUCTION_PAYMENTS_DISABLED" });

    // Live Midtrans server key must also be blocked
    const midLiveBlocked = new MidtransSandboxProvider({
      serverKeyOverride: "Mid-server-live-forbidden",
    });
    expect(midLiveBlocked.isConfigured()).toBe(false);

    // Valid Stripe sandbox verification
    const stripe = new StripeSandboxProvider({
      secretKeyOverride: STRIPE_SB_KEY,
      webhookSecretOverride: STRIPE_WH_SECRET,
    });
    const now = new Date("2026-11-17T06:00:00Z");
    const ts = Math.floor(now.getTime() / 1000) - 20;
    const rawBody = JSON.stringify({
      id: "evt_stripe_100",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          client_reference_id: "ORD-20261117-BBBB2222",
          amount_total: 350,
          currency: "usd",
          payment_status: "paid",
        },
      },
    });

    const verified = stripe.verifyAndParseWebhook({
      rawBody,
      headers: { "stripe-signature": signStripe(ts, rawBody, STRIPE_WH_SECRET) },
      now,
    });
    expect(verified.normalizedStatus).toBe("paid");
    expect(verified.amount).toBe(350);
    expect(verified.currency).toBe("USD");

    // Expired timestamp replay
    const staleTs = Math.floor(now.getTime() / 1000) - 600;
    expect(() =>
      stripe.verifyAndParseWebhook({
        rawBody,
        headers: {
          "stripe-signature": signStripe(staleTs, rawBody, STRIPE_WH_SECRET),
        },
        now,
      }),
    ).toThrow(PaymentSignatureError);
  });
});
