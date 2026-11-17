CREATE TYPE "public"."career_level" AS ENUM('entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'manager', 'director', 'executive');--> statement-breakpoint
CREATE TYPE "public"."profile_data_source" AS ENUM('manual', 'cv_import', 'ai_suggested_pending');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('technical', 'framework', 'tool', 'language', 'domain', 'soft_skill', 'methodology', 'other');--> statement-breakpoint
CREATE TYPE "public"."skill_proficiency" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'pending_review', 'unverified');--> statement-breakpoint
CREATE TABLE "career_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuing_organization" text NOT NULL,
	"issue_date" date,
	"expiration_date" date,
	"credential_id" text,
	"credential_url" text,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_certifications_dates_ck" CHECK ("career_certifications"."issue_date" is null or "career_certifications"."expiration_date" is null or "career_certifications"."expiration_date" >= "career_certifications"."issue_date")
);
--> statement-breakpoint
CREATE TABLE "career_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"institution" text NOT NULL,
	"qualification" "education_level" DEFAULT 'bachelor' NOT NULL,
	"degree_title" text,
	"field_of_study" text,
	"graduation_year" smallint,
	"gpa" text,
	"notes" text,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_educations_year_ck" CHECK ("career_educations"."graduation_year" is null or "career_educations"."graduation_year" between 1950 and 2100)
);
--> statement-breakpoint
CREATE TABLE "career_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"job_title" text NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"location" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"responsibilities" text,
	"achievements" text[] DEFAULT '{}'::text[] NOT NULL,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_experiences_dates_ck" CHECK (("career_experiences"."is_current" = false or "career_experiences"."end_date" is null) and ("career_experiences"."end_date" is null or "career_experiences"."end_date" >= "career_experiences"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "career_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"full_name" text NOT NULL,
	"headline" text,
	"summary" text,
	"contact_email" text,
	"contact_phone" text,
	"linkedin_url" text,
	"portfolio_url" text,
	"github_url" text,
	"location" text,
	"country" text DEFAULT 'Indonesia',
	"preferred_language" text DEFAULT 'id-ID' NOT NULL,
	"career_level" "career_level",
	"total_experience_years" smallint,
	"target_positions" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_arrangements" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_currency" text DEFAULT 'IDR' NOT NULL,
	"expected_salary_min" bigint,
	"expected_salary_max" bigint,
	"salary_period" "salary_period" DEFAULT 'month' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"pending_review_payload" jsonb,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_profiles_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "career_profiles_exp_ck" CHECK ("career_profiles"."total_experience_years" is null or "career_profiles"."total_experience_years" between 0 and 60),
	CONSTRAINT "career_profiles_salary_ck" CHECK ("career_profiles"."expected_salary_min" is null or "career_profiles"."expected_salary_max" is null or "career_profiles"."expected_salary_min" <= "career_profiles"."expected_salary_max"),
	CONSTRAINT "career_profiles_salary_nonneg_ck" CHECK (coalesce("career_profiles"."expected_salary_min", 0) >= 0 and coalesce("career_profiles"."expected_salary_max", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "career_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"organization" text,
	"role" text,
	"start_date" date,
	"end_date" date,
	"is_ongoing" boolean DEFAULT false NOT NULL,
	"description" text,
	"achievements" text[] DEFAULT '{}'::text[] NOT NULL,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"project_url" text,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_projects_dates_ck" CHECK (("career_projects"."is_ongoing" = false or "career_projects"."end_date" is null) and ("career_projects"."start_date" is null or "career_projects"."end_date" is null or "career_projects"."end_date" >= "career_projects"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "career_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"skill_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" "skill_category" DEFAULT 'technical' NOT NULL,
	"proficiency_level" "skill_proficiency" DEFAULT 'intermediate' NOT NULL,
	"years_of_experience" smallint,
	"evidence" text,
	"is_user_verified" boolean DEFAULT true NOT NULL,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"source" "profile_data_source" DEFAULT 'manual' NOT NULL,
	"source_document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_skills_years_ck" CHECK ("career_skills"."years_of_experience" is null or "career_skills"."years_of_experience" between 0 and 60)
);
--> statement-breakpoint
ALTER TABLE "career_certifications" ADD CONSTRAINT "career_certifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_certifications" ADD CONSTRAINT "career_certifications_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_certifications" ADD CONSTRAINT "career_certifications_profile_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."career_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_educations" ADD CONSTRAINT "career_educations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_educations" ADD CONSTRAINT "career_educations_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_educations" ADD CONSTRAINT "career_educations_profile_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."career_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_experiences" ADD CONSTRAINT "career_experiences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_experiences" ADD CONSTRAINT "career_experiences_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_experiences" ADD CONSTRAINT "career_experiences_profile_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."career_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_projects" ADD CONSTRAINT "career_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_projects" ADD CONSTRAINT "career_projects_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_projects" ADD CONSTRAINT "career_projects_profile_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."career_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_source_document_version_id_document_versions_id_fk" FOREIGN KEY ("source_document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_profile_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."career_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_certifications_user_profile_idx" ON "career_certifications" USING btree ("user_id","profile_id","issue_date");--> statement-breakpoint
CREATE INDEX "career_educations_user_profile_idx" ON "career_educations" USING btree ("user_id","profile_id","graduation_year");--> statement-breakpoint
CREATE INDEX "career_experiences_user_profile_idx" ON "career_experiences" USING btree ("user_id","profile_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "career_profiles_user_uq" ON "career_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "career_projects_user_profile_idx" ON "career_projects" USING btree ("user_id","profile_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "career_skills_profile_norm_uq" ON "career_skills" USING btree ("profile_id","normalized_name");--> statement-breakpoint
CREATE INDEX "career_skills_user_cat_idx" ON "career_skills" USING btree ("user_id","category");