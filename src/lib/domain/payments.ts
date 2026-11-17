export const PAYMENT_PROVIDERS = ["midtrans", "stripe"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  midtrans: "Midtrans (Indonesia — QRIS, VA, E-Wallet, Card)",
  stripe: "Stripe (International — Cards & Global Checkout)",
};

export const PAYMENT_ENVIRONMENTS = ["disabled", "sandbox"] as const;
export type PaymentEnvironment = (typeof PAYMENT_ENVIRONMENTS)[number];

export const PAYMENT_ORDER_STATUSES = [
  "pending",
  "requires_action",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
  "disputed",
] as const;
export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export const PAYMENT_TRANSACTION_TYPES = [
  "charge",
  "capture",
  "refund",
  "chargeback",
  "reconciliation",
] as const;
export type PaymentTransactionType =
  (typeof PAYMENT_TRANSACTION_TYPES)[number];

export const PAYMENT_TRANSACTION_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
] as const;
export type PaymentTransactionStatus =
  (typeof PAYMENT_TRANSACTION_STATUSES)[number];

export const WEBHOOK_PROCESSING_STATUSES = [
  "received",
  "processed",
  "ignored_duplicate",
  "rejected_signature",
  "rejected_validation",
  "failed",
] as const;
export type WebhookProcessingStatus =
  (typeof WEBHOOK_PROCESSING_STATUSES)[number];

export type NormalizedPaymentEventStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export class PaymentError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class PaymentSignatureError extends PaymentError {
  constructor(message: string) {
    super("INVALID_WEBHOOK_SIGNATURE", message, 401);
    this.name = "PaymentSignatureError";
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(message: string) {
    super("PAYMENT_VALIDATION_FAILED", message, 422);
    this.name = "PaymentValidationError";
  }
}
