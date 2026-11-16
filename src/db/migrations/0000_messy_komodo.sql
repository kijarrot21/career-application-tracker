CREATE TYPE "public"."assessment_type" AS ENUM('technical', 'psychometric', 'case_study', 'competency', 'other');--> statement-breakpoint
CREATE TYPE "public"."communication_channel" AS ENUM('email', 'phone', 'whatsapp', 'linkedin_message', 'platform_message', 'in_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."communication_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."communication_source" AS ENUM('gmail', 'outlook', 'manual');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('master_cv', 'custom_cv', 'cover_letter', 'portfolio', 'certificate', 'transcript', 'supporting', 'interview_prep', 'offer');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('none', 'high_school', 'diploma', 'bachelor', 'master', 'doctorate');--> statement-breakpoint
CREATE TYPE "public"."email_classification" AS ENUM('application_confirmation', 'cv_screening', 'interview_invitation', 'assessment_invitation', 'interview_follow_up', 'rejection', 'job_offer', 'other_recruitment', 'not_recruitment');--> statement-breakpoint
CREATE TYPE "public"."email_link_status" AS ENUM('suggested', 'confirmed', 'unlinked', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('gmail', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship', 'freelance', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('open', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."follow_up_type" AS ENUM('follow_up', 'deadline', 'interview_prep', 'custom');--> statement-breakpoint
CREATE TYPE "public"."history_source" AS ENUM('manual', 'kanban', 'submission', 'correction', 'reopen', 'email_suggestion', 'no_response_suggestion', 'import', 'sample');--> statement-breakpoint
CREATE TYPE "public"."interview_result" AS ENUM('pending', 'passed', 'failed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('hr', 'technical', 'user', 'panel', 'final', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."job_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."offer_decision" AS ENUM('pending', 'accepted', 'declined', 'rescinded');--> statement-breakpoint
CREATE TYPE "public"."application_outcome" AS ENUM('active', 'successful', 'unsuccessful', 'withdrawn', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('month', 'year', 'hour', 'project');--> statement-breakpoint
CREATE TYPE "public"."search_status" AS ENUM('actively_searching', 'open_to_offers', 'paused', 'hired');--> statement-breakpoint
CREATE TYPE "public"."stage_type" AS ENUM('sourced', 'interested', 'applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."submission_method" AS ENUM('platform', 'company_portal', 'email', 'referral', 'walk_in', 'other');--> statement-breakpoint
CREATE TYPE "public"."triage_status" AS ENUM('new', 'interested', 'shortlisted', 'not_interested', 'archived');--> statement-breakpoint
CREATE TYPE "public"."work_arrangement" AS ENUM('onsite', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"stage_type" "stage_type" NOT NULL,
	"sort_order" integer NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_stages_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"industry" text,
	"website" text,
	"location" text,
	"size" text,
	"notes" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"company_id" uuid NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"department" text,
	"industry" text,
	"location" text,
	"employment_type" "employment_type",
	"work_arrangement" "work_arrangement",
	"salary_min" bigint,
	"salary_max" bigint,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"salary_period" "salary_period" DEFAULT 'month' NOT NULL,
	"required_experience_years" smallint,
	"required_education" "education_level",
	"qualifications" text,
	"description" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text,
	"normalized_url" text,
	"external_job_id" text,
	"deadline" date,
	"discovered_on" date NOT NULL,
	"priority" "job_priority" DEFAULT 'medium' NOT NULL,
	"triage_status" "triage_status" DEFAULT 'new' NOT NULL,
	"triaged_at" timestamp with time zone,
	"suitability_score" smallint,
	"notes" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_vacancies_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "job_vacancies_salary_ck" CHECK ("job_vacancies"."salary_min" is null or "job_vacancies"."salary_max" is null or "job_vacancies"."salary_min" <= "job_vacancies"."salary_max"),
	CONSTRAINT "job_vacancies_salary_nonneg_ck" CHECK (coalesce("job_vacancies"."salary_min", 0) >= 0 and coalesce("job_vacancies"."salary_max", 0) >= 0),
	CONSTRAINT "job_vacancies_score_ck" CHECK ("job_vacancies"."suitability_score" is null or "job_vacancies"."suitability_score" between 0 and 100),
	CONSTRAINT "job_vacancies_experience_ck" CHECK ("job_vacancies"."required_experience_years" is null or "job_vacancies"."required_experience_years" between 0 and 60)
);
--> statement-breakpoint
CREATE TABLE "recruiter_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"notes" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recruiter_contacts_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suitability_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"skills_score" smallint,
	"experience_score" smallint,
	"education_score" smallint,
	"salary_score" smallint,
	"location_score" smallint,
	"growth_score" smallint,
	"suggestions" jsonb,
	"weights" jsonb NOT NULL,
	"overall_score" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suitability_scores_ck" CHECK (coalesce("suitability_evaluations"."skills_score",0) between 0 and 100 and coalesce("suitability_evaluations"."experience_score",0) between 0 and 100 and coalesce("suitability_evaluations"."education_score",0) between 0 and 100 and coalesce("suitability_evaluations"."salary_score",0) between 0 and 100 and coalesce("suitability_evaluations"."location_score",0) between 0 and 100 and coalesce("suitability_evaluations"."growth_score",0) between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"search_status" "search_status" DEFAULT 'actively_searching' NOT NULL,
	"headline" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"years_experience" smallint,
	"education_level" "education_level",
	"expected_salary_min" bigint,
	"expected_salary_max" bigint,
	"preferred_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_arrangements" text[] DEFAULT '{}'::text[] NOT NULL,
	"follow_up_first_days" smallint DEFAULT 5 NOT NULL,
	"follow_up_second_days" smallint DEFAULT 5 NOT NULL,
	"follow_up_final_days" smallint DEFAULT 10 NOT NULL,
	"no_response_days" smallint DEFAULT 30 NOT NULL,
	"holidays" text[] DEFAULT '{}'::text[] NOT NULL,
	"suitability_weights" jsonb,
	"include_sample_in_analytics" boolean,
	"next_application_seq" integer DEFAULT 1 NOT NULL,
	"next_job_seq" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_follow_up_days_ck" CHECK ("user_settings"."follow_up_first_days" between 1 and 60 and "user_settings"."follow_up_second_days" between 1 and 60 and "user_settings"."follow_up_final_days" between 0 and 90),
	CONSTRAINT "user_settings_no_response_ck" CHECK ("user_settings"."no_response_days" between 7 and 365)
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"role" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"effective_on" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "history_source" DEFAULT 'manual' NOT NULL,
	"reason" text,
	"note" text,
	"email_id" uuid
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"current_stage_id" uuid NOT NULL,
	"outcome" "application_outcome" DEFAULT 'active' NOT NULL,
	"submitted_on" date NOT NULL,
	"platform_source_id" uuid,
	"submission_method" "submission_method" DEFAULT 'platform' NOT NULL,
	"application_url" text,
	"external_reference_id" text,
	"confirmation_reference" text,
	"cv_version_label" text,
	"cover_letter_version_label" text,
	"cv_version_id" uuid,
	"cover_letter_version_id" uuid,
	"primary_recruiter_id" uuid,
	"recruiter_name" text,
	"recruiter_email" text,
	"recruiter_contact" text,
	"expected_salary" bigint,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"job_category" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"reapply_reason" text,
	"next_follow_up_on" date,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" date,
	"notes" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "applications_attempt_ck" CHECK ("applications"."attempt_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"assessment_type" "assessment_type" DEFAULT 'technical' NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"score" text,
	"max_score" text,
	"result" "interview_result" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"summary" text,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"storage_key" text,
	"filename" text,
	"mime_type" text,
	"size_bytes" integer,
	"sha256" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" "document_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "email_provider" NOT NULL,
	"email" text NOT NULL,
	"encrypted_refresh_token" text,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"sync_cursor" text,
	"last_synced_at" timestamp with time zone,
	"status" text DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_accounts_id_user_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "email_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email_account_id" uuid,
	"source" "communication_source" DEFAULT 'manual' NOT NULL,
	"channel" "communication_channel" DEFAULT 'email' NOT NULL,
	"provider_message_id" text,
	"thread_id" text,
	"direction" "communication_direction" DEFAULT 'inbound' NOT NULL,
	"sender" text,
	"recipient" text,
	"subject" text NOT NULL,
	"snippet" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"classification" "email_classification" DEFAULT 'other_recruitment' NOT NULL,
	"confidence" smallint,
	"classifier_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"detected_company" text,
	"detected_position" text,
	"application_id" uuid,
	"link_status" "email_link_status" DEFAULT 'confirmed' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid,
	"type" "follow_up_type" DEFAULT 'follow_up' NOT NULL,
	"title" text NOT NULL,
	"sequence_no" smallint DEFAULT 1 NOT NULL,
	"due_on" date NOT NULL,
	"status" "follow_up_status" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"note" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"stage_id" uuid,
	"interview_type" "interview_type" DEFAULT 'hr' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" smallint DEFAULT 45 NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"location" text,
	"meeting_url" text,
	"interviewer_name" text,
	"interviewer_position" text,
	"interviewer_contact" text,
	"notes" text,
	"questions" text,
	"preparation_notes" text,
	"feedback" text,
	"result" "interview_result" DEFAULT 'pending' NOT NULL,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"position_title" text NOT NULL,
	"base_salary" bigint,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"salary_period" "salary_period" DEFAULT 'month' NOT NULL,
	"benefits" text,
	"joining_date" date,
	"offer_received_on" date NOT NULL,
	"response_deadline" date,
	"decision" "offer_decision" DEFAULT 'pending' NOT NULL,
	"decided_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" uuid,
	"due_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stages" ADD CONSTRAINT "application_stages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_company_fk" FOREIGN KEY ("company_id","user_id") REFERENCES "public"."companies"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_contacts" ADD CONSTRAINT "recruiter_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_contacts" ADD CONSTRAINT "recruiter_contacts_company_fk" FOREIGN KEY ("company_id","user_id") REFERENCES "public"."companies"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_evaluations" ADD CONSTRAINT "suitability_evaluations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_evaluations" ADD CONSTRAINT "suitability_vacancy_fk" FOREIGN KEY ("vacancy_id","user_id") REFERENCES "public"."job_vacancies"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_app_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_ver_fk" FOREIGN KEY ("document_version_id","user_id") REFERENCES "public"."document_versions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "app_history_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "app_history_to_stage_fk" FOREIGN KEY ("to_stage_id","user_id") REFERENCES "public"."application_stages"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_platform_source_id_job_sources_id_fk" FOREIGN KEY ("platform_source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_fk" FOREIGN KEY ("vacancy_id","user_id") REFERENCES "public"."job_vacancies"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_stage_fk" FOREIGN KEY ("current_stage_id","user_id") REFERENCES "public"."application_stages"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_recruiter_fk" FOREIGN KEY ("primary_recruiter_id","user_id") REFERENCES "public"."recruiter_contacts"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_doc_fk" FOREIGN KEY ("document_id","user_id") REFERENCES "public"."documents"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_communications" ADD CONSTRAINT "email_communications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_communications" ADD CONSTRAINT "email_comm_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_application_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "application_stages_user_key_uq" ON "application_stages" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "application_stages_user_order_idx" ON "application_stages" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_user_normalized_name_uq" ON "companies" USING btree ("user_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_system_key_uq" ON "job_sources" USING btree ("key") WHERE user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_user_key_uq" ON "job_sources" USING btree ("user_id","key") WHERE user_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_vacancies_user_code_uq" ON "job_vacancies" USING btree ("user_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "job_vacancies_user_url_uq" ON "job_vacancies" USING btree ("user_id","normalized_url") WHERE normalized_url is not null;--> statement-breakpoint
CREATE INDEX "job_vacancies_user_triage_idx" ON "job_vacancies" USING btree ("user_id","triage_status");--> statement-breakpoint
CREATE INDEX "recruiter_contacts_user_company_idx" ON "recruiter_contacts" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suitability_vacancy_uq" ON "suitability_evaluations" USING btree ("vacancy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_documents_app_ver_uq" ON "application_documents" USING btree ("application_id","document_version_id");--> statement-breakpoint
CREATE INDEX "app_history_app_effective_idx" ON "application_status_history" USING btree ("application_id","effective_on","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_code_uq" ON "applications" USING btree ("user_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_one_active_per_vacancy_uq" ON "applications" USING btree ("vacancy_id") WHERE "applications"."outcome" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "applications_vacancy_attempt_uq" ON "applications" USING btree ("vacancy_id","attempt_number");--> statement-breakpoint
CREATE INDEX "applications_user_stage_idx" ON "applications" USING btree ("user_id","current_stage_id");--> statement-breakpoint
CREATE INDEX "applications_user_outcome_idx" ON "applications" USING btree ("user_id","outcome");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_doc_ver_uq" ON "document_versions" USING btree ("document_id","version_no");--> statement-breakpoint
CREATE INDEX "documents_user_category_idx" ON "documents" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_user_provider_email_uq" ON "email_accounts" USING btree ("user_id","provider","email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_comm_provider_msg_uq" ON "email_communications" USING btree ("user_id","source","provider_message_id") WHERE provider_message_id is not null;--> statement-breakpoint
CREATE INDEX "email_comm_user_app_idx" ON "email_communications" USING btree ("user_id","application_id","occurred_at");--> statement-breakpoint
CREATE INDEX "follow_up_tasks_user_due_idx" ON "follow_up_tasks" USING btree ("user_id","status","due_on");--> statement-breakpoint
CREATE INDEX "interviews_user_starts_idx" ON "interviews" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_application_uq" ON "job_offers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");