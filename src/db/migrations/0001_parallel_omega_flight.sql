CREATE TYPE "public"."closure_outcome" AS ENUM('rejected', 'withdrawn', 'hired', 'no_response', 'closed');--> statement-breakpoint
CREATE TYPE "public"."closure_record_status" AS ENUM('archived', 'restored');--> statement-breakpoint
CREATE TYPE "public"."closure_source" AS ENUM('auto_stage_transition', 'manual_archive', 'email_confirmation', 'offer_decision', 'no_response_confirmation', 'sample');--> statement-breakpoint
ALTER TYPE "public"."application_outcome" ADD VALUE 'closed';--> statement-breakpoint
CREATE TABLE "application_archive_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"closure_record_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"document_id" uuid,
	"document_version_id" uuid,
	"role" text DEFAULT 'other' NOT NULL,
	"document_category" text,
	"document_title" text NOT NULL,
	"version_no" integer,
	"version_label" text NOT NULL,
	"filename" text,
	"mime_type" text,
	"size_bytes" integer,
	"sha256" text,
	"storage_key" text,
	"notes" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_archive_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"closure_record_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"snapshot_version" integer DEFAULT 1 NOT NULL,
	"application_code" text NOT NULL,
	"company_name" text NOT NULL,
	"job_title" text NOT NULL,
	"closure_outcome" "closure_outcome" NOT NULL,
	"closed_on" date NOT NULL,
	"submitted_on" date NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"content_hash" text NOT NULL,
	"snapshot_payload" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	CONSTRAINT "app_archive_snapshots_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "application_closure_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"closure_outcome" "closure_outcome" NOT NULL,
	"closure_source" "closure_source" DEFAULT 'auto_stage_transition' NOT NULL,
	"status" "closure_record_status" DEFAULT 'archived' NOT NULL,
	"closed_on" date NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_stage_id" uuid,
	"previous_outcome" "application_outcome" DEFAULT 'active' NOT NULL,
	"closed_stage_id" uuid,
	"closure_reason" text,
	"closure_note" text,
	"retain_until" date,
	"restored_at" timestamp with time zone,
	"restored_to_stage_id" uuid,
	"restoration_reason" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_closure_records_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "auto_archive_on_terminal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "archive_retention_days" integer;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "archive_auto_delete_expired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "application_archive_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "application_archive_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "application_archive_documents_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "app_archive_docs_closure_fk" FOREIGN KEY ("closure_record_id","user_id") REFERENCES "public"."application_closure_records"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "app_archive_docs_snapshot_fk" FOREIGN KEY ("snapshot_id","user_id") REFERENCES "public"."application_archive_snapshots"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_documents" ADD CONSTRAINT "app_archive_docs_app_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_snapshots" ADD CONSTRAINT "application_archive_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_snapshots" ADD CONSTRAINT "app_archive_snapshots_closure_fk" FOREIGN KEY ("closure_record_id","user_id") REFERENCES "public"."application_closure_records"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_archive_snapshots" ADD CONSTRAINT "app_archive_snapshots_app_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_closure_records" ADD CONSTRAINT "application_closure_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_closure_records" ADD CONSTRAINT "app_closure_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_closure_records" ADD CONSTRAINT "app_closure_vacancy_fk" FOREIGN KEY ("vacancy_id","user_id") REFERENCES "public"."job_vacancies"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_archive_docs_closure_idx" ON "application_archive_documents" USING btree ("closure_record_id");--> statement-breakpoint
CREATE INDEX "app_archive_docs_user_app_idx" ON "application_archive_documents" USING btree ("user_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_archive_snapshots_closure_uq" ON "application_archive_snapshots" USING btree ("closure_record_id");--> statement-breakpoint
CREATE INDEX "app_archive_snapshots_user_app_idx" ON "application_archive_snapshots" USING btree ("user_id","application_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "app_closure_active_app_uq" ON "application_closure_records" USING btree ("application_id") WHERE "application_closure_records"."status" = 'archived';--> statement-breakpoint
CREATE INDEX "app_closure_user_status_closed_idx" ON "application_closure_records" USING btree ("user_id","status","closed_on");--> statement-breakpoint
CREATE INDEX "app_closure_user_outcome_idx" ON "application_closure_records" USING btree ("user_id","closure_outcome");--> statement-breakpoint
CREATE INDEX "app_closure_user_retain_idx" ON "application_closure_records" USING btree ("user_id","retain_until");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_archive_retention_ck" CHECK ("user_settings"."archive_retention_days" is null or "user_settings"."archive_retention_days" between 30 and 3650);