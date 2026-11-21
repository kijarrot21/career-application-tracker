CREATE TYPE "public"."document_processing_status" AS ENUM('uploaded', 'queued', 'processing', 'awaiting_review', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "processing_status" "document_processing_status" DEFAULT 'uploaded' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "ai_job_id" uuid;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "ai_analysis_id" uuid;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "document_versions_user_status_idx" ON "document_versions" USING btree ("user_id","processing_status");