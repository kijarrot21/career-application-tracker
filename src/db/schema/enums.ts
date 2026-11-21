import { pgEnum } from "drizzle-orm/pg-core";
import {
  AI_FEEDBACK_ACTIONS,
  AI_JOB_STATUSES,
  AI_LOCALES,
  AI_LOCALITIES,
  AI_PREFERRED_PROVIDERS,
  AI_PRIVACY_MODES,
  AI_PROVIDERS,
  AI_SOURCE_TYPES,
  AI_TASK_TYPES,
} from "@/lib/domain/ai";
import {
  ARCHIVE_CLOSURE_SOURCES,
  ARCHIVE_OUTCOMES,
  CLOSURE_RECORD_STATUSES,
} from "@/lib/domain/archive";
import {
  CAREER_LEVELS,
  PROFILE_DATA_SOURCES,
  SKILL_CATEGORIES,
  SKILL_PROFICIENCIES,
  VERIFICATION_STATUSES,
} from "@/lib/domain/career-profile";
import {
  CREDIT_LEDGER_ENTRY_TYPES,
  CREDIT_RESERVATION_STATUSES,
} from "@/lib/domain/credits";
import {
  PAYMENT_ENVIRONMENTS,
  PAYMENT_ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_TRANSACTION_STATUSES,
  PAYMENT_TRANSACTION_TYPES,
  WEBHOOK_PROCESSING_STATUSES,
} from "@/lib/domain/payments";
import {
  SYNC_CONFLICT_STATUSES,
  SYNC_DEVICE_STATUSES,
  SYNC_DIRECTIONS,
  SYNC_ENTITY_TYPES,
  SYNC_OPERATIONS,
  SYNC_OPERATION_MODES,
  SYNC_OUTBOX_STATUSES,
} from "@/lib/domain/sync";
import { OUTCOMES, STAGE_TYPES } from "@/lib/domain/stages";
import { EDUCATION_LEVELS } from "@/lib/domain/suitability";
import {
  COMM_CHANNELS,
  COMM_DIRECTIONS,
  EMAIL_CLASSIFICATIONS,
  EMPLOYMENT_TYPES,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_TYPES,
  HISTORY_SOURCES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  JOB_PRIORITIES,
  SALARY_PERIODS,
  SEARCH_STATUSES,
  SUBMISSION_METHODS,
  TRIAGE_STATUSES,
  WORK_ARRANGEMENTS,
  ASSESSMENT_TYPES,
  OFFER_DECISIONS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_PROCESSING_STATUSES,
  EMAIL_LINK_STATUSES,
  COMM_SOURCES,
  EMAIL_PROVIDERS,
} from "@/lib/constants";

