import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady, type AppDb } from "@/db";
import {
  aiCreditPricing,
  creditLedger,
  creditReservations,
  creditWallets,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import type { AiLocality, AiTaskType } from "@/lib/domain/ai";
import {
  DEFAULT_LOW_BALANCE_THRESHOLD,
  DEFAULT_PRICING_KEY_BY_TASK,
  DEFAULT_WELCOME_CREDITS,
  InsufficientCreditsError,
} from "@/lib/domain/credits";
import { env } from "@/lib/env";

type DbOrTx = Pick<
  AppDb,
  "select" | "insert" | "update" | "delete" | "execute"
>;

// PGlite runs over a single WASM connection; serialize overlapping transactions
// only when PGlite is active while relying on SQL FOR UPDATE + CAS in Postgres.
const globalForLock = globalThis as unknown as {
  __pgliteTxTail?: Promise<void>;
};

export async function runCreditTx<T>(fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  const db = await ensureDbReady();
  const isPostgresPool = Boolean(env.DATABASE_URL);
  if (isPostgresPool) {
    return db.transaction(async (tx) => fn(tx as unknown as DbOrTx));
  }

  const previous = globalForLock.__pgliteTxTail ?? Promise.resolve();
  let release!: () => void;
  globalForLock.__pgliteTxTail = new Promise<void>((res) => {
    release = res;
  });

  await previous;
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as DbOrTx));
  } finally {
    release();
  }
}

export interface WalletInitOptions {
  initialCredits?: number;
  currency?: string;
  lowBalanceThreshold?: number;
}

/**
 * Ensures a user's authoritative `credit_wallets` row exists.
 * Idempotently grants initial starter credits via an append-only ledger entry
 * on first wallet creation (respecting optional `initialCredits: 0` for tests).
 */
export async function ensureCreditWalletService(
  userId: string,
  options?: WalletInitOptions,
) {
  return runCreditTx(async (tx) => ensureCreditWalletTx(tx, userId, options));
}

export async function ensureCreditWalletTx(
  tx: DbOrTx,
  userId: string,
  options?: WalletInitOptions,
) {
  const [existing] = await tx
    .select()
    .from(creditWallets)
    .where(eq(creditWallets.userId, userId));

  if (existing) return existing;

  const grantAmount = Math.max(
    0,
    Math.floor(options?.initialCredits ?? DEFAULT_WELCOME_CREDITS),
  );
  const threshold = Math.max(
    0,
    Math.floor(options?.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD),
  );

  await tx
    .insert(creditWallets)
    .values({
      userId,
      availableBalance: grantAmount,
      reservedBalance: 0,
      lifetimeGranted: grantAmount,
      lifetimeSpent: 0,
      currency: options?.currency ?? "IDR",
      lowBalanceThreshold: threshold,
      version: 1,
    })
    .onConflictDoNothing();

  const [wallet] = await tx
    .select()
    .from(creditWallets)
    .where(eq(creditWallets.userId, userId));

  if (grantAmount > 0) {
    const idemp = `welcome:${userId}`;
    const [existingLedger] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.idempotencyKey, idemp),
        ),
      );

    if (!existingLedger) {
      await tx.insert(creditLedger).values({
        userId,
        walletId: wallet.id,
        entryType: "grant",
        deltaAvailable: grantAmount,
        deltaReserved: 0,
        balanceAfterAvailable: wallet.availableBalance,
        balanceAfterReserved: wallet.reservedBalance,
        referenceType: "wallet_welcome_grant",
        referenceId: wallet.id,
        idempotencyKey: idemp,
        reason: "Initial workspace welcome credits",
      });

      await writeAudit(tx, {
        userId,
        entityType: "credit_wallet",
        entityId: wallet.id,
        action: "create",
        summary: `Initialized credit wallet with ${grantAmount} starter credit(s)`,
      });
    }
  }

  return wallet;
}

export async function resolveAiTaskPricingService(params: {
  pricingKey?: string;
  taskType: AiTaskType;
  locality?: AiLocality;
}) {
  const db = await ensureDbReady();
  const key = params.pricingKey ?? DEFAULT_PRICING_KEY_BY_TASK[params.taskType];

  const [exact] = await db
    .select()
    .from(aiCreditPricing)
    .where(
      and(
        eq(aiCreditPricing.pricingKey, key),
        eq(aiCreditPricing.isActive, true),
      ),
    );

  const row =
    exact ??
    (
      await db
        .select()
        .from(aiCreditPricing)
        .where(
          and(
            eq(aiCreditPricing.taskType, params.taskType),
            eq(aiCreditPricing.isActive, true),
          ),
        )
        .orderBy(asc(aiCreditPricing.sortOrder))
        .limit(1)
    )[0];

  if (!row) {
    return {
      pricingKey: key,
      taskType: params.taskType,
      label: params.taskType,
      configuredCost: 0,
      effectiveCost: 0,
      chargeLocalRuns: true,
    };
  }

  const effectiveCost =
    params.locality === "local" && !row.chargeLocalRuns ? 0 : row.creditCost;

  return {
    pricingKey: row.pricingKey,
    taskType: row.taskType,
    label: row.label,
    configuredCost: row.creditCost,
    effectiveCost,
    chargeLocalRuns: row.chargeLocalRuns,
  };
}

