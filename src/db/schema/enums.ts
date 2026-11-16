import { pgEnum } from "drizzle-orm/pg-core";
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
export const followUpTypeEnum = pgEnum("follow_up_type", FOLLOW_UP_TYPES);
export const followUpStatusEnum = pgEnum("follow_up_status", FOLLOW_UP_STATUSES);
