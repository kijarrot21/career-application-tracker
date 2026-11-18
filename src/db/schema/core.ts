import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import {
  aiPreferredProviderEnum,
  aiPrivacyModeEnum,
  educationLevelEnum,
  employmentTypeEnum,
  jobPriorityEnum,
  salaryPeriodEnum,
  searchStatusEnum,
  stageTypeEnum,
  triageStatusEnum,
  workArrangementEnum,
} from "./enums";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@/lib/domain/onboarding";
import type { Weights, Criterion, Suggestion } from "@/lib/domain/suitability";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
export { timestamps };

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
export { userId };

// ---------------------------------------------------------------------------
// User settings and career profile (1:1 with user)
// ---------------------------------------------------------------------------
export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    preferredLocale: text("preferred_locale").notNull().default("id-ID"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    currency: text("currency").notNull().default("IDR"),
    searchStatus: searchStatusEnum("search_status").notNull().default("actively_searching"),
    // Profile used for suitability suggestions
    headline: text("headline"),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    yearsExperience: smallint("years_experience"),
    educationLevel: educationLevelEnum("education_level"),
    expectedSalaryMin: bigint("expected_salary_min", { mode: "number" }),
    expectedSalaryMax: bigint("expected_salary_max", { mode: "number" }),
    preferredLocations: text("preferred_locations").array().notNull().default(sql`'{}'::text[]`),
    preferredArrangements: text("preferred_arrangements").array().notNull().default(sql`'{}'::text[]`),
    // Follow-up rules (business days). Final = 0 disables the final follow-up.
    followUpFirstDays: smallint("follow_up_first_days").notNull().default(5),
    followUpSecondDays: smallint("follow_up_second_days").notNull().default(5),
    followUpFinalDays: smallint("follow_up_final_days").notNull().default(10),
    noResponseDays: smallint("no_response_days").notNull().default(30),
    holidays: text("holidays").array().notNull().default(sql`'{}'::text[]`),
    suitabilityWeights: jsonb("suitability_weights").$type<Weights>(),
    /** UX-only onboarding preferences; never a source of business progress. */
    onboardingState: jsonb("onboarding_state")
      .$type<OnboardingState>()
      .notNull()
      .default(DEFAULT_ONBOARDING_STATE),
    /** null = automatic (include sample data only while there are no real applications). */
    includeSampleInAnalytics: boolean("include_sample_in_analytics"),
    autoArchiveOnTerminal: boolean("auto_archive_on_terminal").notNull().default(true),
    archiveRetentionDays: integer("archive_retention_days"),
    archiveAutoDeleteExpired: boolean("archive_auto_delete_expired").notNull().default(false),
    aiPrivacyMode: aiPrivacyModeEnum("ai_privacy_mode")
      .notNull()
      .default("ask_before_each"),
    aiPreferredProvider: aiPreferredProviderEnum("ai_preferred_provider")
      .notNull()
      .default("auto"),
    aiOllamaEndpoint: text("ai_ollama_endpoint"),
    aiOllamaModel: text("ai_ollama_model"),
    aiCloudDocumentConsent: boolean("ai_cloud_document_consent")
      .notNull()
      .default(false),
    nextApplicationSeq: integer("next_application_seq").notNull().default(1),
    nextJobSeq: integer("next_job_seq").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    check("user_settings_follow_up_days_ck", sql`${t.followUpFirstDays} between 1 and 60 and ${t.followUpSecondDays} between 1 and 60 and ${t.followUpFinalDays} between 0 and 90`),
    check("user_settings_no_response_ck", sql`${t.noResponseDays} between 7 and 365`),
    check(
      "user_settings_archive_retention_ck",
      sql`${t.archiveRetentionDays} is null or ${t.archiveRetentionDays} between 30 and 3650`,
    ),
    check(
      "user_settings_locale_len_ck",
      sql`length(${t.preferredLocale}) between 2 and 16`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    industry: text("industry"),
    website: text("website"),
    location: text("location"),
    size: text("size"),
    notes: text("notes"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("companies_id_user_uq").on(t.id, t.userId),
    uniqueIndex("companies_user_normalized_name_uq").on(t.userId, t.normalizedName),
  ],
);

// ---------------------------------------------------------------------------
// Recruiter / HR contacts
// ---------------------------------------------------------------------------
export const recruiterContacts = pgTable(
  "recruiter_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    companyId: uuid("company_id"),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("recruiter_contacts_id_user_uq").on(t.id, t.userId),
    foreignKey({
      name: "recruiter_contacts_company_fk",
      columns: [t.companyId, t.userId],
      foreignColumns: [companies.id, companies.userId],
    }).onDelete("cascade"),
    index("recruiter_contacts_user_company_idx").on(t.userId, t.companyId),
  ],
);

