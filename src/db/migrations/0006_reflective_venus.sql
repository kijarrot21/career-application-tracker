CREATE TYPE "public"."sync_conflict_status" AS ENUM('open', 'resolved_keep_local', 'resolved_keep_cloud', 'resolved_merged', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."sync_device_status" AS ENUM('active', 'paused', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('push', 'pull', 'resolve', 'system');--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('application', 'application_status', 'note', 'career_profile', 'document', 'application_history', 'archive_snapshot', 'job_vacancy', 'interview');--> statement-breakpoint
CREATE TYPE "public"."sync_operation" AS ENUM('create', 'update', 'append', 'delete');--> statement-breakpoint
CREATE TYPE "public"."sync_operation_mode" AS ENUM('local_only', 'cloud_only', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."sync_outbox_status" AS ENUM('pending', 'in_flight', 'synced', 'conflict', 'failed', 'discarded');--> statement-breakpoint
CREATE TABLE "sync_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"stream_key" text DEFAULT 'default' NOT NULL,
	"last_push_cursor" bigint DEFAULT 0 NOT NULL,
	"last_pull_cursor" bigint DEFAULT 0 NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"last_attempted_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_checkpoints_cursors_nonneg_ck" CHECK ("sync_checkpoints"."last_push_cursor" >= 0 and "sync_checkpoints"."last_pull_cursor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"outbox_id" uuid,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"local_version" integer NOT NULL,
	"cloud_version" integer NOT NULL,
	"local_payload" jsonb NOT NULL,
	"cloud_payload" jsonb NOT NULL,
	"conflict_reason" text NOT NULL,
	"resolution_status" "sync_conflict_status" DEFAULT 'open' NOT NULL,
	"resolved_payload" jsonb,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_key" text NOT NULL,
	"device_name" text NOT NULL,
	"platform" text DEFAULT 'web' NOT NULL,
	"operation_mode" "sync_operation_mode" DEFAULT 'local_only' NOT NULL,
	"status" "sync_device_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_devices_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" serial NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid,
	"direction" "sync_direction" DEFAULT 'push' NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"operation" "sync_operation" NOT NULL,
	"entity_version" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"outcome" text DEFAULT 'applied' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_events_version_pos_ck" CHECK ("sync_events"."entity_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sync_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"operation" "sync_operation" NOT NULL,
	"base_version" integer DEFAULT 0 NOT NULL,
	"target_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "sync_outbox_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_outbox_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "sync_outbox_versions_ck" CHECK ("sync_outbox"."base_version" >= 0 and "sync_outbox"."target_version" >= 1),
	CONSTRAINT "sync_outbox_retry_ck" CHECK ("sync_outbox"."retry_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_device_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."sync_devices"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_outbox_id_sync_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."sync_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_device_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."sync_devices"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_device_id_sync_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."sync_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_outbox" ADD CONSTRAINT "sync_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_outbox" ADD CONSTRAINT "sync_outbox_device_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."sync_devices"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_checkpoints_device_stream_uq" ON "sync_checkpoints" USING btree ("device_id","stream_key");--> statement-breakpoint
CREATE INDEX "sync_conflicts_user_status_idx" ON "sync_conflicts" USING btree ("user_id","resolution_status","created_at");--> statement-breakpoint
CREATE INDEX "sync_conflicts_entity_idx" ON "sync_conflicts" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_devices_user_key_uq" ON "sync_devices" USING btree ("user_id","device_key");--> statement-breakpoint
CREATE INDEX "sync_devices_user_status_idx" ON "sync_devices" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_events_user_idemp_uq" ON "sync_events" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sync_events_user_seq_idx" ON "sync_events" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "sync_events_user_entity_idx" ON "sync_events" USING btree ("user_id","entity_type","entity_id","entity_version");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_outbox_user_idemp_uq" ON "sync_outbox" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sync_outbox_user_device_status_idx" ON "sync_outbox" USING btree ("user_id","device_id","status","created_at");