import { and, desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { paymentOrders, paymentTransactions } from "@/db/schema";

export async function listPaymentOrdersForUser(userId: string, limit = 25) {
  const db = await ensureDbReady();
  return db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.userId, userId))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(limit);
}

export async function listPaymentTransactionsForUser(
  userId: string,
  limit = 40,
) {
  const db = await ensureDbReady();
  return db
    .select({
      tx: paymentTransactions,
      orderCode: paymentOrders.orderCode,
      packageKey: paymentOrders.packageKey,
    })
    .from(paymentTransactions)
    .innerJoin(
      paymentOrders,
      eq(paymentTransactions.orderId, paymentOrders.id),
    )
    .where(eq(paymentTransactions.userId, userId))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(limit);
}

export async function getPaymentOrderDetailForUser(
  userId: string,
  orderId: string,
) {
  const db = await ensureDbReady();
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, userId)));
  if (!order) return null;

  const transactions = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.orderId, order.id),
        eq(paymentTransactions.userId, userId),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt));

  return { order, transactions };
}
