CREATE TYPE "public"."credit_ledger_entry_type" AS ENUM('grant', 'reserve', 'capture', 'release', 'refund', 'adjustment', 'topup_preview', 'expire');--> statement-breakpoint
CREATE TYPE "public"."credit_reservation_status" AS ENUM('reserved', 'captured', 'released', 'expired');--> statement-breakpoint
CREATE TABLE "ai_credit_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_key" text NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"credit_cost" integer NOT NULL,
	"charge_local_runs" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_pricing_cost_nonneg_ck" CHECK ("ai_credit_pricing"."credit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" uuid NOT NULL,
	"reservation_id" uuid,
	"job_id" uuid,
	"entry_type" "credit_ledger_entry_type" NOT NULL,
	"delta_available" integer NOT NULL,
	"delta_reserved" integer DEFAULT 0 NOT NULL,
	"balance_after_available" integer NOT NULL,
	"balance_after_reserved" integer NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text,
	"idempotency_key" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_balance_nonneg_ck" CHECK ("credit_ledger"."balance_after_available" >= 0 and "credit_ledger"."balance_after_reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"credits" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"price_idr" bigint NOT NULL,
	"price_usd_cents" integer NOT NULL,
	"badge_text" text,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packages_credits_pos_ck" CHECK ("credit_packages"."credits" > 0),
	CONSTRAINT "credit_packages_bonus_nonneg_ck" CHECK ("credit_packages"."bonus_credits" >= 0),
	CONSTRAINT "credit_packages_price_nonneg_ck" CHECK ("credit_packages"."price_idr" >= 0 and "credit_packages"."price_usd_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" uuid NOT NULL,
	"job_id" uuid,
	"pricing_key" text NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"provider" "ai_provider",
	"locality" "ai_locality",
	"amount" integer NOT NULL,
	"status" "credit_reservation_status" DEFAULT 'reserved' NOT NULL,
	"idempotency_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "credit_reservations_amount_pos_ck" CHECK ("credit_reservations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"reserved_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_granted" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"low_balance_threshold" integer DEFAULT 10 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_wallets_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "credit_wallets_available_nonneg_ck" CHECK ("credit_wallets"."available_balance" >= 0),
	CONSTRAINT "credit_wallets_reserved_nonneg_ck" CHECK ("credit_wallets"."reserved_balance" >= 0),
	CONSTRAINT "credit_wallets_version_pos_ck" CHECK ("credit_wallets"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD COLUMN "pricing_key" text;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD COLUMN "credit_cost" integer;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD COLUMN "credit_reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_wallet_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."credit_wallets"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reservation_fk" FOREIGN KEY ("reservation_id","user_id") REFERENCES "public"."credit_reservations"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_wallet_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."credit_wallets"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_pricing_key_uq" ON "ai_credit_pricing" USING btree ("pricing_key");--> statement-breakpoint
CREATE INDEX "ai_credit_pricing_task_idx" ON "ai_credit_pricing" USING btree ("task_type","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_user_idemp_uq" ON "credit_ledger" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_wallet_created_idx" ON "credit_ledger" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_packages_key_uq" ON "credit_packages" USING btree ("package_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservations_user_idemp_uq" ON "credit_reservations" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_reservations_user_status_idx" ON "credit_reservations" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "credit_reservations_job_idx" ON "credit_reservations" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_wallets_user_uq" ON "credit_wallets" USING btree ("user_id");