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
import { timestamps, userId } from "./core";
import {
  aiLocalityEnum,
  aiProviderEnum,
  aiTaskTypeEnum,
  creditLedgerEntryTypeEnum,
  creditReservationStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// 1. Credit Wallets (1:1 server-authoritative balance per user)
// ---------------------------------------------------------------------------
export const creditWallets = pgTable(
  "credit_wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    availableBalance: integer("available_balance").notNull().default(0),
    reservedBalance: integer("reserved_balance").notNull().default(0),
    lifetimeGranted: integer("lifetime_granted").notNull().default(0),
    lifetimeSpent: integer("lifetime_spent").notNull().default(0),
    currency: text("currency").notNull().default("IDR"),
    lowBalanceThreshold: integer("low_balance_threshold")
      .notNull()
      .default(10),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    unique("credit_wallets_id_user_uq").on(t.id, t.userId),
    uniqueIndex("credit_wallets_user_uq").on(t.userId),
    check(
      "credit_wallets_available_nonneg_ck",
      sql`${t.availableBalance} >= 0`,
    ),
    check("credit_wallets_reserved_nonneg_ck", sql`${t.reservedBalance} >= 0`),
    check("credit_wallets_version_pos_ck", sql`${t.version} >= 1`),
  ],
);

// ---------------------------------------------------------------------------
// 2. Credit Reservations (Atomic hold -> capture on success / release on fail)
// ---------------------------------------------------------------------------
export const creditReservations = pgTable(
  "credit_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    walletId: uuid("wallet_id").notNull(),
    jobId: uuid("job_id"),
    pricingKey: text("pricing_key").notNull(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    provider: aiProviderEnum("provider"),
    locality: aiLocalityEnum("locality"),
    amount: integer("amount").notNull(),
    status: creditReservationStatusEnum("status")
      .notNull()
      .default("reserved"),
    idempotencyKey: text("idempotency_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (t) => [
    unique("credit_reservations_id_user_uq").on(t.id, t.userId),
    uniqueIndex("credit_reservations_user_idemp_uq").on(
      t.userId,
      t.idempotencyKey,
    ),
    foreignKey({
      name: "credit_reservations_wallet_fk",
      columns: [t.walletId, t.userId],
      foreignColumns: [creditWallets.id, creditWallets.userId],
    }).onDelete("cascade"),
    index("credit_reservations_user_status_idx").on(
      t.userId,
      t.status,
      t.createdAt,
    ),
    index("credit_reservations_job_idx").on(t.jobId),
    check("credit_reservations_amount_pos_ck", sql`${t.amount} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// 3. Append-Only Credit Ledger (Immutable financial/usage audit trail)
// ---------------------------------------------------------------------------
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    walletId: uuid("wallet_id").notNull(),
    reservationId: uuid("reservation_id"),
    jobId: uuid("job_id"),
    entryType: creditLedgerEntryTypeEnum("entry_type").notNull(),
    deltaAvailable: integer("delta_available").notNull(),
    deltaReserved: integer("delta_reserved").notNull().default(0),
    balanceAfterAvailable: integer("balance_after_available").notNull(),
    balanceAfterReserved: integer("balance_after_reserved").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_ledger_user_idemp_uq").on(t.userId, t.idempotencyKey),
    foreignKey({
      name: "credit_ledger_wallet_fk",
      columns: [t.walletId, t.userId],
      foreignColumns: [creditWallets.id, creditWallets.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "credit_ledger_reservation_fk",
      columns: [t.reservationId, t.userId],
      foreignColumns: [creditReservations.id, creditReservations.userId],
    }).onDelete("set null"),
    index("credit_ledger_user_created_idx").on(t.userId, t.createdAt),
    index("credit_ledger_wallet_created_idx").on(t.walletId, t.createdAt),
    check(
      "credit_ledger_balance_nonneg_ck",
      sql`${t.balanceAfterAvailable} >= 0 and ${t.balanceAfterReserved} >= 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4. Credit Packages (Presentation & future IDR/USD billing catalog)
// ---------------------------------------------------------------------------
export const creditPackages = pgTable(
  "credit_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageKey: text("package_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    credits: integer("credits").notNull(),
    bonusCredits: integer("bonus_credits").notNull().default(0),
    priceIdr: bigint("price_idr", { mode: "number" }).notNull(),
    priceUsdCents: integer("price_usd_cents").notNull(),
    badgeText: text("badge_text"),
    isPopular: boolean("is_popular").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("credit_packages_key_uq").on(t.packageKey),
    check("credit_packages_credits_pos_ck", sql`${t.credits} > 0`),
    check("credit_packages_bonus_nonneg_ck", sql`${t.bonusCredits} >= 0`),
    check("credit_packages_price_nonneg_ck", sql`${t.priceIdr} >= 0 and ${t.priceUsdCents} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// 5. Configurable AI Task Pricing (Database-driven task cost schedule)
// ---------------------------------------------------------------------------
export const aiCreditPricing = pgTable(
  "ai_credit_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricingKey: text("pricing_key").notNull(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    creditCost: integer("credit_cost").notNull(),
    chargeLocalRuns: boolean("charge_local_runs").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("ai_credit_pricing_key_uq").on(t.pricingKey),
    index("ai_credit_pricing_task_idx").on(t.taskType, t.isActive),
    check("ai_credit_pricing_cost_nonneg_ck", sql`${t.creditCost} >= 0`),
  ],
);