export const reserveCreditsInputSchema = z.object({
  pricingKey: z.string().trim().min(1).max(100),
  taskType: z.enum([
    "cv_parse",
    "cv_evaluate",
    "job_match",
    "cv_correction",
    "cv_generate",
    "skill_gap",
    "career_roadmap",
    "interview_coach",
  ]),
  amount: z.number().int().min(0).max(10000),
  idempotencyKey: z.string().trim().min(1).max(200),
  jobId: z.string().uuid().optional().nullable(),
  provider: z.enum(["ollama", "openai", "gemini"]).optional().nullable(),
  locality: z.enum(["local", "cloud"]).optional().nullable(),
  ttlMinutes: z.number().int().min(1).max(1440).default(60),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validates available balance under row lock (`FOR UPDATE`) and optimistic CAS,
 * atomically moves credits from `availableBalance` -> `reservedBalance`, and appends
 * an immutable `reserve` entry to `credit_ledger`.
 */
export async function reserveCreditsForAiTaskService(
  userId: string,
  rawInput: z.input<typeof reserveCreditsInputSchema>,
) {
  const input = reserveCreditsInputSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const wallet = await ensureCreditWalletTx(tx, userId);

    // 1. Idempotency check
    const [existingRes] = await tx
      .select()
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.userId, userId),
          eq(creditReservations.idempotencyKey, input.idempotencyKey),
        ),
      );

    if (existingRes) {
      return {
        reservation: existingRes,
        wallet,
        deduplicated: true,
      };
    }

    if (input.amount === 0) {
      return {
        reservation: null,
        wallet,
        deduplicated: false,
      };
    }

    // 2. Row-level pessimistic lock (PostgreSQL FOR UPDATE)
    const lockResult = await tx.execute(
      sql`SELECT id, available_balance, reserved_balance, version FROM credit_wallets WHERE user_id = ${userId} FOR UPDATE`,
    );
    const lockedRow = (lockResult.rows[0] ?? {
      available_balance: wallet.availableBalance,
      reserved_balance: wallet.reservedBalance,
      version: wallet.version,
    }) as {
      available_balance: number;
      reserved_balance: number;
      version: number;
    };

    if (lockedRow.available_balance < input.amount) {
      throw new InsufficientCreditsError({
        requiredCredits: input.amount,
        availableCredits: lockedRow.available_balance,
        pricingKey: input.pricingKey,
      });
    }

    const now = new Date();
    const [updatedWallet] = await tx
      .update(creditWallets)
      .set({
        availableBalance: sql`${creditWallets.availableBalance} - ${input.amount}`,
        reservedBalance: sql`${creditWallets.reservedBalance} + ${input.amount}`,
        version: sql`${creditWallets.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditWallets.userId, userId),
          sql`${creditWallets.availableBalance} >= ${input.amount}`,
          eq(creditWallets.version, lockedRow.version),
        ),
      )
      .returning();

    if (!updatedWallet) {
      throw new InsufficientCreditsError({
        requiredCredits: input.amount,
        availableCredits: lockedRow.available_balance,
        pricingKey: input.pricingKey,
      });
    }

    const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000);
    const [reservation] = await tx
      .insert(creditReservations)
      .values({
        userId,
        walletId: updatedWallet.id,
        jobId: input.jobId ?? null,
        pricingKey: input.pricingKey,
        taskType: input.taskType,
        provider: input.provider ?? null,
        locality: input.locality ?? null,
        amount: input.amount,
        status: "reserved",
        idempotencyKey: input.idempotencyKey,
        expiresAt,
        metadata: input.metadata ?? null,
      })
      .returning();

    await tx.insert(creditLedger).values({
      userId,
      walletId: updatedWallet.id,
      reservationId: reservation.id,
      jobId: input.jobId ?? null,
      entryType: "reserve",
      deltaAvailable: -input.amount,
      deltaReserved: input.amount,
      balanceAfterAvailable: updatedWallet.availableBalance,
      balanceAfterReserved: updatedWallet.reservedBalance,
      referenceType: "ai_job",
      referenceId: input.jobId ?? reservation.id,
      idempotencyKey: `reserve:${input.idempotencyKey}`,
      reason: `Reserved ${input.amount} credit(s) for ${input.pricingKey}`,
      metadata: {
        provider: input.provider ?? null,
        locality: input.locality ?? null,
      },
    });

    await writeAudit(tx, {
      userId,
      entityType: "credit_reservation",
      entityId: reservation.id,
      action: "create",
      summary: `Reserved ${input.amount} credit(s) for ${input.pricingKey}`,
    });

    return {
      reservation,
      wallet: updatedWallet,
      deduplicated: false,
    };
  });
}

/**
 * Captures a pending reservation upon successful AI execution: clears `reservedBalance`,
 * increments `lifetimeSpent`, marks reservation `captured`, and appends a `capture` ledger entry.
 */
export async function captureCreditReservationService(
  userId: string,
  reservationId: string,
  options?: {
    jobId?: string | null;
    usageMetadata?: Record<string, unknown> | null;
  },
) {
  const id = z.string().uuid().parse(reservationId);

  return runCreditTx(async (tx) => {
    const lockRes = await tx.execute(
      sql`SELECT id, wallet_id, job_id, amount, status, pricing_key, metadata FROM credit_reservations WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`,
    );
    const row = lockRes.rows[0] as
      | {
          id: string;
          wallet_id: string;
          job_id: string | null;
          amount: number;
          status: string;
          pricing_key: string;
          metadata: Record<string, unknown> | null;
        }
      | undefined;

    if (!row) {
      throw new Error("Credit reservation not found.");
    }
    if (row.status === "captured") {
      const [existing] = await tx
        .select()
        .from(creditReservations)
        .where(eq(creditReservations.id, id));
      return { reservation: existing, deduplicated: true };
    }
    if (row.status !== "reserved") {
      throw new Error(
        `Cannot capture credit reservation from status '${row.status}'.`,
      );
    }

    await tx.execute(
      sql`SELECT id FROM credit_wallets WHERE id = ${row.wallet_id} AND user_id = ${userId} FOR UPDATE`,
    );

    const now = new Date();
    const [updatedWallet] = await tx
      .update(creditWallets)
      .set({
        reservedBalance: sql`${creditWallets.reservedBalance} - ${row.amount}`,
        lifetimeSpent: sql`${creditWallets.lifetimeSpent} + ${row.amount}`,
        version: sql`${creditWallets.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditWallets.id, row.wallet_id),
          eq(creditWallets.userId, userId),
          sql`${creditWallets.reservedBalance} >= ${row.amount}`,
        ),
      )
      .returning();

    if (!updatedWallet) {
      throw new Error("Reserved credit balance underflow during capture.");
    }

    const effectiveJobId = options?.jobId ?? row.job_id ?? null;
    const [updatedReservation] = await tx
      .update(creditReservations)
      .set({
        status: "captured",
        jobId: effectiveJobId,
        settledAt: now,
        updatedAt: now,
        metadata: options?.usageMetadata
          ? { ...(row.metadata ?? {}), usage: options.usageMetadata }
          : row.metadata,
      })
      .where(
        and(
          eq(creditReservations.id, id),
          eq(creditReservations.userId, userId),
        ),
      )
      .returning();

    await tx.insert(creditLedger).values({
      userId,
      walletId: updatedWallet.id,
      reservationId: updatedReservation.id,
      jobId: effectiveJobId,
      entryType: "capture",
      deltaAvailable: 0,
      deltaReserved: -row.amount,
      balanceAfterAvailable: updatedWallet.availableBalance,
      balanceAfterReserved: updatedWallet.reservedBalance,
      referenceType: "ai_job",
      referenceId: effectiveJobId ?? updatedReservation.id,
      idempotencyKey: `capture:${updatedReservation.id}`,
      reason: `Captured ${row.amount} credit(s) after successful ${row.pricing_key}`,
      metadata: options?.usageMetadata ?? null,
    });

    await writeAudit(tx, {
      userId,
      entityType: "credit_reservation",
      entityId: updatedReservation.id,
      action: "update",
      summary: `Captured ${row.amount} credit(s) for ${row.pricing_key}`,
    });

    return {
      reservation: updatedReservation,
      wallet: updatedWallet,
      deduplicated: false,
    };
  });
}

