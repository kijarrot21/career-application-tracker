"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  ExternalLink,
  History,
  Lock,
  Package,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  PAYMENT_PROVIDER_LABELS,
  type PaymentOrderStatus,
  type PaymentProviderId,
} from "@/lib/domain/payments";
import { formatDate, formatMoney } from "@/lib/format";
import {
  createCheckoutOrderAction,
  reconcilePaymentOrderAction,
} from "@/server/actions/payments";
import type { SanitizedPaymentProviderStatus } from "@/server/payments/providers";
import type { getCreditsDashboardDataForUser } from "@/server/queries/credits";
import type {
  listPaymentOrdersForUser,
  listPaymentTransactionsForUser,
} from "@/server/queries/payments";

type CreditsDashboardData = Awaited<
  ReturnType<typeof getCreditsDashboardDataForUser>
>;
type PaymentOrderRow = Awaited<ReturnType<typeof listPaymentOrdersForUser>>[number];
type PaymentTxRow = Awaited<
  ReturnType<typeof listPaymentTransactionsForUser>
>[number];

function reservationStatusVariant(
  status: string,
): "warning" | "success" | "secondary" | "destructive" {
  switch (status) {
    case "reserved":
      return "warning";
    case "captured":
      return "success";
    case "released":
      return "secondary";
    default:
      return "destructive";
  }
}

function orderStatusBadgeVariant(
  status: PaymentOrderStatus,
): "warning" | "success" | "secondary" | "destructive" {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
    case "requires_action":
      return "warning";
    case "refunded":
      return "secondary";
    default:
      return "destructive";
  }
}

