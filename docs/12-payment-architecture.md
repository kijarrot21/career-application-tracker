# 12. Payment Architecture and Integration

**Phase:** 6: Payment Architecture and Integration
**Status:** Schema, gateway abstraction, Midtrans and Stripe sandbox adapters, webhook security, reconciliation and refunds COMPLETE with simulated providers. User-facing checkout and billing UI IN DEVELOPMENT and not exposed in the active product. Live payment gateways NOT TESTED. Production charging BLOCKED until explicit approval.
**Primary UI Route:** `/credits` (currently renders an unavailable state after authentication; wallet and checkout implementation is retained)
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

The active `/credits` route renders an unavailable state after authentication. Package selection, gateway selection, checkout links, order details, transaction logs, and `Verify Status` are not reachable from the active interface.

The implementation remains in `CreditsWalletClient` (`src/components/credits/credits-wallet-client.tsx`) for a future enabled state. When enabled, success confirmation is rendered strictly from verified server order state (`order.status === "paid" && order.creditsGranted === true`), never from URL parameters alone. Backend services and API routes remain intact.

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| User-facing checkout and billing UI | IN DEVELOPMENT | Wallet, checkout, top-up and billing controls are not exposed in the active product. Backend services and API routes are preserved. |
| Payment schema and gateway abstraction | COMPLETE | `src/db/schema/payments.ts`, migration `src/db/migrations/0005_tiresome_siren.sql`, `src/server/payments/providers/payment-provider.types.ts`. |
| Midtrans sandbox adapter (IDR, Snap, SHA-512 webhook) | COMPLETE | `src/server/payments/providers/midtrans.provider.ts`. |
| Stripe sandbox adapter (USD cents, Checkout Sessions, HMAC-SHA256) | COMPLETE | `src/server/payments/providers/stripe.provider.ts`. |
| Checkout, webhook verification, dedup and replay protection | COMPLETE | `src/server/services/payments.ts`, endpoints `src/app/api/payments/webhook/[provider]/route.ts` and `src/app/api/v1/payments/checkout/route.ts`. |
| Reconciliation and refunds with single authoritative credit grant | COMPLETE | `reconcilePaymentOrderService()`, `refundPaymentOrderService()` in `src/server/services/payments.ts`. |
| Live Midtrans or Stripe charges against real accounts | NOT TESTED | `PAYMENT_MODE` defaults to `"disabled"` and only simulated providers were used in tests. No live credentials were available. |
| Production charging with live keys | BLOCKED | Requires explicit approval; sandbox adapters reject live keys by design. |

## Test evidence

- Unit: `tests/unit/phase6-payments.test.ts` verifies Midtrans SHA-512 and Stripe HMAC-SHA256 signatures, rejects invalid signatures and stale replays, and blocks live production keys.
- Integration: `tests/integration/payments.test.ts` (in-memory PGlite) covers successful Midtrans checkout, duplicate webhook deduplication, reconciliation idempotency with exactly one credit grant, rejection of invalid signatures, replays, incorrect amounts and currencies, failed checkout, Stripe reconciliation recovery and full refund clawback, all with simulated providers.
- Suite totals: 125/125 Vitest tests pass across 25 files, 4/4 Playwright E2E tests pass, typecheck, lint and build are green, and CI is green on commit `2a9540c`.
