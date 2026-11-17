import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady, type AppDb } from "@/db";
import {
  creditLedger,
  creditPackages,
  creditWallets,
  paymentOrders,
  paymentTransactions,
  paymentWebhookEvents,
  user,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  PAYMENT_PROVIDERS,
  PaymentError,
  PaymentSignatureError,
  type NormalizedPaymentEventStatus,
  type PaymentProviderId,
} from "@/lib/domain/payments";
import { env } from "@/lib/env";
import {
  createDefaultPaymentProviderRegistry,
  type PaymentProviderAdapter,
  type PaymentProviderRegistry,
} from "@/server/payments/providers";
import {
  ensureCreditWalletTx,
  runCreditTx,
} from "@/server/services/credits";

type DbOrTx = Pick<
  AppDb,
  "select" | "insert" | "update" | "delete" | "execute"
>;

function sha256Hex(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateOrderCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `ORD-${datePart}-${rand}`;
}

export const createCheckoutInputSchema = z.object({
  packageKey: z.string().trim().min(1).max(100),
  provider: z.enum(PAYMENT_PROVIDERS),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  returnPath: z.string().trim().max(200).optional(),
});

/**
 * Creates a server-authoritative `payment_orders` row from the DB package catalog
 * (never trusting client-supplied price/currency/credit counts) and requests a
 * checkout session from the configured sandbox provider adapter.
 */
export async function createCreditCheckoutOrderService(
  userId: string,
  rawInput: z.input<typeof createCheckoutInputSchema>,
  options?: {
    registry?: PaymentProviderRegistry;
    adapterOverride?: PaymentProviderAdapter;
  },
) {
  const input = createCheckoutInputSchema.parse(rawInput);
  const db = await ensureDbReady();

  const adapter =
    options?.adapterOverride ??
    (options?.registry ?? createDefaultPaymentProviderRegistry())[
      input.provider
    ];

  if (!adapter.isConfigured()) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_DISABLED",
      `Payment provider '${input.provider}' is not enabled in sandbox mode. Real-money payments require explicit owner approval.`,
      503,
    );
  }

  const [[pkg], [accountUser]] = await Promise.all([
    db
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.packageKey, input.packageKey),
          eq(creditPackages.isActive, true),
        ),
      ),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, userId)),
  ]);

  if (!pkg) {
    throw new PaymentError(
      "CREDIT_PACKAGE_NOT_FOUND",
      `Credit package '${input.packageKey}' was not found or is inactive.`,
      404,
    );
  }
  if (!accountUser) {
    throw new PaymentError("USER_NOT_FOUND", "User account not found.", 404);
  }

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `chk:${userId}:${pkg.packageKey}:${input.provider}:${randomBytes(6).toString("hex")}`;

  // Deduplicate repeated checkout requests with same idempotencyKey
  const [existingOrder] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.userId, userId),
        eq(paymentOrders.idempotencyKey, idempotencyKey),
      ),
    );
  if (existingOrder) {
    return { order: existingOrder, deduplicated: true };
  }

  const currency: "IDR" | "USD" =
    input.provider === "midtrans" ? "IDR" : "USD";
  const expectedAmount =
    currency === "IDR" ? pkg.priceIdr : pkg.priceUsdCents;
  const creditsToGrant = pkg.credits + pkg.bonusCredits;
  const orderCode = generateOrderCode();
  const safeReturnPath =
    input.returnPath && input.returnPath.startsWith("/")
      ? input.returnPath
      : "/credits";
  const returnUrl = `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}${safeReturnPath}?order=${encodeURIComponent(orderCode)}`;

  const [createdOrder] = await db
    .insert(paymentOrders)
    .values({
      userId,
      orderCode,
      packageId: pkg.id,
      packageKey: pkg.packageKey,
      provider: input.provider,
      environment: env.PAYMENT_MODE === "sandbox" ? "sandbox" : "sandbox",
      currency,
      expectedAmount,
      creditsToGrant,
      status: "pending",
      idempotencyKey,
    })
    .returning();

  try {
    const checkout = await adapter.createCheckout({
      orderCode: createdOrder.orderCode,
      userId,
      userEmail: accountUser.email,
      userName: accountUser.name,
      packageKey: pkg.packageKey,
      packageName: pkg.name,
      creditsToGrant,
      amount: expectedAmount,
      currency,
      returnUrl,
      idempotencyKey,
    });

    const [updated] = await db
      .update(paymentOrders)
      .set({
        providerOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt ?? null,
        status: "requires_action",
        metadata: checkout.providerMetadata ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentOrders.id, createdOrder.id),
          eq(paymentOrders.userId, userId),
        ),
      )
      .returning();

    await writeAudit(db, {
      userId,
      entityType: "payment_order",
      entityId: updated.id,
      action: "create",
      summary: `Initiated ${input.provider} sandbox checkout ${updated.orderCode} for ${creditsToGrant} credits (${currency} ${expectedAmount})`,
    });

    return { order: updated, deduplicated: false };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Provider checkout initiation failed.";
    await db
      .update(paymentOrders)
      .set({
        status: "failed",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentOrders.id, createdOrder.id),
          eq(paymentOrders.userId, userId),
        ),
      );
    throw err;
  }
}

