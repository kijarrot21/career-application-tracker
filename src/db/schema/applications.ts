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
import {
  applicationStages,
  jobSources,
  jobVacancies,
  recruiterContacts,
  timestamps,
  userId,
} from "./core";
import {
  assessmentTypeEnum,
  commChannelEnum,
  commDirectionEnum,
  commSourceEnum,
  documentCategoryEnum,
  emailClassificationEnum,
  emailLinkStatusEnum,
  emailProviderEnum,
  followUpStatusEnum,
  followUpTypeEnum,
  historySourceEnum,
  interviewResultEnum,
  interviewStatusEnum,
  interviewTypeEnum,
  offerDecisionEnum,
  outcomeEnum,
  salaryPeriodEnum,
  submissionMethodEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// Documents & Document Versions (Phase 4 storage, referenced by Applications)
// ---------------------------------------------------------------------------
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    category: documentCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("documents_id_user_uq").on(t.id, t.userId),
    index("documents_user_category_idx").on(t.userId, t.category),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    documentId: uuid("document_id").notNull(),
    versionNo: integer("version_no").notNull().default(1),
    label: text("label").notNull(),
    storageKey: text("storage_key"),
    filename: text("filename"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("document_versions_id_user_uq").on(t.id, t.userId),
    uniqueIndex("document_versions_doc_ver_uq").on(t.documentId, t.versionNo),
    foreignKey({
      name: "document_versions_doc_fk",
      columns: [t.documentId, t.userId],
      foreignColumns: [documents.id, documents.userId],
    }).onDelete("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Applications (Core Entity)
// ---------------------------------------------------------------------------
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    code: text("code").notNull(),
    vacancyId: uuid("vacancy_id").notNull(),
    currentStageId: uuid("current_stage_id").notNull(),
    outcome: outcomeEnum("outcome").notNull().default("active"),
    submittedOn: date("submitted_on", { mode: "string" }).notNull(),
    platformSourceId: uuid("platform_source_id").references(() => jobSources.id, {
      onDelete: "set null",
    }),
    submissionMethod: submissionMethodEnum("submission_method").notNull().default("platform"),
    applicationUrl: text("application_url"),
    externalReferenceId: text("external_reference_id"),
    confirmationReference: text("confirmation_reference"),
    cvVersionLabel: text("cv_version_label"),
    coverLetterVersionLabel: text("cover_letter_version_label"),
    cvVersionId: uuid("cv_version_id"),
    coverLetterVersionId: uuid("cover_letter_version_id"),
    primaryRecruiterId: uuid("primary_recruiter_id"),
    recruiterName: text("recruiter_name"),
    recruiterEmail: text("recruiter_email"),
    recruiterContact: text("recruiter_contact"),
    expectedSalary: bigint("expected_salary", { mode: "number" }),
    currency: text("currency").notNull().default("IDR"),
    jobCategory: text("job_category"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    reapplyReason: text("reapply_reason"),
    nextFollowUpOn: date("next_follow_up_on", { mode: "string" }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: date("closed_at", { mode: "string" }),
    notes: text("notes"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("applications_id_user_uq").on(t.id, t.userId),
    uniqueIndex("applications_user_code_uq").on(t.userId, t.code),
    // Prevent accidental duplicate active applications to the same vacancy
    uniqueIndex("applications_one_active_per_vacancy_uq")
      .on(t.vacancyId)
      .where(sql`${t.outcome} = 'active'`),
    uniqueIndex("applications_vacancy_attempt_uq").on(t.vacancyId, t.attemptNumber),
    foreignKey({
      name: "applications_vacancy_fk",
      columns: [t.vacancyId, t.userId],
      foreignColumns: [jobVacancies.id, jobVacancies.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "applications_stage_fk",
      columns: [t.currentStageId, t.userId],
      foreignColumns: [applicationStages.id, applicationStages.userId],
    }),
    foreignKey({
      name: "applications_recruiter_fk",
      columns: [t.primaryRecruiterId, t.userId],
      foreignColumns: [recruiterContacts.id, recruiterContacts.userId],
    }).onDelete("set null"),
    index("applications_user_stage_idx").on(t.userId, t.currentStageId),
    index("applications_user_outcome_idx").on(t.userId, t.outcome),
    check("applications_attempt_ck", sql`${t.attemptNumber} >= 1`),
  ],
);

// ---------------------------------------------------------------------------
// Application Status History (Append-Only Audit of Stage Transitions)
// ---------------------------------------------------------------------------
export const applicationStatusHistory = pgTable(
  "application_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    fromStageId: uuid("from_stage_id"),
    toStageId: uuid("to_stage_id").notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    source: historySourceEnum("source").notNull().default("manual"),
    reason: text("reason"),
    note: text("note"),
    emailId: uuid("email_id"),
  },
  (t) => [
    foreignKey({
      name: "app_history_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "app_history_to_stage_fk",
      columns: [t.toStageId, t.userId],
      foreignColumns: [applicationStages.id, applicationStages.userId],
    }),
    index("app_history_app_effective_idx").on(t.applicationId, t.effectiveOn, t.recordedAt),
  ],
);

// ---------------------------------------------------------------------------
// Application Documents Link Table
// ---------------------------------------------------------------------------
export const applicationDocuments = pgTable(
  "application_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    role: text("role").notNull().default("other"), // cv | cover_letter | other
    ...timestamps,
  },
  (t) => [
    uniqueIndex("application_documents_app_ver_uq").on(t.applicationId, t.documentVersionId),
    foreignKey({
      name: "application_documents_app_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "application_documents_ver_fk",
      columns: [t.documentVersionId, t.userId],
      foreignColumns: [documentVersions.id, documentVersions.userId],
    }).onDelete("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Email Accounts & Communications (Manual Log in Phase 2, OAuth in Phase 3)
// ---------------------------------------------------------------------------
export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    provider: emailProviderEnum("provider").notNull(),
    email: text("email").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    syncCursor: text("sync_cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    status: text("status").notNull().default("connected"),
    ...timestamps,
  },
  (t) => [
    unique("email_accounts_id_user_uq").on(t.id, t.userId),
    uniqueIndex("email_accounts_user_provider_email_uq").on(t.userId, t.provider, t.email),
  ],
);

export const emailCommunications = pgTable(
  "email_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    emailAccountId: uuid("email_account_id"),
    source: commSourceEnum("source").notNull().default("manual"),
    channel: commChannelEnum("channel").notNull().default("email"),
    providerMessageId: text("provider_message_id"),
    threadId: text("thread_id"),
    direction: commDirectionEnum("direction").notNull().default("inbound"),
    sender: text("sender"),
    recipient: text("recipient"),
    subject: text("subject").notNull(),
    snippet: text("snippet"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    classification: emailClassificationEnum("classification")
      .notNull()
      .default("other_recruitment"),
    confidence: smallint("confidence"),
    classifierReasons: text("classifier_reasons").array().notNull().default(sql`'{}'::text[]`),
    detectedCompany: text("detected_company"),
    detectedPosition: text("detected_position"),
    applicationId: uuid("application_id"),
    linkStatus: emailLinkStatusEnum("link_status").notNull().default("confirmed"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("email_comm_provider_msg_uq")
      .on(t.userId, t.source, t.providerMessageId)
      .where(sql`provider_message_id is not null`),
    foreignKey({
      name: "email_comm_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
    index("email_comm_user_app_idx").on(t.userId, t.applicationId, t.occurredAt),
  ],
);

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    stageId: uuid("stage_id"),
    interviewType: interviewTypeEnum("interview_type").notNull().default("hr"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: smallint("duration_minutes").notNull().default(45),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    location: text("location"),
    meetingUrl: text("meeting_url"),
    interviewerName: text("interviewer_name"),
    interviewerPosition: text("interviewer_position"),
    interviewerContact: text("interviewer_contact"),
    notes: text("notes"),
    questions: text("questions"),
    preparationNotes: text("preparation_notes"),
    feedback: text("feedback"),
    result: interviewResultEnum("result").notNull().default("pending"),
    status: interviewStatusEnum("status").notNull().default("scheduled"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "interviews_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
    index("interviews_user_starts_idx").on(t.userId, t.startsAt),
  ],
);

// ---------------------------------------------------------------------------
// Assessments & Job Offers
// ---------------------------------------------------------------------------
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    assessmentType: assessmentTypeEnum("assessment_type").notNull().default("technical"),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    score: text("score"),
    maxScore: text("max_score"),
    result: interviewResultEnum("result").notNull().default("pending"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "assessments_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
  ],
);

export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    positionTitle: text("position_title").notNull(),
    baseSalary: bigint("base_salary", { mode: "number" }),
    currency: text("currency").notNull().default("IDR"),
    salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("month"),
    benefits: text("benefits"),
    joiningDate: date("joining_date", { mode: "string" }),
    offerReceivedOn: date("offer_received_on", { mode: "string" }).notNull(),
    responseDeadline: date("response_deadline", { mode: "string" }),
    decision: offerDecisionEnum("decision").notNull().default("pending"),
    decidedOn: date("decided_on", { mode: "string" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("job_offers_application_uq").on(t.applicationId),
    foreignKey({
      name: "job_offers_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Follow-up Tasks, Notifications & Audit Logs
// ---------------------------------------------------------------------------
export const followUpTasks = pgTable(
  "follow_up_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id"),
    type: followUpTypeEnum("type").notNull().default("follow_up"),
    title: text("title").notNull(),
    sequenceNo: smallint("sequence_no").notNull().default(1),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    status: followUpStatusEnum("status").notNull().default("open"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    autoGenerated: boolean("auto_generated").notNull().default(false),
    note: text("note"),
    isSample: boolean("is_sample").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "follow_up_tasks_application_fk",
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
    }).onDelete("cascade"),
    index("follow_up_tasks_user_due_idx").on(t.userId, t.status, t.dueOn),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary"),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_user_created_idx").on(t.userId, t.createdAt)],
);
