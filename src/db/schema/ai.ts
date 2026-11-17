import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import type { AiUsageMetadata } from "@/lib/domain/ai";
import { timestamps, userId } from "./core";
import {
  aiFeedbackActionEnum,
  aiJobStatusEnum,
  aiLocaleEnum,
  aiLocalityEnum,
  aiPrivacyModeEnum,
  aiProviderEnum,
  aiSourceTypeEnum,
  aiTaskTypeEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// 1. Prompt Versions (Registry of versioned ID / EN AI prompt templates)
// ---------------------------------------------------------------------------
export const aiPromptVersions = pgTable(
  "ai_prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    locale: aiLocaleEnum("locale").notNull().default("en"),
    version: text("version").notNull(),
    templateHash: text("template_hash").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("ai_prompt_versions_task_locale_ver_uq").on(
      t.taskType,
      t.locale,
      t.version,
    ),
    index("ai_prompt_versions_task_active_idx").on(
      t.taskType,
      t.locale,
      t.isActive,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 2. AI Analysis Jobs (Async / auditable execution lifecycle & consent gate)
// ---------------------------------------------------------------------------
export const aiAnalysisJobs = pgTable(
  "ai_analysis_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    provider: aiProviderEnum("provider").notNull(),
    locality: aiLocalityEnum("locality").notNull(),
    model: text("model").notNull(),
    promptVersionId: uuid("prompt_version_id").references(
      () => aiPromptVersions.id,
      { onDelete: "set null" },
    ),
    promptVersionTag: text("prompt_version_tag").notNull(),
    locale: aiLocaleEnum("locale").notNull().default("en"),
    privacyModeAtRun: aiPrivacyModeEnum("privacy_mode_at_run").notNull(),
    containsPrivateDocuments: boolean("contains_private_documents")
      .notNull()
      .default(false),
    consentRequired: boolean("consent_required").notNull().default(false),
    consentGranted: boolean("consent_granted").notNull().default(false),
    consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }),
    inputHash: text("input_hash").notNull(),
    status: aiJobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    pricingKey: text("pricing_key"),
    creditCost: integer("credit_cost"),
    creditReservationId: uuid("credit_reservation_id"),
    usageMetadata: jsonb("usage_metadata").$type<AiUsageMetadata | null>(),
    /** Stored only while awaiting user consent so the job can be resumed cleanly, then cleared. */
    pendingTaskRequest: jsonb("pending_task_request").$type<Record<
      string,
      unknown
    > | null>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("ai_analysis_jobs_id_user_uq").on(t.id, t.userId),
    index("ai_analysis_jobs_user_status_idx").on(
      t.userId,
      t.status,
      t.createdAt,
    ),
    index("ai_analysis_jobs_user_task_hash_idx").on(
      t.userId,
      t.taskType,
      t.inputHash,
    ),
    check("ai_analysis_jobs_attempts_ck", sql`${t.attempts} >= 0`),
    check("ai_analysis_jobs_max_attempts_ck", sql`${t.maxAttempts} between 1 and 5`),
  ],
);

// ---------------------------------------------------------------------------
// 3. AI Career Analyses (Zod-validated outputs, isolated from verified career tables)
// ---------------------------------------------------------------------------
export const aiCareerAnalyses = pgTable(
  "ai_career_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    provider: aiProviderEnum("provider").notNull(),
    model: text("model").notNull(),
    promptVersionTag: text("prompt_version_tag").notNull(),
    locale: aiLocaleEnum("locale").notNull().default("en"),
    inputHash: text("input_hash").notNull(),
    schemaVersion: text("schema_version").notNull().default("1.0"),
    overallScore: smallint("overall_score"),
    summaryText: text("summary_text"),
    resultPayload: jsonb("result_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    ...timestamps,
  },
  (t) => [
    unique("ai_career_analyses_id_user_uq").on(t.id, t.userId),
    uniqueIndex("ai_career_analyses_job_uq").on(t.jobId),
    foreignKey({
      name: "ai_career_analyses_job_fk",
      columns: [t.jobId, t.userId],
      foreignColumns: [aiAnalysisJobs.id, aiAnalysisJobs.userId],
    }).onDelete("cascade"),
    index("ai_career_analyses_user_task_idx").on(
      t.userId,
      t.taskType,
      t.createdAt,
    ),
    check(
      "ai_career_analyses_score_ck",
      sql`${t.overallScore} is null or ${t.overallScore} between 0 and 100`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4. AI Analysis Sources (Traceability & untrusted-input provenance per job/analysis)
// ---------------------------------------------------------------------------
export const aiAnalysisSources = pgTable(
  "ai_analysis_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    analysisId: uuid("analysis_id"),
    sourceType: aiSourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id"),
    sourceLabel: text("source_label"),
    sourceHash: text("source_hash").notNull(),
    isUntrustedExternal: boolean("is_untrusted_external")
      .notNull()
      .default(false),
    injectionSignalCount: integer("injection_signal_count")
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "ai_analysis_sources_job_fk",
      columns: [t.jobId, t.userId],
      foreignColumns: [aiAnalysisJobs.id, aiAnalysisJobs.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_analysis_sources_analysis_fk",
      columns: [t.analysisId, t.userId],
      foreignColumns: [aiCareerAnalyses.id, aiCareerAnalyses.userId],
    }).onDelete("cascade"),
    index("ai_analysis_sources_job_idx").on(t.jobId),
    index("ai_analysis_sources_analysis_idx").on(t.analysisId),
    index("ai_analysis_sources_user_entity_idx").on(
      t.userId,
      t.sourceType,
      t.sourceId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 5. AI Feedback (User ratings, review decisions & hallucination reports)
// ---------------------------------------------------------------------------
export const aiFeedback = pgTable(
  "ai_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    analysisId: uuid("analysis_id").notNull(),
    rating: smallint("rating"),
    helpful: boolean("helpful"),
    actionTaken: aiFeedbackActionEnum("action_taken")
      .notNull()
      .default("comment_only"),
    comment: text("comment"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "ai_feedback_analysis_fk",
      columns: [t.analysisId, t.userId],
      foreignColumns: [aiCareerAnalyses.id, aiCareerAnalyses.userId],
    }).onDelete("cascade"),
    index("ai_feedback_user_analysis_idx").on(t.userId, t.analysisId),
    check(
      "ai_feedback_rating_ck",
      sql`${t.rating} is null or ${t.rating} between 1 and 5`,
    ),
  ],
);
