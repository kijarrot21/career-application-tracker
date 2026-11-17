import { createHash, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  paymentOrders,
  paymentTransactions,
  paymentWebhookEvents,
} from "@/db/schema";
import { PaymentSignatureError } from "@/lib/domain/payments";
import {
  MidtransSandboxProvider,
  StripeSandboxProvider,
} from "@/server/payments/providers";
import {
  getWalletSummaryForUser,
  listCreditLedgerForUser,
} from "@/server/queries/credits";
import {
  getPaymentOrderDetailForUser,
  listPaymentOrdersForUser,
} from "@/server/queries/payments";
import {
  ensureCreditWalletService,
  verifyWalletLedgerIntegrityService,
} from "@/server/services/credits";
import {
  createCreditCheckoutOrderService,
  processPaymentWebhookService,
  reconcilePaymentOrderService,
  refundPaymentOrderService,
} from "@/server/services/payments";
import { exportAccountJsonService } from "@/server/services/settings";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const MIDTRANS_KEY = "SB-Mid-server-integration-test";
const STRIPE_KEY = "sk_test_integration_key";
const STRIPE_WH_SECRET = "whsec_integration_secret";

function midtransSig(
  orderId: string,
  statusCode: string,
  grossAmount: string,
) {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${MIDTRANS_KEY}`, "utf8")
    .digest("hex");
}

function stripeSig(tsSec: number, body: string) {
  const sig = createHmac("sha256", STRIPE_WH_SECRET)
    .update(`${tsSec}.${body}`, "utf8")
    .digest("hex");
  return `t=${tsSec},v1=${sig}`;
}

describe("Phase 6 Payment Architecture & Integration tests (in-memory PGlite)", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;

    await createTestUser(db, {
      id: "user_a",
      name: "Alice Buyer",
      email: "alice@example.com",
    });
    await createTestUser(db, {
      id: "user_b",
      name: "Bob Other",
      email: "bob@example.com",
    });

    await ensureCreditWalletService("user_a", { initialCredits: 10 });
  }, 30000);

  afterEach(async () => {
    await cleanup();
  }, 15000);

  it("handles successful Midtrans sandbox checkout, duplicate webhook deduplication, reconciliation idempotency, and exactly ONE credit grant", async () => {
    let remoteStatus: "pending" | "settlement" = "pending";
    const midtrans = new MidtransSandboxProvider({
      serverKeyOverride: MIDTRANS_KEY,
      fetchFn: async (url) => {
        const target = String(url);
        if (target.endsWith("/transactions")) {
          return new Response(
            JSON.stringify({
              token: "snap-token-1",
              redirect_url:
                "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-1",
            }),
            { status: 201 },
          );
        }
        return new Response(
          JSON.stringify({
            order_id: created.order.orderCode,
            transaction_id: "mtx-settle-1",
            transaction_status: remoteStatus,
            fraud_status: "accept",
            gross_amount: "49000.00",
            currency: "IDR",
          }),
          { status: 200 },
        );
      },
    });

    // 1. Initiate checkout (starter_50 -> 50 credits for IDR 49,000)
    const created = await createCreditCheckoutOrderService(
      "user_a",
      {
        packageKey: "starter_50",
        provider: "midtrans",
        idempotencyKey: "order-idemp-1",
      },
      { adapterOverride: midtrans },
    );

    expect(created.order.status).toBe("requires_action");
    expect(created.order.currency).toBe("IDR");
    expect(created.order.expectedAmount).toBe(49_000);
    expect(created.order.creditsToGrant).toBe(50);

    // Duplicate checkout with same idempotencyKey returns existing order without duplicating
    const duplicateCheckout = await createCreditCheckoutOrderService(
      "user_a",
      {
        packageKey: "starter_50",
        provider: "midtrans",
        idempotencyKey: "order-idemp-1",
      },
      { adapterOverride: midtrans },
    );
    expect(duplicateCheckout.deduplicated).toBe(true);
    expect(duplicateCheckout.order.id).toBe(created.order.id);

    // 2. Verified webhook confirms payment -> wallet increases from 10 to 60 ONCE
    remoteStatus = "settlement";
    const now = new Date();
    const webhookBody = JSON.stringify({
      notification_id: "notif-mid-1",
      order_id: created.order.orderCode,
      status_code: "200",
      gross_amount: "49000.00",
      transaction_status: "settlement",
      fraud_status: "accept",
      transaction_id: "mtx-settle-1",
      currency: "IDR",
      transaction_time: now.toISOString(),
      signature_key: midtransSig(created.order.orderCode, "200", "49000.00"),
    });

    const wh1 = await processPaymentWebhookService({
      provider: "midtrans",
      rawBody: webhookBody,
      headers: {},
      now,
      adapterOverride: midtrans,
    });
    expect(wh1.processingStatus).toBe("processed");
    expect(wh1.creditsGranted).toBe(true);
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(60);

    // 3. Duplicate webhook delivery ignored idempotently -> balance remains 60
    const wh2 = await processPaymentWebhookService({
      provider: "midtrans",
      rawBody: webhookBody,
      headers: {},
      now,
      adapterOverride: midtrans,
    });
    expect(wh2.processingStatus).toBe("ignored_duplicate");
    expect(wh2.deduplicated).toBe(true);
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(60);

    // 4. Even a different notification ID or subsequent reconciliation cannot double-grant
    const whDifferentEvent = JSON.stringify({
      notification_id: "notif-mid-2-retry",
      order_id: created.order.orderCode,
      status_code: "200",
      gross_amount: "49000.00",
      transaction_status: "settlement",
      fraud_status: "accept",
      transaction_id: "mtx-settle-1",
      currency: "IDR",
      transaction_time: now.toISOString(),
      signature_key: midtransSig(created.order.orderCode, "200", "49000.00"),
    });
    await processPaymentWebhookService({
      provider: "midtrans",
      rawBody: whDifferentEvent,
      headers: {},
      now,
      adapterOverride: midtrans,
    });
    await reconcilePaymentOrderService("user_a", created.order.id, {
      adapterOverride: midtrans,
    });

    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(60);
    expect((await verifyWalletLedgerIntegrityService("user_a")).valid).toBe(true);

    // Cross-user isolation on order lookup & reconciliation
    expect(
      await getPaymentOrderDetailForUser("user_b", created.order.id),
    ).toBeNull();
    expect(await listPaymentOrdersForUser("user_b")).toHaveLength(0);
    await expect(
      reconcilePaymentOrderService("user_b", created.order.id, {
        adapterOverride: midtrans,
      }),
    ).rejects.toThrow("Payment order not found.");

    // Export includes paymentOrders & paymentTransactions
    const exported = await exportAccountJsonService("user_a");
    expect(exported.paymentOrders).toHaveLength(1);
    expect(exported.paymentTransactions.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid signatures, replay attacks, incorrect payment amount, and incorrect currency without granting credits", async () => {
    let snapSeq = 0;
    const midtrans = new MidtransSandboxProvider({
      serverKeyOverride: MIDTRANS_KEY,
      fetchFn: async () => {
        snapSeq += 1;
        return new Response(
          JSON.stringify({
            token: `snap-${snapSeq}`,
            redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-${snapSeq}`,
          }),
          { status: 201 },
        );
      },
    });

    const orderRes = await createCreditCheckoutOrderService(
      "user_a",
      { packageKey: "starter_50", provider: "midtrans" },
      { adapterOverride: midtrans },
    );
    const now = new Date();

    // 1. Invalid signature -> PaymentSignatureError, logs rejected_signature, zero credits
    await expect(
      processPaymentWebhookService({
        provider: "midtrans",
        rawBody: JSON.stringify({
          order_id: orderRes.order.orderCode,
          status_code: "200",
          gross_amount: "49000.00",
          transaction_status: "settlement",
          signature_key: "f".repeat(128),
        }),
        headers: {},
        now,
        adapterOverride: midtrans,
      }),
    ).rejects.toBeInstanceOf(PaymentSignatureError);

    // 2. Replay attack (old timestamp)
    const oldTime = new Date(now.getTime() - 3600_000).toISOString();
    await expect(
      processPaymentWebhookService({
        provider: "midtrans",
        rawBody: JSON.stringify({
          order_id: orderRes.order.orderCode,
          status_code: "200",
          gross_amount: "49000.00",
          transaction_status: "settlement",
          transaction_time: oldTime,
          signature_key: midtransSig(
            orderRes.order.orderCode,
            "200",
            "49000.00",
          ),
        }),
        headers: {},
        now,
        adapterOverride: midtrans,
      }),
    ).rejects.toBeInstanceOf(PaymentSignatureError);

    // 3. Incorrect payment amount (paid 10,000 instead of 49,000) -> rejected_validation + disputed
    const wrongAmtRes = await processPaymentWebhookService({
      provider: "midtrans",
      rawBody: JSON.stringify({
        notification_id: "notif-wrong-amt",
        order_id: orderRes.order.orderCode,
        status_code: "200",
        gross_amount: "10000.00",
        transaction_status: "settlement",
        transaction_id: "mtx-bad-amt",
        currency: "IDR",
        transaction_time: now.toISOString(),
        signature_key: midtransSig(orderRes.order.orderCode, "200", "10000.00"),
      }),
      headers: {},
      now,
      adapterOverride: midtrans,
    });
    expect(wrongAmtRes.processingStatus).toBe("rejected_validation");
    expect(wrongAmtRes.creditsGranted).toBe(false);

    // 4. Incorrect currency (USD sent to IDR Midtrans order)
    const order2 = await createCreditCheckoutOrderService(
      "user_a",
      { packageKey: "starter_50", provider: "midtrans" },
      { adapterOverride: midtrans },
    );
    const wrongCurRes = await processPaymentWebhookService({
      provider: "midtrans",
      rawBody: JSON.stringify({
        notification_id: "notif-wrong-cur",
        order_id: order2.order.orderCode,
        status_code: "200",
        gross_amount: "49000.00",
        transaction_status: "settlement",
        transaction_id: "mtx-bad-cur",
        currency: "USD",
        transaction_time: now.toISOString(),
        signature_key: midtransSig(order2.order.orderCode, "200", "49000.00"),
      }),
      headers: {},
      now,
      adapterOverride: midtrans,
    });
    expect(wrongCurRes.processingStatus).toBe("rejected_validation");

    // Wallet still has strictly original 10 credits
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(10);

    const events = await db.select().from(paymentWebhookEvents);
    expect(events.some((e) => e.processingStatus === "rejected_signature")).toBe(
      true,
    );
    expect(events.some((e) => e.processingStatus === "rejected_validation")).toBe(
      true,
    );
  });

  it("supports failed checkout, Stripe international reconciliation recovery, and full refund clawback", async () => {
    let stripeSeq = 0;
    const stripe = new StripeSandboxProvider({
      secretKeyOverride: STRIPE_KEY,
      webhookSecretOverride: STRIPE_WH_SECRET,
      fetchFn: async (url, init) => {
        const target = String(url);
        if (target.endsWith("/checkout/sessions") && init?.method === "POST") {
          stripeSeq += 1;
          const sid = `cs_test_session_${stripeSeq}`;
          return new Response(
            JSON.stringify({
              id: sid,
              url: `https://checkout.stripe.com/c/pay/${sid}`,
            }),
            { status: 200 },
          );
        }
        if (target.includes("/checkout/sessions/cs_test_session_1")) {
          return new Response(
            JSON.stringify({
              id: "cs_test_session_1",
              payment_intent: "pi_test_99",
              payment_status: "paid",
              status: "complete",
              amount_total: 900,
              currency: "usd",
              client_reference_id: proOrder.order.orderCode,
            }),
            { status: 200 },
          );
        }
        if (target.endsWith("/refunds")) {
          return new Response(
            JSON.stringify({ id: "re_test_1", status: "succeeded" }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });

    // 1. Failed checkout order
    const failStripe = new StripeSandboxProvider({
      secretKeyOverride: STRIPE_KEY,
      webhookSecretOverride: STRIPE_WH_SECRET,
      fetchFn: async () => new Response("Card declined", { status: 402 }),
    });
    await expect(
      createCreditCheckoutOrderService(
        "user_a",
        { packageKey: "starter_50", provider: "stripe" },
        { adapterOverride: failStripe },
      ),
    ).rejects.toThrow();

    // 2. Successful Stripe USD checkout (growth_150 -> 150 + 25 = 175 credits for $9.00 = 900 cents)
    const proOrder = await createCreditCheckoutOrderService(
      "user_a",
      { packageKey: "growth_150", provider: "stripe" },
      { adapterOverride: stripe },
    );
    expect(proOrder.order.currency).toBe("USD");
    expect(proOrder.order.expectedAmount).toBe(900);
    expect(proOrder.order.creditsToGrant).toBe(175);

    // Recover missed webhook via reconciliation -> grants 175 credits (10 -> 185)
    const reconciled = await reconcilePaymentOrderService(
      "user_a",
      proOrder.order.id,
      { adapterOverride: stripe },
    );
    expect(reconciled.status).toBe("paid");
    expect(reconciled.creditsGranted).toBe(true);
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(185);

    // 3. Test failed webhook on another Stripe order -> marks failed, zero credits
    const secondOrder = await createCreditCheckoutOrderService(
      "user_a",
      { packageKey: "starter_50", provider: "stripe" },
      { adapterOverride: stripe },
    );
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000) - 5;
    const failBody = JSON.stringify({
      id: "evt_fail_1",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_fail_1",
          client_reference_id: secondOrder.order.orderCode,
          amount: 350,
          currency: "usd",
        },
      },
    });
    await processPaymentWebhookService({
      provider: "stripe",
      rawBody: failBody,
      headers: { "stripe-signature": stripeSig(ts, failBody) },
      now,
      adapterOverride: stripe,
    });
    const [failedOrderRow] = await db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, secondOrder.order.id));
    expect(failedOrderRow.status).toBe("failed");
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(185);

    // 4. Refund paid proOrder -> claws back 175 credits back to 10 & logs refund tx
    const refundedOrder = await refundPaymentOrderService(
      "user_a",
      { orderId: proOrder.order.id, reason: "Customer requested refund" },
      { adapterOverride: stripe },
    );
    expect(refundedOrder.status).toBe("refunded");
    expect((await getWalletSummaryForUser("user_a")).availableBalance).toBe(10);

    const ledger = await listCreditLedgerForUser("user_a");
    expect(ledger.some((l) => l.referenceType === "payment_refund")).toBe(true);
    expect((await verifyWalletLedgerIntegrityService("user_a")).valid).toBe(true);

    const txs = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, proOrder.order.id));
    expect(txs.some((t) => t.transactionType === "refund")).toBe(true);
  });
});
