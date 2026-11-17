import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps, userId } from "./core";
import { creditPackages } from "./credits";
import {
  paymentEnvironmentEnum,
  paymentOrderStatusEnum,
  paymentProviderEnum,
  paymentTransactionStatusEnum,
  paymentTransactionTypeEnum,
  webhookProcessingStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// 1. Payment Orders (Server-authoritative checkout order per package purchase)
// ---------------------------------------------------------------------------
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    orderCode: text("order_code").notNull(),
    packageId: uuid("package_id").references(() => creditPackages.id, {
      onDelete: "set null",
    }),
    packageKey: text("package_key").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    environment: paymentEnvironmentEnum("environment")
      .notNull()
      .default("sandbox"),
    currency: text("currency").notNull(),
    expectedAmount: bigint("expected_amount", { mode: "number" }).notNull(),
    creditsToGrant: integer("credits_to_grant").notNull(),
    status: paymentOrderStatusEnum("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    providerOrderId: text("provider_order_id"),
    checkoutUrl: text("checkout_url"),
    creditsGranted: boolean("credits_granted").notNull().default(false),
    creditLedgerId: uuid("credit_ledger_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (t) => [
    unique("payment_orders_id_user_uq").on(t.id, t.userId),
    uniqueIndex("payment_orders_code_uq").on(t.orderCode),
    uniqueIndex("payment_orders_user_idemp_uq").on(t.userId, t.idempotencyKey),
    uniqueIndex("payment_orders_provider_ref_uq")
      .on(t.provider, t.providerOrderId)
      .where(sql`provider_order_id is not null`),
    index("payment_orders_user_status_idx").on(
      t.userId,
      t.status,
      t.createdAt,
    ),
    check(
      "payment_orders_positive_ck",
      sql`${t.expectedAmount} > 0 and ${t.creditsToGrant} > 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 2. Payment Transactions (Provider charge / capture / refund / reconciliation)
// ---------------------------------------------------------------------------
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    orderId: uuid("order_id").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    transactionType: paymentTransactionTypeEnum("transaction_type").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    status: paymentTransactionStatusEnum("status").notNull(),
    rawSummary: jsonb("raw_summary").$type<Record<string, unknown> | null>(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "payment_transactions_order_fk",
      columns: [t.orderId, t.userId],
      foreignColumns: [paymentOrders.id, paymentOrders.userId],
    }).onDelete("cascade"),
    uniqueIndex("payment_tx_provider_tx_type_uq")
      .on(t.provider, t.providerTransactionId, t.transactionType)
      .where(sql`provider_transaction_id is not null`),
    index("payment_tx_user_order_idx").on(t.userId, t.orderId, t.createdAt),
    check("payment_tx_amount_nonneg_ck", sql`${t.amount} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// 3. Payment Webhook Events (Signature verification, replay & idempotency audit)
// ---------------------------------------------------------------------------
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: paymentProviderEnum("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    orderId: uuid("order_id").references(() => paymentOrders.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    signatureValid: boolean("signature_valid").notNull(),
    payloadHash: text("payload_hash").notNull(),
    eventTimestamp: timestamp("event_timestamp", { withTimezone: true }),
    processingStatus:
      webhookProcessingStatusEnum("processing_status").notNull(),
    errorMessage: text("error_message"),
    payloadSummary: jsonb("payload_summary").$type<Record<
      string,
      unknown
    > | null>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payment_webhooks_provider_event_uq").on(
      t.provider,
      t.externalEventId,
    ),
    index("payment_webhooks_status_idx").on(
      t.provider,
      t.processingStatus,
      t.receivedAt,
    ),
    index("payment_webhooks_order_idx").on(t.orderId),
  ],
);
