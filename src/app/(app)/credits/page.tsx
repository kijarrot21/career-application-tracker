import { CreditsWalletClient } from "@/components/credits/credits-wallet-client";
import { requireUser } from "@/lib/session";
import { getSanitizedPaymentProviderStatuses } from "@/server/payments/providers";
import { getCreditsDashboardDataForUser } from "@/server/queries/credits";
import {
  listPaymentOrdersForUser,
  listPaymentTransactionsForUser,
} from "@/server/queries/payments";

export const dynamic = "force-dynamic";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await requireUser();
  const [{ order: highlightedOrderCode }, data, orders, transactions] =
    await Promise.all([
      searchParams,
      getCreditsDashboardDataForUser(user.id),
      listPaymentOrdersForUser(user.id, 25),
      listPaymentTransactionsForUser(user.id, 30),
    ]);

  const paymentProviders = getSanitizedPaymentProviderStatuses();

  return (
    <CreditsWalletClient
      data={data}
      paymentProviders={paymentProviders}
      paymentOrders={orders}
      paymentTransactions={transactions}
      highlightedOrderCode={highlightedOrderCode ?? null}
    />
  );
}