async function grantPurchasedCreditsTx(
  tx: DbOrTx,
  order: typeof paymentOrders.$inferSelect,
) {
  const wallet = await ensureCreditWalletTx(tx, order.userId);
  const ledgerIdemp = `purchase:${order.id}`;

  const [existingLedger] = await tx
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, order.userId),
        eq(creditLedger.idempotencyKey, ledgerIdemp),
      ),
    );

  if (existingLedger) {
    return existingLedger;
  }

  await tx.execute(
    sql`SELECT id FROM credit_wallets WHERE id = ${wallet.id} AND user_id = ${order.userId} FOR UPDATE`,
  );

  const [updatedWallet] = await tx
    .update(creditWallets)
    .set({
      availableBalance: sql`${creditWallets.availableBalance} + ${order.creditsToGrant}`,
      lifetimeGranted: sql`${creditWallets.lifetimeGranted} + ${order.creditsToGrant}`,
      version: sql`${creditWallets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditWallets.id, wallet.id),
        eq(creditWallets.userId, order.userId),
      ),
    )
    .returning();

  const [entry] = await tx
    .insert(creditLedger)
    .values({
      userId: order.userId,
      walletId: updatedWallet.id,
      entryType: "grant",
      deltaAvailable: order.creditsToGrant,
      deltaReserved: 0,
      balanceAfterAvailable: updatedWallet.availableBalance,
      balanceAfterReserved: updatedWallet.reservedBalance,
      referenceType: "payment_order",
      referenceId: order.id,
      idempotencyKey: ledgerIdemp,
      reason: `Purchased ${order.packageKey} (${order.orderCode}) via ${order.provider}`,
      metadata: {
        orderCode: order.orderCode,
        provider: order.provider,
        currency: order.currency,
        amount: order.expectedAmount,
      },
    })
    .returning();

  return entry;
}

async function applyOrderRefundTx(
  tx: DbOrTx,
  order: typeof paymentOrders.$inferSelect,
  params: {
    providerTransactionId?: string | null;
    reason: string;
    idempotencyKey: string;
    rawSummary?: Record<string, unknown>;
  },
) {
  const wallet = await ensureCreditWalletTx(tx, order.userId);
  const lockRes = await tx.execute(
    sql`SELECT available_balance FROM credit_wallets WHERE id = ${wallet.id} AND user_id = ${order.userId} FOR UPDATE`,
  );
  const currentAvail =
    (lockRes.rows[0] as { available_balance: number } | undefined)
      ?.available_balance ?? wallet.availableBalance;

  // Claw back up to available balance while keeping wallet non-negative
  const clawbackAmount = Math.min(currentAvail, order.creditsToGrant);

  if (clawbackAmount > 0) {
    const [existingLedger] = await tx
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, order.userId),
          eq(creditLedger.idempotencyKey, params.idempotencyKey),
        ),
      );

    if (!existingLedger) {
      const [updatedWallet] = await tx
        .update(creditWallets)
        .set({
          availableBalance: sql`${creditWallets.availableBalance} - ${clawbackAmount}`,
          version: sql`${creditWallets.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditWallets.id, wallet.id),
            eq(creditWallets.userId, order.userId),
            sql`${creditWallets.availableBalance} >= ${clawbackAmount}`,
          ),
        )
        .returning();

      await tx.insert(creditLedger).values({
        userId: order.userId,
        walletId: updatedWallet.id,
        entryType: "adjustment",
        deltaAvailable: -clawbackAmount,
        deltaReserved: 0,
        balanceAfterAvailable: updatedWallet.availableBalance,
        balanceAfterReserved: updatedWallet.reservedBalance,
        referenceType: "payment_refund",
        referenceId: order.id,
        idempotencyKey: params.idempotencyKey,
        reason: params.reason,
        metadata: {
          orderCode: order.orderCode,
          requestedClawback: order.creditsToGrant,
          actualClawback: clawbackAmount,
        },
      });
    }
  }

  const [updatedOrder] = await tx
    .update(paymentOrders)
    .set({
      status: "refunded",
      updatedAt: new Date(),
    })
    .where(
      and(eq(paymentOrders.id, order.id), eq(paymentOrders.userId, order.userId)),
    )
    .returning();

  await tx
    .insert(paymentTransactions)
    .values({
      userId: order.userId,
      orderId: order.id,
      provider: order.provider,
      transactionType: "refund",
      providerTransactionId: params.providerTransactionId ?? null,
      amount: order.expectedAmount,
      currency: order.currency,
      status: "refunded",
      rawSummary: params.rawSummary ?? null,
    })
    .onConflictDoNothing();

  await writeAudit(tx, {
    userId: order.userId,
    entityType: "payment_order",
    entityId: order.id,
    action: "update",
    summary: `Refunded payment order ${order.orderCode} (clawed back ${clawbackAmount} credit(s))`,
  });

  return updatedOrder;
}