export function CreditsWalletClient({
  data,
  paymentProviders = [],
  paymentOrders = [],
  paymentTransactions = [],
  highlightedOrderCode = null,
}: {
  data: CreditsDashboardData;
  paymentProviders?: SanitizedPaymentProviderStatus[];
  paymentOrders?: PaymentOrderRow[];
  paymentTransactions?: PaymentTxRow[];
  highlightedOrderCode?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { wallet, ledger, reservations, pricing, packages } = data;

  const [selectedPackageKey, setSelectedPackageKey] = useState(
    packages.find((p) => p.isPopular)?.packageKey ??
      packages[0]?.packageKey ??
      "",
  );
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProviderId>("midtrans");

  const activeProviderStatus = paymentProviders.find(
    (p) => p.id === selectedProvider,
  );
  const sandboxReady = Boolean(activeProviderStatus?.configured);
  const highlightedOrder = highlightedOrderCode
    ? paymentOrders.find((o) => o.orderCode === highlightedOrderCode) ?? null
    : null;

  function handleInitiateCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackageKey) return;
    startTransition(async () => {
      try {
        const res = await createCheckoutOrderAction({
          packageKey: selectedPackageKey,
          provider: selectedProvider,
        });
        toast.success(
          `Sandbox checkout order ${res.order.orderCode} created (${res.order.currency} ${res.order.expectedAmount}).`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not initiate checkout",
        );
      }
    });
  }

  function handleReconcileOrder(orderId: string) {
    startTransition(async () => {
      try {
        const updated = await reconcilePaymentOrderAction(orderId);
        toast.success(
          `Order ${updated.orderCode} reconciled: status is '${updated.status}'.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Order reconciliation failed",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-xs">
      <PageHeader
        title="AI Credit Wallet, Billing & Usage Ledger"
        description="Server-authoritative credit balances, active AI task reservations, sandbox checkout orders, transaction history, and configurable task pricing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Server-Authoritative Ledger
            </Badge>
            <Badge variant="secondary">
              Threshold: {wallet.lowBalanceThreshold} credits
            </Badge>
          </div>
        }
      />

      {/* Server-Verified Highlighted Return Order Status (Never trusted from query string alone) */}
      {highlightedOrder && (
        <Card padding="md" className="space-y-2 border-primary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {highlightedOrder.status === "paid" &&
              highlightedOrder.creditsGranted ? (
                <CheckCircle2 className="h-4 w-4 text-success-on-soft" />
              ) : highlightedOrder.status === "failed" ||
                highlightedOrder.status === "expired" ||
                highlightedOrder.status === "disputed" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-warning" />
              )}
              <span className="font-semibold text-foreground">
                Order {highlightedOrder.orderCode} Status (Server-Verified)
              </span>
            </div>
            <Badge variant={orderStatusBadgeVariant(highlightedOrder.status)}>
              {highlightedOrder.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {highlightedOrder.status === "paid" &&
            highlightedOrder.creditsGranted
              ? `Payment verified via server webhook/reconciliation. ${highlightedOrder.creditsToGrant} credits granted.`
              : highlightedOrder.status === "failed" ||
                  highlightedOrder.status === "expired" ||
                  highlightedOrder.status === "disputed"
                ? (highlightedOrder.failureReason ??
                  "Payment did not complete. No credits were granted.")
                : "Awaiting verified server confirmation from the payment gateway webhook."}
          </p>
        </Card>
      )}

      {/* Low Balance Warning Banner */}
      {wallet.isLowBalance && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft p-4 text-warning-on-soft"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Low Credit Balance Warning</p>
              <p>
                Your available balance ({wallet.availableBalance} credits) is at
                or below your threshold ({wallet.lowBalanceThreshold} credits).
              </p>
            </div>
          </div>
          <Badge variant="warning">Top-up below</Badge>
        </div>
      )}

      {/* Wallet KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md" className="space-y-1">
          <p className="text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {wallet.availableBalance}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Ready for AI task reservations
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <p className="text-muted-foreground">Reserved Credits</p>
          <p className="text-2xl font-bold text-warning tabular-nums">
            {wallet.reservedBalance}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {data.activeReservationsCount} active hold(s) in progress
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <p className="text-muted-foreground">Lifetime Spent</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {wallet.lifetimeSpent}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Net captured across completed AI runs
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <p className="text-muted-foreground">Lifetime Granted</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {wallet.lifetimeGranted}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Starter grants, purchases &amp; refunds
          </p>
        </Card>
      </div>

      {/* Credit Packages Selection & Sandbox Checkout Initiation */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary-text" />
            <h2 className="text-section-title text-foreground">
              Select Credit Package &amp; Checkout Gateway
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {paymentProviders.map((prov) => (
              <Badge
                key={prov.id}
                variant={prov.configured ? "success" : "secondary"}
              >
                {prov.id.toUpperCase()} ({prov.currency}):{" "}
                {prov.configured ? "Sandbox Ready" : "Sandbox Disabled"}
              </Badge>
            ))}
          </div>
        </div>

        <form onSubmit={handleInitiateCheckout} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {packages.map((pkg) => {
              const selected = selectedPackageKey === pkg.packageKey;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackageKey(pkg.packageKey)}
                  className={`cursor-pointer rounded-xl border p-4 text-left transition-colors space-y-2 ${
                    selected
                      ? "border-primary bg-primary-soft/25 ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {pkg.name}
                    </span>
                    {pkg.badgeText && (
                      <Badge variant="primary">{pkg.badgeText}</Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {pkg.credits + pkg.bonusCredits} Credits
                  </p>
                  <p className="font-semibold text-primary-text tabular-nums">
                    {formatMoney(pkg.priceIdr, "IDR")}{" "}
                    <span className="font-normal text-muted-foreground">
                      (~USD ${(pkg.priceUsdCents / 100).toFixed(2)})
                    </span>
                  </p>
                  {pkg.description && (
                    <p className="text-muted-foreground">{pkg.description}</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 border-t border-border-subtle pt-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[260px] flex-1">
                <FormField label="Payment Gateway Adapter (Sandbox Only)">
                  <Select
                    selectSize="lg"
                    value={selectedProvider}
                    onChange={(e) =>
                      setSelectedProvider(e.target.value as PaymentProviderId)
                    }
                  >
                    <option value="midtrans">
                      {PAYMENT_PROVIDER_LABELS.midtrans}
                    </option>
                    <option value="stripe">
                      {PAYMENT_PROVIDER_LABELS.stripe}
                    </option>
                  </Select>
                </FormField>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending || !sandboxReady || !selectedPackageKey}
              >
                <CreditCard className="h-3.5 w-3.5" />
                {sandboxReady
                  ? "Create Sandbox Checkout Order"
                  : "Sandbox Payment Gateway Disabled"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Real-money production charges are blocked until explicit owner approval.
            </p>
          </div>
        </form>
      </Card>

      {/* Payment Orders & Verification Status */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary-text" />
          <h2 className="text-section-title text-foreground">
            Payment Orders &amp; Server Confirmation Status
          </h2>
        </div>

        {paymentOrders.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payment orders yet"
            description="Select a package above when sandbox checkout is enabled to create a traceable server order."
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {paymentOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {ord.orderCode}
                    </span>
                    <Badge variant={orderStatusBadgeVariant(ord.status)}>
                      {ord.status}
                    </Badge>
                    <Badge variant="secondary">{ord.provider}</Badge>
                    {ord.creditsGranted && (
                      <Badge variant="success">
                        +{ord.creditsToGrant} credits granted
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground tabular-nums">
                    Package: {ord.packageKey} · Amount:{" "}
                    {ord.currency === "IDR"
                      ? formatMoney(ord.expectedAmount, "IDR")
                      : `USD $${(ord.expectedAmount / 100).toFixed(2)}`}{" "}
                    · Created {formatDate(ord.createdAt)}
                  </p>
                  {ord.failureReason && (
                    <p className="text-destructive">{ord.failureReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {ord.checkoutUrl &&
                    (ord.status === "pending" ||
                      ord.status === "requires_action") && (
                      <Button variant="secondary" size="sm" asChild>
                        <a
                          href={ord.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Sandbox Checkout
                        </a>
                      </Button>
                    )}
                  {sandboxReady &&
                    (ord.status === "pending" ||
                      ord.status === "requires_action") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleReconcileOrder(ord.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Verify Status
                      </Button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Configurable AI Task Pricing & Credit Reservations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary-text" />
            <h2 className="text-section-title text-foreground">
              AI Task Pricing Schedule
            </h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {pricing.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="font-semibold text-foreground">{rule.label}</p>
                  {rule.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {rule.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {rule.creditCost} credit{rule.creditCost === 1 ? "" : "s"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="text-section-title text-foreground">
              Credit Reservation Status
            </h2>
          </div>
          {reservations.length === 0 ? (
            <EmptyState
              icon={Lock}
              title="No credit reservations yet"
              description="Reservations are created atomically before AI tasks run and captured or released automatically."
            />
          ) : (
            <div className="divide-y divide-border-subtle">
              {reservations.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {res.pricingKey}{" "}
                      {res.provider && (
                        <span className="font-mono font-normal text-muted-foreground">
                          ({res.provider})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(res.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {res.amount} cr
                    </span>
                    <Badge variant={reservationStatusVariant(res.status)}>
                      {res.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Gateway Transaction Log */}
      {paymentTransactions.length > 0 && (
        <Card padding="md" className="space-y-3">
          <h2 className="text-section-title text-foreground">
            Payment Gateway Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Order</th>
                  <th className="py-2 pr-3 font-semibold">Provider</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Amount</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {paymentTransactions.map(({ tx, orderCode }) => (
                  <tr key={tx.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono font-semibold text-foreground">
                      {orderCode}
                    </td>
                    <td className="py-2 pr-3">{tx.provider}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{tx.transactionType}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      {tx.currency === "IDR"
                        ? formatMoney(tx.amount, "IDR")
                        : `USD $${(tx.amount / 100).toFixed(2)}`}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={
                          tx.status === "succeeded"
                            ? "success"
                            : tx.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Append-Only Credit Transaction History */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary-text" />
          <h2 className="text-section-title text-foreground">
            Credit Transaction History (Append-Only Ledger)
          </h2>
        </div>

        {ledger.length === 0 ? (
          <EmptyState
            icon={History}
            title="No ledger transactions"
            description="All credit grants, reservations, captures, releases, and refunds appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Available Δ</th>
                  <th className="py-2 pr-3 font-semibold">Reserved Δ</th>
                  <th className="py-2 pr-3 font-semibold">Balance After</th>
                  <th className="py-2 pr-3 font-semibold">Reference</th>
                  <th className="py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{row.entryType}</Badge>
                    </td>
                    <td
                      className={`py-2 pr-3 font-mono font-semibold tabular-nums ${
                        row.deltaAvailable > 0
                          ? "text-success-on-soft"
                          : row.deltaAvailable < 0
                            ? "text-destructive-on-soft"
                            : "text-muted-foreground"
                      }`}
                    >
                      {row.deltaAvailable > 0
                        ? `+${row.deltaAvailable}`
                        : row.deltaAvailable}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-muted-foreground">
                      {row.deltaReserved > 0
                        ? `+${row.deltaReserved}`
                        : row.deltaReserved}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-foreground">
                      {row.balanceAfterAvailable} avail /{" "}
                      {row.balanceAfterReserved} res
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                      {row.referenceType}
                    </td>
                    <td className="py-2 text-foreground">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
