CREATE TYPE "public"."ai_feedback_action" AS ENUM('accepted', 'partially_accepted', 'rejected', 'edited', 'reported_hallucination', 'comment_only');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('awaiting_consent', 'queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_locale" AS ENUM('id', 'en');--> statement-breakpoint
CREATE TYPE "public"."ai_locality" AS ENUM('local', 'cloud');--> statement-breakpoint
CREATE TYPE "public"."ai_preferred_provider" AS ENUM('auto', 'ollama', 'openai', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."ai_privacy_mode" AS ENUM('local_only', 'cloud_allowed', 'ask_before_each');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('ollama', 'openai', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."ai_source_type" AS ENUM('career_profile', 'document_version', 'job_vacancy', 'application', 'archive_snapshot', 'interview', 'raw_text');--> statement-breakpoint
CREATE TYPE "public"."ai_task_type" AS ENUM('cv_parse', 'cv_evaluate', 'job_match', 'cv_correction', 'cv_generate', 'skill_gap', 'career_roadmap', 'interview_coach');--> statement-breakpoint
CREATE TABLE "ai_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"locality" "ai_locality" NOT NULL,
	"model" text NOT NULL,
	"prompt_version_id" uuid,
	"prompt_version_tag" text NOT NULL,
	"locale" "ai_locale" DEFAULT 'en' NOT NULL,
	"privacy_mode_at_run" "ai_privacy_mode" NOT NULL,
	"contains_private_documents" boolean DEFAULT false NOT NULL,
	"consent_required" boolean DEFAULT false NOT NULL,
	"consent_granted" boolean DEFAULT false NOT NULL,
	"consent_granted_at" timestamp with time zone,
	"input_hash" text NOT NULL,
	"status" "ai_job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"error_code" text,
	"error_message" text,
	"usage_metadata" jsonb,
	"pending_task_request" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_analysis_jobs_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "ai_analysis_jobs_attempts_ck" CHECK ("ai_analysis_jobs"."attempts" >= 0),
	CONSTRAINT "ai_analysis_jobs_max_attempts_ck" CHECK ("ai_analysis_jobs"."max_attempts" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"analysis_id" uuid,
	"source_type" "ai_source_type" NOT NULL,
	"source_id" text,
	"source_label" text,
	"source_hash" text NOT NULL,
	"is_untrusted_external" boolean DEFAULT false NOT NULL,
	"injection_signal_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_career_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"prompt_version_tag" text NOT NULL,
	"locale" "ai_locale" DEFAULT 'en' NOT NULL,
	"input_hash" text NOT NULL,
	"schema_version" text DEFAULT '1.0' NOT NULL,
	"overall_score" smallint,
	"summary_text" text,
	"result_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_career_analyses_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "ai_career_analyses_score_ck" CHECK ("ai_career_analyses"."overall_score" is null or "ai_career_analyses"."overall_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "ai_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"analysis_id" uuid NOT NULL,
	"rating" smallint,
	"helpful" boolean,
	"action_taken" "ai_feedback_action" DEFAULT 'comment_only' NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_feedback_rating_ck" CHECK ("ai_feedback"."rating" is null or "ai_feedback"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"locale" "ai_locale" DEFAULT 'en' NOT NULL,
	"version" text NOT NULL,
	"template_hash" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_privacy_mode" "ai_privacy_mode" DEFAULT 'ask_before_each' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_preferred_provider" "ai_preferred_provider" DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_ollama_endpoint" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_ollama_model" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_cloud_document_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_prompt_version_id_ai_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_sources" ADD CONSTRAINT "ai_analysis_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_sources" ADD CONSTRAINT "ai_analysis_sources_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."ai_analysis_jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_sources" ADD CONSTRAINT "ai_analysis_sources_analysis_fk" FOREIGN KEY ("analysis_id","user_id") REFERENCES "public"."ai_career_analyses"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_career_analyses" ADD CONSTRAINT "ai_career_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_career_analyses" ADD CONSTRAINT "ai_career_analyses_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."ai_analysis_jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_analysis_fk" FOREIGN KEY ("analysis_id","user_id") REFERENCES "public"."ai_career_analyses"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_user_status_idx" ON "ai_analysis_jobs" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_user_task_hash_idx" ON "ai_analysis_jobs" USING btree ("user_id","task_type","input_hash");--> statement-breakpoint
CREATE INDEX "ai_analysis_sources_job_idx" ON "ai_analysis_sources" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_sources_analysis_idx" ON "ai_analysis_sources" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_sources_user_entity_idx" ON "ai_analysis_sources" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_career_analyses_job_uq" ON "ai_career_analyses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_career_analyses_user_task_idx" ON "ai_career_analyses" USING btree ("user_id","task_type","created_at");--> statement-breakpoint
CREATE INDEX "ai_feedback_user_analysis_idx" ON "ai_feedback" USING btree ("user_id","analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_versions_task_locale_ver_uq" ON "ai_prompt_versions" USING btree ("task_type","locale","version");--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_task_active_idx" ON "ai_prompt_versions" USING btree ("task_type","locale","is_active");