async function applyVerifiedOrderStateTx(
  tx: DbOrTx,
  params: {
    order: typeof paymentOrders.$inferSelect;
    normalizedStatus: NormalizedPaymentEventStatus;
    providerTransactionId?: string | null;
    rawSummary?: Record<string, unknown>;
    source: "webhook" | "reconciliation";
  },
) {
  const { order, normalizedStatus } = params;
  const now = new Date();

  if (normalizedStatus === "paid") {
    let ledgerId = order.creditLedgerId;
    if (!order.creditsGranted) {
      const entry = await grantPurchasedCreditsTx(tx, order);
      ledgerId = entry.id;
    }

    const [updatedOrder] = await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        creditsGranted: true,
        creditLedgerId: ledgerId,
        paidAt: order.paidAt ?? now,
        failureReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentOrders.id, order.id),
          eq(paymentOrders.userId, order.userId),
        ),
      )
      .returning();

    await tx
      .insert(paymentTransactions)
      .values({
        userId: order.userId,
        orderId: order.id,
        provider: order.provider,
        transactionType:
          params.source === "reconciliation" ? "reconciliation" : "charge",
        providerTransactionId: params.providerTransactionId ?? null,
        amount: order.expectedAmount,
        currency: order.currency,
        status: "succeeded",
        rawSummary: params.rawSummary ?? null,
        processedAt: now,
      })
      .onConflictDoNothing();

    await writeAudit(tx, {
      userId: order.userId,
      entityType: "payment_order",
      entityId: order.id,
      action: "update",
      summary: `Confirmed payment ${order.orderCode} via ${params.source} and granted ${order.creditsToGrant} credit(s)`,
    });

    return updatedOrder;
  }

  if (normalizedStatus === "refunded") {
    return applyOrderRefundTx(tx, order, {
      providerTransactionId: params.providerTransactionId,
      reason: `Payment ${order.orderCode} refunded via ${params.source}`,
      idempotencyKey: `refund:order:${order.id}`,
      rawSummary: params.rawSummary,
    });
  }

  if (
    (normalizedStatus === "failed" || normalizedStatus === "expired") &&
    !order.creditsGranted &&
    order.status !== "paid"
  ) {
    const [updatedOrder] = await tx
      .update(paymentOrders)
      .set({
        status: normalizedStatus,
        failureReason: `Provider reported status '${normalizedStatus}'`,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentOrders.id, order.id),
          eq(paymentOrders.userId, order.userId),
        ),
      )
      .returning();

    await tx
      .insert(paymentTransactions)
      .values({
        userId: order.userId,
        orderId: order.id,
        provider: order.provider,
        transactionType:
          params.source === "reconciliation" ? "reconciliation" : "charge",
        providerTransactionId: params.providerTransactionId ?? null,
        amount: order.expectedAmount,
        currency: order.currency,
        status: "failed",
        rawSummary: params.rawSummary ?? null,
        processedAt: now,
      })
      .onConflictDoNothing();

    return updatedOrder;
  }

  return order;
}

/**
 * Verifies cryptographic webhook signatures, enforces replay windows and event
 * deduplication, validates amount & currency against server `payment_orders`,
 * and triggers an idempotent authoritative credit grant on verified `paid`.
 */
