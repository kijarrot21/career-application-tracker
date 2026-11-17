CREATE TYPE "public"."payment_environment" AS ENUM('disabled', 'sandbox');--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('pending', 'requires_action', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('midtrans', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_type" AS ENUM('charge', 'capture', 'refund', 'chargeback', 'reconciliation');--> statement-breakpoint
CREATE TYPE "public"."webhook_processing_status" AS ENUM('received', 'processed', 'ignored_duplicate', 'rejected_signature', 'rejected_validation', 'failed');--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"order_code" text NOT NULL,
	"package_id" uuid,
	"package_key" text NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"environment" "payment_environment" DEFAULT 'sandbox' NOT NULL,
	"currency" text NOT NULL,
	"expected_amount" bigint NOT NULL,
	"credits_to_grant" integer NOT NULL,
	"status" "payment_order_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_order_id" text,
	"checkout_url" text,
	"credits_granted" boolean DEFAULT false NOT NULL,
	"credit_ledger_id" uuid,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "payment_orders_positive_ck" CHECK ("payment_orders"."expected_amount" > 0 and "payment_orders"."credits_to_grant" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"transaction_type" "payment_transaction_type" NOT NULL,
	"provider_transaction_id" text,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_transaction_status" NOT NULL,
	"raw_summary" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_tx_amount_nonneg_ck" CHECK ("payment_transactions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"order_id" uuid,
	"user_id" text,
	"signature_valid" boolean NOT NULL,
	"payload_hash" text NOT NULL,
	"event_timestamp" timestamp with time zone,
	"processing_status" "webhook_processing_status" NOT NULL,
	"error_message" text,
	"payload_summary" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_fk" FOREIGN KEY ("order_id","user_id") REFERENCES "public"."payment_orders"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_code_uq" ON "payment_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_user_idemp_uq" ON "payment_orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_ref_uq" ON "payment_orders" USING btree ("provider","provider_order_id") WHERE provider_order_id is not null;--> statement-breakpoint
CREATE INDEX "payment_orders_user_status_idx" ON "payment_orders" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_tx_provider_tx_type_uq" ON "payment_transactions" USING btree ("provider","provider_transaction_id","transaction_type") WHERE provider_transaction_id is not null;--> statement-breakpoint
CREATE INDEX "payment_tx_user_order_idx" ON "payment_transactions" USING btree ("user_id","order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhooks_provider_event_uq" ON "payment_webhook_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhooks_status_idx" ON "payment_webhook_events" USING btree ("provider","processing_status","received_at");--> statement-breakpoint
CREATE INDEX "payment_webhooks_order_idx" ON "payment_webhook_events" USING btree ("order_id");