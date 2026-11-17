import type { PaymentProviderId } from "@/lib/domain/payments";
import { env } from "@/lib/env";
import { MidtransSandboxProvider } from "./midtrans.provider";
import type {
  PaymentFetchLike,
  PaymentProviderAdapter,
} from "./payment-provider.types";
import { StripeSandboxProvider } from "./stripe.provider";

export * from "./payment-provider.types";
export { MidtransSandboxProvider } from "./midtrans.provider";
export { StripeSandboxProvider } from "./stripe.provider";

export type PaymentProviderRegistry = Record<
  PaymentProviderId,
  PaymentProviderAdapter
>;

export function createDefaultPaymentProviderRegistry(options?: {
  fetchFn?: PaymentFetchLike;
}): PaymentProviderRegistry {
  return {
    midtrans: new MidtransSandboxProvider({ fetchFn: options?.fetchFn }),
    stripe: new StripeSandboxProvider({ fetchFn: options?.fetchFn }),
  };
}

export interface SanitizedPaymentProviderStatus {
  id: PaymentProviderId;
  name: string;
  currency: "IDR" | "USD";
  configured: boolean;
  environment: "disabled" | "sandbox";
}

/**
 * Returns non-secret provider readiness for `/credits` UI.
 */
export function getSanitizedPaymentProviderStatuses(
  registry: PaymentProviderRegistry = createDefaultPaymentProviderRegistry(),
): SanitizedPaymentProviderStatus[] {
  return (["midtrans", "stripe"] as const).map((id) => {
    const adapter = registry[id];
    return {
      id: adapter.id,
      name: adapter.name,
      currency: adapter.supportedCurrencies[0],
      configured: adapter.isConfigured(),
      environment: env.PAYMENT_MODE,
    };
  });
}