export async function processPaymentWebhookService(params: {
  provider: PaymentProviderId;
  rawBody: string;
  headers: Record<string, string | undefined>;
  now?: Date;
  adapterOverride?: PaymentProviderAdapter;
}) {
  const adapter =
    params.adapterOverride ??
    createDefaultPaymentProviderRegistry()[params.provider];
  const payloadHash = sha256Hex(params.rawBody);

  // 1. Cryptographic signature + replay window verification
  let verifiedEvent;
  try {
    verifiedEvent = adapter.verifyAndParseWebhook({
      rawBody: params.rawBody,
      headers: params.headers,
      now: params.now,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook signature verification failed.";
    await runCreditTx(async (tx) => {
      await tx
        .insert(paymentWebhookEvents)
        .values({
          provider: params.provider,
          externalEventId: `rejected:${payloadHash.slice(0, 24)}:${randomBytes(4).toString("hex")}`,
          eventType: "signature_rejected",
          signatureValid: false,
          payloadHash,
          processingStatus: "rejected_signature",
          errorMessage: message,
          processedAt: new Date(),
        })
        .onConflictDoNothing();
    });
    if (err instanceof PaymentSignatureError) throw err;
    throw new PaymentSignatureError(message);
  }

  // 2. Atomic event deduplication + order validation + credit settlement
  return runCreditTx(async (tx) => {
    const [existingEvent] = await tx
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.provider, params.provider),
          eq(
            paymentWebhookEvents.externalEventId,
            verifiedEvent.externalEventId,
          ),
        ),
      );

    if (existingEvent) {
      return {
        processingStatus: "ignored_duplicate" as const,
        deduplicated: true,
        orderId: existingEvent.orderId,
        creditsGranted: false,
      };
    }

    const lockRes = await tx.execute(
      sql`SELECT id FROM payment_orders WHERE order_code = ${verifiedEvent.orderCode} FOR UPDATE`,
    );
    const lockedId = (lockRes.rows[0] as { id: string } | undefined)?.id;

    const [order] = lockedId
      ? await tx
          .select()
          .from(paymentOrders)
          .where(eq(paymentOrders.id, lockedId))
      : [];

    if (!order) {
      await tx.insert(paymentWebhookEvents).values({
        provider: params.provider,
        externalEventId: verifiedEvent.externalEventId,
        eventType: verifiedEvent.eventType,
        signatureValid: true,
        payloadHash,
        eventTimestamp: verifiedEvent.eventTimestamp,
        processingStatus: "rejected_validation",
        errorMessage: `Order '${verifiedEvent.orderCode}' not found.`,
        payloadSummary: verifiedEvent.rawSummary,
        processedAt: new Date(),
      });
      return {
        processingStatus: "rejected_validation" as const,
        deduplicated: false,
        reason: `Order '${verifiedEvent.orderCode}' not found.`,
        creditsGranted: false,
      };
    }

    // Strict server-side amount, currency, and provider verification
    const providerMatches = order.provider === params.provider;
    const currencyMatches = verifiedEvent.currency === order.currency;
    const amountMatches = verifiedEvent.amount === order.expectedAmount;

    if (!providerMatches || !currencyMatches || !amountMatches) {
      const mismatchMsg = `Validation mismatch: expected ${order.provider} ${order.currency} ${order.expectedAmount}, received ${params.provider} ${verifiedEvent.currency} ${verifiedEvent.amount}.`;

      await tx
        .update(paymentOrders)
        .set({
          status: "disputed",
          failureReason: mismatchMsg,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));

      await tx.insert(paymentWebhookEvents).values({
        provider: params.provider,
        externalEventId: verifiedEvent.externalEventId,
        eventType: verifiedEvent.eventType,
        orderId: order.id,
        userId: order.userId,
        signatureValid: true,
        payloadHash,
        eventTimestamp: verifiedEvent.eventTimestamp,
        processingStatus: "rejected_validation",
        errorMessage: mismatchMsg,
        payloadSummary: verifiedEvent.rawSummary,
        processedAt: new Date(),
      });

      await writeAudit(tx, {
        userId: order.userId,
        entityType: "payment_order",
        entityId: order.id,
        action: "update",
        summary: `Rejected mismatched webhook for ${order.orderCode}: ${mismatchMsg}`,
      });

      return {
        processingStatus: "rejected_validation" as const,
        deduplicated: false,
        orderId: order.id,
        reason: mismatchMsg,
        creditsGranted: false,
      };
    }

    const updatedOrder = await applyVerifiedOrderStateTx(tx, {
      order,
      normalizedStatus: verifiedEvent.normalizedStatus,
      providerTransactionId: verifiedEvent.providerTransactionId,
      rawSummary: verifiedEvent.rawSummary,
      source: "webhook",
    });

    await tx.insert(paymentWebhookEvents).values({
      provider: params.provider,
      externalEventId: verifiedEvent.externalEventId,
      eventType: verifiedEvent.eventType,
      orderId: order.id,
      userId: order.userId,
      signatureValid: true,
      payloadHash,
      eventTimestamp: verifiedEvent.eventTimestamp,
      processingStatus: "processed",
      payloadSummary: verifiedEvent.rawSummary,
      processedAt: new Date(),
    });

    return {
      processingStatus: "processed" as const,
      deduplicated: false,
      orderId: updatedOrder.id,
      orderStatus: updatedOrder.status,
      creditsGranted: updatedOrder.creditsGranted,
    };
  });
}