/**
 * Releases a pending credit reservation on AI failure or cancellation,
 * returning reserved credits back into `availableBalance` atomically.
 */
export async function releaseCreditReservationService(
  userId: string,
  reservationId: string,
  options?: { jobId?: string | null; reason?: string },
) {
  const id = z.string().uuid().parse(reservationId);

  return runCreditTx(async (tx) => {
    const lockRes = await tx.execute(
      sql`SELECT id, wallet_id, job_id, amount, status, pricing_key FROM credit_reservations WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`,
    );
    const row = lockRes.rows[0] as
      | {
          id: string;
          wallet_id: string;
          job_id: string | null;
          amount: number;
          status: string;
          pricing_key: string;
        }
      | undefined;

    if (!row) {
      throw new Error("Credit reservation not found.");
    }
    if (row.status === "released") {
      const [existing] = await tx
        .select()
        .from(creditReservations)
        .where(eq(creditReservations.id, id));
      return { reservation: existing, deduplicated: true };
    }
    if (row.status !== "reserved") {
      throw new Error(
        `Cannot release credit reservation from status '${row.status}'.`,
      );
    }

    await tx.execute(
      sql`SELECT id FROM credit_wallets WHERE id = ${row.wallet_id} AND user_id = ${userId} FOR UPDATE`,
    );

    const now = new Date();
    const [updatedWallet] = await tx
      .update(creditWallets)
      .set({
        availableBalance: sql`${creditWallets.availableBalance} + ${row.amount}`,
        reservedBalance: sql`${creditWallets.reservedBalance} - ${row.amount}`,
        version: sql`${creditWallets.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditWallets.id, row.wallet_id),
          eq(creditWallets.userId, userId),
          sql`${creditWallets.reservedBalance} >= ${row.amount}`,
        ),
      )
      .returning();

    if (!updatedWallet) {
      throw new Error("Reserved credit balance underflow during release.");
    }

    const effectiveJobId = options?.jobId ?? row.job_id ?? null;
    const [updatedReservation] = await tx
      .update(creditReservations)
      .set({
        status: "released",
        jobId: effectiveJobId,
        settledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditReservations.id, id),
          eq(creditReservations.userId, userId),
        ),
      )
      .returning();

    await tx.insert(creditLedger).values({
      userId,
      walletId: updatedWallet.id,
      reservationId: updatedReservation.id,
      jobId: effectiveJobId,
      entryType: "release",
      deltaAvailable: row.amount,
      deltaReserved: -row.amount,
      balanceAfterAvailable: updatedWallet.availableBalance,
      balanceAfterReserved: updatedWallet.reservedBalance,
      referenceType: "ai_job",
      referenceId: effectiveJobId ?? updatedReservation.id,
      idempotencyKey: `release:${updatedReservation.id}`,
      reason:
        options?.reason ??
        `Released ${row.amount} reserved credit(s) after ${row.pricing_key} did not complete`,
    });

    await writeAudit(tx, {
      userId,
      entityType: "credit_reservation",
      entityId: updatedReservation.id,
      action: "update",
      summary: `Released ${row.amount} reserved credit(s) for ${row.pricing_key}`,
    });

    return {
      reservation: updatedReservation,
      wallet: updatedWallet,
      deduplicated: false,
    };
  });
}

export const refundCreditSchema = z.object({
  amount: z.number().int().positive().max(100_000),
  referenceId: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(1).max(200),
  jobId: z.string().uuid().optional().nullable(),
});

export async function refundCreditTransactionService(
  userId: string,
  rawInput: z.input<typeof refundCreditSchema>,
) {
  const input = refundCreditSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const wallet = await ensureCreditWalletTx(tx, userId);

    const [existing] = await tx
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      return { ledgerEntry: existing, wallet, deduplicated: true };
    }

    await tx.execute(
      sql`SELECT id FROM credit_wallets WHERE id = ${wallet.id} AND user_id = ${userId} FOR UPDATE`,
    );

    const [updatedWallet] = await tx
      .update(creditWallets)
      .set({
        availableBalance: sql`${creditWallets.availableBalance} + ${input.amount}`,
        lifetimeSpent: sql`greatest(0, ${creditWallets.lifetimeSpent} - ${input.amount})`,
        version: sql`${creditWallets.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(creditWallets.id, wallet.id), eq(creditWallets.userId, userId)),
      )
      .returning();

    const [entry] = await tx
      .insert(creditLedger)
      .values({
        userId,
        walletId: updatedWallet.id,
        jobId: input.jobId ?? null,
        entryType: "refund",
        deltaAvailable: input.amount,
        deltaReserved: 0,
        balanceAfterAvailable: updatedWallet.availableBalance,
        balanceAfterReserved: updatedWallet.reservedBalance,
        referenceType: "refund",
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
      })
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "credit_ledger",
      entityId: entry.id,
      action: "create",
      summary: `Refunded ${input.amount} credit(s): ${input.reason}`,
    });

    return { ledgerEntry: entry, wallet: updatedWallet, deduplicated: false };
  });
}

