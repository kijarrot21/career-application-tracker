import { timingSafeEqual } from "node:crypto";
import type {
  NormalizedPaymentEventStatus,
  PaymentProviderId,
} from "@/lib/domain/payments";

export type PaymentFetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface PaymentCheckoutRequest {
  orderCode: string;
  userId: string;
  userEmail: string;
  userName: string;
  packageKey: string;
  packageName: string;
  creditsToGrant: number;
  amount: number;
  currency: "IDR" | "USD";
  returnUrl: string;
  idempotencyKey: string;
}

export interface PaymentCheckoutResult {
  providerOrderId: string;
  checkoutUrl: string;
  expiresAt?: Date | null;
  providerMetadata?: Record<string, unknown>;
}

export interface VerifiedWebhookEvent {
  externalEventId: string;
  eventType: string;
  orderCode: string;
  providerTransactionId: string;
  normalizedStatus: NormalizedPaymentEventStatus;
  amount: number;
  currency: string;
  eventTimestamp: Date | null;
  rawSummary: Record<string, unknown>;
}

export interface PaymentReconciliationResult {
  orderCode: string;
  providerTransactionId: string | null;
  normalizedStatus: NormalizedPaymentEventStatus;
  amount: number | null;
  currency: string | null;
  rawSummary: Record<string, unknown>;
}

export interface PaymentRefundRequest {
  orderCode: string;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface PaymentRefundResult {
  providerRefundId: string;
  status: "succeeded" | "pending";
  rawSummary: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  readonly name: string;
  readonly supportedCurrencies: readonly ("IDR" | "USD")[];
  isConfigured(): boolean;
  createCheckout(req: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
  verifyAndParseWebhook(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    now?: Date;
  }): VerifiedWebhookEvent;
  fetchOrderStatus(params: {
    orderCode: string;
    providerOrderId?: string | null;
  }): Promise<PaymentReconciliationResult>;
  issueRefund(req: PaymentRefundRequest): Promise<PaymentRefundResult>;
}

export function constantTimeHexEqual(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!normA || normA.length !== normB.length) return false;
  const bufA = Buffer.from(normA, "utf8");
  const bufB = Buffer.from(normB, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
