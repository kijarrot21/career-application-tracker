import { Coins, CreditCard } from "lucide-react";
import { CreditsWalletClient } from "@/components/credits/credits-wallet-client";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import {
  getFeatureAvailability,
  isFeatureEnabled,
} from "@/lib/domain/feature-availability";
import {
  getLocalizedFeatureStatusLabel,
  getMessages,
  normalizeLocale,
} from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { getSanitizedPaymentProviderStatuses } from "@/server/payments/providers";
import { getUserSettings } from "@/server/queries/settings";
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
  // Preserve the existing authorization boundary before any availability branch.
  const user = await requireUser();

  // Dormant route: keep the implementation below intact for a future enabled
  // state, but never render operational wallet/payment UI or fetch its data.
  if (!isFeatureEnabled("creditWallet")) {
    const settings = await getUserSettings(user.id);
    const locale = normalizeLocale(settings.preferredLocale);
    const catalog = getMessages(locale).featureAvailability;
    const creditAvailability = getFeatureAvailability("creditWallet");
    const paymentAvailability = getFeatureAvailability("payments");
    const creditStatusLabel = getLocalizedFeatureStatusLabel(
      creditAvailability.status,
      locale,
    );
    const paymentStatusLabel = getLocalizedFeatureStatusLabel(
      paymentAvailability.status,
      locale,
    );

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={catalog.creditWallet.title}
          description={catalog.disabledNavHint}
          badge={
            <StatusBadge
              label={creditStatusLabel}
              tone={creditAvailability.tone}
            />
          }
        />

        <Card padding="lg" className="space-y-5">
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <Coins className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-section-title text-foreground">
                  {catalog.features.creditWallet}
                </h2>
                <StatusBadge
                  label={creditStatusLabel}
                  tone={creditAvailability.tone}
                />
              </div>
              <p className="text-body-sm text-muted-foreground">
                {catalog.creditWallet.message}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-section-title text-foreground">
                  {catalog.features.payments}
                </h2>
                <StatusBadge
                  label={paymentStatusLabel}
                  tone={paymentAvailability.tone}
                />
              </div>
              <p className="text-body-sm text-muted-foreground">
                {catalog.paymentsBilling.message}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