export const adjustCreditSchema = z.object({
  deltaAmount: z
    .number()
    .int()
    .refine((v) => v !== 0, "Adjustment delta cannot be zero."),
  referenceType: z.string().trim().min(1).max(80).default("manual_adjustment"),
  referenceId: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(1).max(200),
});

export async function adjustCreditBalanceService(
  userId: string,
  rawInput: z.input<typeof adjustCreditSchema>,
) {
  const input = adjustCreditSchema.parse(rawInput);

  return runCreditTx(async (tx) => {
    const wallet = await ensureCreditWalletTx(tx, userId);

    const [existing] = await tx
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      return { ledgerEntry: existing, wallet, deduplicated: true };
    }

    const lockRes = await tx.execute(
      sql`SELECT available_balance FROM credit_wallets WHERE id = ${wallet.id} AND user_id = ${userId} FOR UPDATE`,
    );
    const currentAvail =
      (lockRes.rows[0] as { available_balance: number } | undefined)
        ?.available_balance ?? wallet.availableBalance;

    if (currentAvail + input.deltaAmount < 0) {
      throw new InsufficientCreditsError({
        requiredCredits: Math.abs(input.deltaAmount),
        availableCredits: currentAvail,
        pricingKey: input.referenceType,
      });
    }

    const grantedDelta = Math.max(0, input.deltaAmount);
    const [updatedWallet] = await tx
      .update(creditWallets)
      .set({
        availableBalance: sql`${creditWallets.availableBalance} + ${input.deltaAmount}`,
        lifetimeGranted: sql`${creditWallets.lifetimeGranted} + ${grantedDelta}`,
        version: sql`${creditWallets.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(creditWallets.id, wallet.id),
          eq(creditWallets.userId, userId),
          sql`${creditWallets.availableBalance} + ${input.deltaAmount} >= 0`,
        ),
      )
      .returning();

    const [entry] = await tx
      .insert(creditLedger)
      .values({
        userId,
        walletId: updatedWallet.id,
        entryType: input.deltaAmount > 0 ? "grant" : "adjustment",
        deltaAvailable: input.deltaAmount,
        deltaReserved: 0,
        balanceAfterAvailable: updatedWallet.availableBalance,
        balanceAfterReserved: updatedWallet.reservedBalance,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
      })
      .returning();

    await writeAudit(tx, {
      userId,
      entityType: "credit_ledger",
      entityId: entry.id,
      action: "create",
      summary: `Adjusted balance by ${input.deltaAmount} credit(s): ${input.reason}`,
    });

    return { ledgerEntry: entry, wallet: updatedWallet, deduplicated: false };
  });
}

/**
 * Verifies that `credit_wallets` balances match the exact algebraic sum
 * of all append-only `credit_ledger` entries for the user.
 */
export async function verifyWalletLedgerIntegrityService(userId: string) {
  const db = await ensureDbReady();
  const wallet = await ensureCreditWalletService(userId);

  const entries = await db
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.walletId, wallet.id),
      ),
    )
    .orderBy(asc(creditLedger.createdAt));

  let ledgerAvailable = 0;
  let ledgerReserved = 0;
  for (const e of entries) {
    ledgerAvailable += e.deltaAvailable;
    ledgerReserved += e.deltaReserved;
  }

  return {
    valid:
      ledgerAvailable === wallet.availableBalance &&
      ledgerReserved === wallet.reservedBalance,
    walletAvailable: wallet.availableBalance,
    ledgerAvailable,
    walletReserved: wallet.reservedBalance,
    ledgerReserved,
    entryCount: entries.length,
  };
}

export const updateAiPricingSchema = z.object({
  pricingKey: z.string().trim().min(1).max(100),
  creditCost: z.number().int().min(0).max(1000),
  chargeLocalRuns: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function updateAiTaskPricingService(
  rawInput: z.input<typeof updateAiPricingSchema>,
) {
  const input = updateAiPricingSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(aiCreditPricing)
    .set({
      creditCost: input.creditCost,
      ...(input.chargeLocalRuns !== undefined
        ? { chargeLocalRuns: input.chargeLocalRuns }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(aiCreditPricing.pricingKey, input.pricingKey))
    .returning();

  if (!updated) {
    throw new Error(`AI pricing rule '${input.pricingKey}' not found.`);
  }
  return updated;
}