export const stageTypeEnum = pgEnum("stage_type", STAGE_TYPES);
export const outcomeEnum = pgEnum("application_outcome", OUTCOMES);
export const educationLevelEnum = pgEnum("education_level", EDUCATION_LEVELS);
export const triageStatusEnum = pgEnum("triage_status", TRIAGE_STATUSES);
export const jobPriorityEnum = pgEnum("job_priority", JOB_PRIORITIES);
export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);
export const workArrangementEnum = pgEnum("work_arrangement", WORK_ARRANGEMENTS);
export const salaryPeriodEnum = pgEnum("salary_period", SALARY_PERIODS);
export const submissionMethodEnum = pgEnum("submission_method", SUBMISSION_METHODS);
export const historySourceEnum = pgEnum("history_source", HISTORY_SOURCES);
export const searchStatusEnum = pgEnum("search_status", SEARCH_STATUSES);
export const commSourceEnum = pgEnum("communication_source", COMM_SOURCES);
export const commChannelEnum = pgEnum("communication_channel", COMM_CHANNELS);
export const commDirectionEnum = pgEnum("communication_direction", COMM_DIRECTIONS);
export const emailClassificationEnum = pgEnum("email_classification", EMAIL_CLASSIFICATIONS);
export const emailLinkStatusEnum = pgEnum("email_link_status", EMAIL_LINK_STATUSES);
export const emailProviderEnum = pgEnum("email_provider", EMAIL_PROVIDERS);
export const interviewTypeEnum = pgEnum("interview_type", INTERVIEW_TYPES);
export const interviewStatusEnum = pgEnum("interview_status", INTERVIEW_STATUSES);
export const interviewResultEnum = pgEnum("interview_result", INTERVIEW_RESULTS);
export const assessmentTypeEnum = pgEnum("assessment_type", ASSESSMENT_TYPES);
export const offerDecisionEnum = pgEnum("offer_decision", OFFER_DECISIONS);
export const documentCategoryEnum = pgEnum("document_category", DOCUMENT_CATEGORIES);
export const documentProcessingStatusEnum = pgEnum(
  "document_processing_status",
  DOCUMENT_PROCESSING_STATUSES,
);
export const followUpTypeEnum = pgEnum("follow_up_type", FOLLOW_UP_TYPES);
export const followUpStatusEnum = pgEnum("follow_up_status", FOLLOW_UP_STATUSES);
export const closureOutcomeEnum = pgEnum("closure_outcome", ARCHIVE_OUTCOMES);
export const closureSourceEnum = pgEnum("closure_source", ARCHIVE_CLOSURE_SOURCES);
export const closureRecordStatusEnum = pgEnum(
  "closure_record_status",
  CLOSURE_RECORD_STATUSES,
);
export const careerLevelEnum = pgEnum("career_level", CAREER_LEVELS);
export const skillCategoryEnum = pgEnum("skill_category", SKILL_CATEGORIES);
export const skillProficiencyEnum = pgEnum(
  "skill_proficiency",
  SKILL_PROFICIENCIES,
);
export const verificationStatusEnum = pgEnum(
  "verification_status",
  VERIFICATION_STATUSES,
);
export const profileDataSourceEnum = pgEnum(
  "profile_data_source",
  PROFILE_DATA_SOURCES,
);
export const aiProviderEnum = pgEnum("ai_provider", AI_PROVIDERS);
export const aiPreferredProviderEnum = pgEnum(
  "ai_preferred_provider",
  AI_PREFERRED_PROVIDERS,
);
export const aiLocalityEnum = pgEnum("ai_locality", AI_LOCALITIES);
export const aiPrivacyModeEnum = pgEnum("ai_privacy_mode", AI_PRIVACY_MODES);
export const aiTaskTypeEnum = pgEnum("ai_task_type", AI_TASK_TYPES);
export const aiJobStatusEnum = pgEnum("ai_job_status", AI_JOB_STATUSES);
export const aiSourceTypeEnum = pgEnum("ai_source_type", AI_SOURCE_TYPES);
export const aiFeedbackActionEnum = pgEnum(
  "ai_feedback_action",
  AI_FEEDBACK_ACTIONS,
);
export const aiLocaleEnum = pgEnum("ai_locale", AI_LOCALES);
export const creditLedgerEntryTypeEnum = pgEnum(
  "credit_ledger_entry_type",
  CREDIT_LEDGER_ENTRY_TYPES,
);
export const creditReservationStatusEnum = pgEnum(
  "credit_reservation_status",
  CREDIT_RESERVATION_STATUSES,
);
export const paymentProviderEnum = pgEnum("payment_provider", PAYMENT_PROVIDERS);
export const paymentEnvironmentEnum = pgEnum(
  "payment_environment",
  PAYMENT_ENVIRONMENTS,
);
export const paymentOrderStatusEnum = pgEnum(
  "payment_order_status",
  PAYMENT_ORDER_STATUSES,
);
export const paymentTransactionTypeEnum = pgEnum(
  "payment_transaction_type",
  PAYMENT_TRANSACTION_TYPES,
);
export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  PAYMENT_TRANSACTION_STATUSES,
);
export const webhookProcessingStatusEnum = pgEnum(
  "webhook_processing_status",
  WEBHOOK_PROCESSING_STATUSES,
);
export const syncOperationModeEnum = pgEnum(
  "sync_operation_mode",
  SYNC_OPERATION_MODES,
);
export const syncDeviceStatusEnum = pgEnum(
  "sync_device_status",
  SYNC_DEVICE_STATUSES,
);
export const syncEntityTypeEnum = pgEnum(
  "sync_entity_type",
  SYNC_ENTITY_TYPES,
);
export const syncOperationEnum = pgEnum("sync_operation", SYNC_OPERATIONS);
export const syncOutboxStatusEnum = pgEnum(
  "sync_outbox_status",
  SYNC_OUTBOX_STATUSES,
);
export const syncConflictStatusEnum = pgEnum(
  "sync_conflict_status",
  SYNC_CONFLICT_STATUSES,
);
export const syncDirectionEnum = pgEnum("sync_direction", SYNC_DIRECTIONS);
