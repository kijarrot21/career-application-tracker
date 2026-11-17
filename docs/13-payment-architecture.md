# 13. Payment Architecture & Integration

**Phase:** 6: Payment Architecture and Integration  
**Status:** Implemented (Database Schema, Gateway Abstraction, Midtrans & Stripe Sandbox Adapters, Webhook Security, Reconciliation, Refunds, UI; Production/Real-Money Charges Blocked Until Explicit Approval)  
**Primary UI Route:** `/credits`  
**Webhook Endpoint:** `POST /api/payments/webhook/[provider]`

---

## 1. Approval Gate & Environment Safety

Real-money transactions and live credentials are **disabled by default**:
- `PAYMENT_MODE` defaults to `"disabled"` (supports `"disabled"` or `"sandbox"`).
- `MidtransSandboxProvider` blocks live keys (`Mid-server-*`) and accepts sandbox keys (`SB-Mid-server-*`).
- `StripeSandboxProvider` blocks live keys (`sk_live_*`, `rk_live_*`) and accepts test keys (`sk_test_*`).
- Variable names are documented in `.env.example` without secrets; keys never leave server modules.

---

## 2. Provider-Independent Payment Abstraction

```text
src/server/payments/providers/
├── payment-provider.types.ts  # PaymentProviderAdapter contract + constantTimeHexEqual
├── midtrans.provider.ts       # Indonesia gateway (IDR, Snap Checkout, SHA-512 webhook)
├── stripe.provider.ts         # International gateway (USD cents, Checkout Sessions, HMAC-SHA256)
└── index.ts                   # Registry & non-secret status summary
```

Business orchestration (`src/server/services/payments.ts`) programs strictly against `PaymentProviderAdapter`, keeping order creation, validation, idempotent ledger grants, reconciliation, and refunds decoupled from any single gateway.

---

## 3. Database Schema (`src/db/schema/payments.ts`, Migration `0005_tiresome_siren.sql`)

| Table | Purpose | Key Integrity & Constraints |
|---|---|---|
| `payment_orders` | Authoritative purchase order (`pending`, `requires_action`, `paid`, `failed`, `expired`, `cancelled`, `refunded`, `disputed`) | `UNIQUE(order_code)`, `UNIQUE(user_id, idempotency_key)`, partial `UNIQUE(provider, provider_order_id)`, `expected_amount > 0`, `credits_to_grant > 0`, `credits_granted` flag |
| `payment_transactions` | Gateway charge, capture, refund, and reconciliation records | Composite FK `(order_id, user_id) -> payment_orders(id, user_id)`, partial `UNIQUE(provider, provider_transaction_id, transaction_type)` |
| `payment_webhook_events` | Cryptographic signature audit & deduplication log | `UNIQUE(provider, external_event_id)`, `signature_valid`, `payload_hash`, `event_timestamp`, `processing_status` (`processed`, `ignored_duplicate`, `rejected_signature`, `rejected_validation`) |

---

## 4. Secure Checkout & Settlement Flow

1. **Order Creation (`createCreditCheckoutOrderService`):** Client sends only `packageKey` + `provider`. Server resolves authoritative price (`IDR` or `USD` cents) and credits from `credit_packages`, creates a `payment_orders` row, and calls `adapter.createCheckout()`.
2. **Webhook Verification (`processPaymentWebhookService`):**
   - Verifies cryptographic signature (`timingSafeEqual` on Midtrans SHA-512 or Stripe `t=...,v1=...` HMAC-SHA256). Invalid signatures record `rejected_signature` and return HTTP `401`.
   - Enforces replay window tolerance (`PAYMENT_WEBHOOK_MAX_AGE_SECONDS`, default `300s`).
   - Enforces event uniqueness on `(provider, external_event_id)` (`ignored_duplicate` on replays).
   - Locks `payment_orders` (`FOR UPDATE`) and validates `provider`, `currency`, and `amount === expectedAmount` (`disputed` + `rejected_validation` on mismatches, returning HTTP `422` with zero credits granted).
3. **Authoritative Single Credit Grant (`grantPurchasedCreditsTx`):** Protected by both `payment_orders.credits_granted` AND `credit_ledger` `UNIQUE(user_id, idempotency_key)` (`purchase:${order.id}`), guaranteeing a purchase results in **at most one** credit grant even across concurrent webhooks and reconciliation.
4. **Reconciliation & Refunds:** `reconcilePaymentOrderService()` queries gateway status directly to recover missed webhooks safely; `refundPaymentOrderService()` issues provider refunds, marks orders `refunded`, logs `payment_transactions`, and adjusts the user's wallet cleanly via `credit_ledger`.

---

## 5. UI Verification Guarantee (`/credits`)

`CreditsWalletClient` (`src/components/credits/credits-wallet-client.tsx`) renders package selection, gateway selection, pending checkout links, order status details, transaction logs, and manual verification (`Verify Status`). Success confirmation is rendered **strictly** from verified server order state (`order.status === "paid" && order.creditsGranted === true`), never from URL parameters alone.