// ---------------------------------------------------------------------------
// Job sources (system rows have user_id = null)
// ---------------------------------------------------------------------------
export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    domains: text("domains").array().notNull().default(sql`'{}'::text[]`),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("job_sources_system_key_uq").on(t.key).where(sql`user_id is null`),
    uniqueIndex("job_sources_user_key_uq").on(t.userId, t.key).where(sql`user_id is not null`),
  ],
);

// ---------------------------------------------------------------------------
// Job vacancies
// ---------------------------------------------------------------------------
export const jobVacancies = pgTable(
  "job_vacancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    code: text("code").notNull(),
    companyId: uuid("company_id").notNull(),
    sourceId: uuid("source_id").references(() => jobSources.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    department: text("department"),
    industry: text("industry"),
    location: text("location"),
    employmentType: employmentTypeEnum("employment_type"),
    workArrangement: workArrangementEnum("work_arrangement"),
    salaryMin: bigint("salary_min", { mode: "number" }),
    salaryMax: bigint("salary_max", { mode: "number" }),
    currency: text("currency").notNull().default("IDR"),
    salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("month"),
    requiredExperienceYears: smallint("required_experience_years"),
    requiredEducation: educationLevelEnum("required_education"),
    qualifications: text("qualifications"),
    description: text("description"),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    url: text("url"),
    normalizedUrl: text("normalized_url"),
    externalJobId: text("external_job_id"),
    deadline: date("deadline", { mode: "string" }),
    discoveredOn: date("discovered_on", { mode: "string" }).notNull(),
    priority: jobPriorityEnum("priority").notNull().default("medium"),
    triageStatus: triageStatusEnum("triage_status").notNull().default("new"),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    suitabilityScore: smallint("suitability_score"),
    notes: text("notes"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("job_vacancies_id_user_uq").on(t.id, t.userId),
    uniqueIndex("job_vacancies_user_code_uq").on(t.userId, t.code),
    uniqueIndex("job_vacancies_user_url_uq").on(t.userId, t.normalizedUrl).where(sql`normalized_url is not null`),
    foreignKey({
      name: "job_vacancies_company_fk",
      columns: [t.companyId, t.userId],
      foreignColumns: [companies.id, companies.userId],
    }).onDelete("cascade"),
    index("job_vacancies_user_triage_idx").on(t.userId, t.triageStatus),
    check("job_vacancies_salary_ck", sql`${t.salaryMin} is null or ${t.salaryMax} is null or ${t.salaryMin} <= ${t.salaryMax}`),
    check("job_vacancies_salary_nonneg_ck", sql`coalesce(${t.salaryMin}, 0) >= 0 and coalesce(${t.salaryMax}, 0) >= 0`),
    check("job_vacancies_score_ck", sql`${t.suitabilityScore} is null or ${t.suitabilityScore} between 0 and 100`),
    check("job_vacancies_experience_ck", sql`${t.requiredExperienceYears} is null or ${t.requiredExperienceYears} between 0 and 60`),
  ],
);

// ---------------------------------------------------------------------------
// Suitability evaluation (1:1 with vacancy)
// ---------------------------------------------------------------------------
export const suitabilityEvaluations = pgTable(
  "suitability_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    vacancyId: uuid("vacancy_id").notNull(),
    skillsScore: smallint("skills_score"),
    experienceScore: smallint("experience_score"),
    educationScore: smallint("education_score"),
    salaryScore: smallint("salary_score"),
    locationScore: smallint("location_score"),
    growthScore: smallint("growth_score"),
    suggestions: jsonb("suggestions").$type<Record<Criterion, Suggestion>>(),
    weights: jsonb("weights").$type<Weights>().notNull(),
    overallScore: smallint("overall_score"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("suitability_vacancy_uq").on(t.vacancyId),
    foreignKey({
      name: "suitability_vacancy_fk",
      columns: [t.vacancyId, t.userId],
      foreignColumns: [jobVacancies.id, jobVacancies.userId],
    }).onDelete("cascade"),
    check(
      "suitability_scores_ck",
      sql`coalesce(${t.skillsScore},0) between 0 and 100 and coalesce(${t.experienceScore},0) between 0 and 100 and coalesce(${t.educationScore},0) between 0 and 100 and coalesce(${t.salaryScore},0) between 0 and 100 and coalesce(${t.locationScore},0) between 0 and 100 and coalesce(${t.growthScore},0) between 0 and 100`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Application stages (per-user, customizable)
// ---------------------------------------------------------------------------
export const applicationStages = pgTable(
  "application_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    stageType: stageTypeEnum("stage_type").notNull(),
    sortOrder: integer("sort_order").notNull(),
    color: text("color").notNull().default("slate"),
    isSystem: boolean("is_system").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("application_stages_id_user_uq").on(t.id, t.userId),
    uniqueIndex("application_stages_user_key_uq").on(t.userId, t.key),
    index("application_stages_user_order_idx").on(t.userId, t.sortOrder),
  ],
);
