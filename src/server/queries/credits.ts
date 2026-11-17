import { and, asc, count, desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  aiCreditPricing,
  creditLedger,
  creditPackages,
  creditReservations,
} from "@/db/schema";
import { buildPaginationMeta } from "@/lib/api/v1";
import type { CreditLedgerEntryType } from "@/lib/domain/credits";
import { ensureCreditWalletService } from "@/server/services/credits";

export async function getWalletSummaryForUser(userId: string) {
  const wallet = await ensureCreditWalletService(userId);
  return {
    ...wallet,
    isLowBalance: wallet.availableBalance <= wallet.lowBalanceThreshold,
  };
}

export async function listCreditLedgerForUser(userId: string, limit = 50) {
  const db = await ensureDbReady();
  await ensureCreditWalletService(userId);
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}

export async function listCreditReservationsForUser(
  userId: string,
  limit = 30,
) {
  const db = await ensureDbReady();
  await ensureCreditWalletService(userId);
  return db
    .select()
    .from(creditReservations)
    .where(eq(creditReservations.userId, userId))
    .orderBy(desc(creditReservations.createdAt))
    .limit(limit);
}

export async function listAiCreditPricing() {
  const db = await ensureDbReady();
  return db
    .select()
    .from(aiCreditPricing)
    .where(eq(aiCreditPricing.isActive, true))
    .orderBy(asc(aiCreditPricing.sortOrder), asc(aiCreditPricing.label));
}

export async function listCreditPackages() {
  const db = await ensureDbReady();
  return db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.isActive, true))
    .orderBy(asc(creditPackages.sortOrder));
}

export async function getCreditsDashboardDataForUser(userId: string) {
  const [wallet, ledger, reservations, pricing, packages] = await Promise.all([
    getWalletSummaryForUser(userId),
    listCreditLedgerForUser(userId, 50),
    listCreditReservationsForUser(userId, 25),
    listAiCreditPricing(),
    listCreditPackages(),
  ]);

  return {
    wallet,
    ledger,
    reservations,
    pricing,
    packages,
    activeReservationsCount: reservations.filter(
      (r) => r.status === "reserved",
    ).length,
    paymentsEnabled: false,
  };
}

export async function getCreditReservationForUser(
  userId: string,
  reservationId: string,
) {
  const db = await ensureDbReady();
  const [row] = await db
    .select()
    .from(creditReservations)
    .where(
      and(
        eq(creditReservations.id, reservationId),
        eq(creditReservations.userId, userId),
      ),
    );
  return row ?? null;
}

export async function listCreditLedgerPaginatedForUser(
  userId: string,
  options: {
    page?: number;
    pageSize?: number;
    entryType?: CreditLedgerEntryType;
  } = {},
) {
  const db = await ensureDbReady();
  await ensureCreditWalletService(userId);

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const condition = options.entryType
    ? and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.entryType, options.entryType),
      )
    : eq(creditLedger.userId, userId);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(creditLedger)
      .where(condition)
      .orderBy(desc(creditLedger.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(creditLedger).where(condition),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  return {
    items,
    pagination: buildPaginationMeta(total, page, pageSize),
  };
}

export async function listCreditPackagesPaginated(
  options: { page?: number; pageSize?: number } = {},
) {
  const db = await ensureDbReady();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const condition = eq(creditPackages.isActive, true);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(creditPackages)
      .where(condition)
      .orderBy(asc(creditPackages.sortOrder))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(creditPackages).where(condition),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  return {
    items,
    pagination: buildPaginationMeta(total, page, pageSize),
  };
}