/**
 * Reconciles a user-owned payment order directly with the payment provider API,
 * recovering safely if a webhook was delayed or missed without double-crediting.
 */
export async function reconcilePaymentOrderService(
  userId: string,
  orderId: string,
  options?: { adapterOverride?: PaymentProviderAdapter },
) {
  const id = z.string().uuid().parse(orderId);
  const db = await ensureDbReady();

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, id), eq(paymentOrders.userId, userId)));

  if (!order) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Payment order not found.", 404);
  }

  const adapter =
    options?.adapterOverride ??
    createDefaultPaymentProviderRegistry()[order.provider];

  const remote = await adapter.fetchOrderStatus({
    orderCode: order.orderCode,
    providerOrderId: order.providerOrderId,
  });

  if (
    (remote.currency && remote.currency !== order.currency) ||
    (remote.amount != null && remote.amount !== order.expectedAmount)
  ) {
    throw new PaymentError(
      "RECONCILIATION_MISMATCH",
      `Provider reported ${remote.currency ?? "?"} ${remote.amount ?? "?"}, expected ${order.currency} ${order.expectedAmount}.`,
      422,
    );
  }

  return runCreditTx(async (tx) => {
    const lockRes = await tx.execute(
      sql`SELECT id FROM payment_orders WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`,
    );
    if (!lockRes.rows[0]) {
      throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Payment order not found.", 404);
    }

    const [freshOrder] = await tx
      .select()
      .from(paymentOrders)
      .where(and(eq(paymentOrders.id, id), eq(paymentOrders.userId, userId)));

    return applyVerifiedOrderStateTx(tx, {
      order: freshOrder,
      normalizedStatus: remote.normalizedStatus,
      providerTransactionId: remote.providerTransactionId,
      rawSummary: remote.rawSummary,
      source: "reconciliation",
    });
  });
}

export const refundOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(400),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export async function refundPaymentOrderService(
  userId: string,
  rawInput: z.input<typeof refundOrderInputSchema>,
  options?: { adapterOverride?: PaymentProviderAdapter },
) {
  const input = refundOrderInputSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.id, input.orderId),
        eq(paymentOrders.userId, userId),
      ),
    );

  if (!order) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Payment order not found.", 404);
  }
  if (order.status === "refunded") {
    return order;
  }
  if (order.status !== "paid") {
    throw new PaymentError(
      "REFUND_NOT_ELIGIBLE",
      `Only paid orders can be refunded (current status: '${order.status}').`,
      400,
    );
  }

  const [chargeTx] = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.orderId, order.id),
        eq(paymentTransactions.userId, userId),
        eq(paymentTransactions.status, "succeeded"),
      ),
    );

  const adapter =
    options?.adapterOverride ??
    createDefaultPaymentProviderRegistry()[order.provider];
  const refundIdemp = input.idempotencyKey ?? `refund:${order.id}`;

  const refundResult = await adapter.issueRefund({
    orderCode: order.orderCode,
    providerTransactionId: chargeTx?.providerTransactionId ?? order.providerOrderId,
    amount: order.expectedAmount,
    currency: order.currency,
    reason: input.reason,
    idempotencyKey: refundIdemp,
  });

  return runCreditTx(async (tx) => {
    const [freshOrder] = await tx
      .select()
      .from(paymentOrders)
      .where(
        and(eq(paymentOrders.id, order.id), eq(paymentOrders.userId, userId)),
      );

    return applyOrderRefundTx(tx, freshOrder, {
      providerTransactionId: refundResult.providerRefundId,
      reason: input.reason,
      idempotencyKey: `refund:order:${order.id}`,
      rawSummary: refundResult.rawSummary,
    });
  });
}
