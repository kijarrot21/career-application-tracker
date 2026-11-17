/**
 * Shared enumerations and display labels. Used by the database schema, Zod
 * validators, and UI so that values stay consistent everywhere.
 */

export const TRIAGE_STATUSES = ["new", "interested", "shortlisted", "not_interested", "archived"] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];
export const TRIAGE_LABELS: Record<TriageStatus, string> = {
  new: "New",
  interested: "Interested",
  shortlisted: "Shortlisted",
  not_interested: "Not Interested",
  archived: "Archived",
};

export const JOB_PRIORITIES = ["low", "medium", "high"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<JobPriority, string> = { low: "Low", medium: "Medium", high: "High" };

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "freelance", "temporary"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
  temporary: "Temporary",
};

export const WORK_ARRANGEMENTS = ["onsite", "hybrid", "remote"] as const;
export const WORK_ARRANGEMENT_LABELS: Record<(typeof WORK_ARRANGEMENTS)[number], string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const SALARY_PERIODS = ["month", "year", "hour", "project"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  month: "per month",
  year: "per year",
  hour: "per hour",
  project: "per project",
};

export const SUBMISSION_METHODS = ["platform", "company_portal", "email", "referral", "walk_in", "other"] as const;
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number];
export const SUBMISSION_METHOD_LABELS: Record<SubmissionMethod, string> = {
  platform: "Job platform (Easy Apply / Quick Apply)",
  company_portal: "Company career portal",
  email: "Email to recruiter",
  referral: "Referral",
  walk_in: "Walk-in / Job fair",
  other: "Other",
};

export const HISTORY_SOURCES = [
  "manual",
  "kanban",
  "submission",
  "correction",
  "reopen",
  "email_suggestion",
  "no_response_suggestion",
  "import",
  "sample",
] as const;
export type HistorySource = (typeof HISTORY_SOURCES)[number];
export const HISTORY_SOURCE_LABELS: Record<HistorySource, string> = {
  manual: "Manual update",
  kanban: "Moved on board",
  submission: "Submission recorded",
  correction: "Correction",
  reopen: "Reopened",
  email_suggestion: "Confirmed from email",
  no_response_suggestion: "Confirmed no response",
  import: "Imported",
  sample: "Sample data",
};

export const SEARCH_STATUSES = ["actively_searching", "open_to_offers", "paused", "hired"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];
export const SEARCH_STATUS_LABELS: Record<SearchStatus, string> = {
  actively_searching: "Actively searching",
  open_to_offers: "Open to offers",
  paused: "Search paused",
  hired: "Hired / Not searching",
};

export const COMM_SOURCES = ["gmail", "outlook", "manual"] as const;
export const EMAIL_PROVIDERS = ["gmail", "outlook"] as const;
export const COMM_CHANNELS = ["email", "phone", "whatsapp", "linkedin_message", "platform_message", "in_person", "other"] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];
export const COMM_CHANNEL_LABELS: Record<CommChannel, string> = {
  email: "Email",
  phone: "Phone call",
  whatsapp: "WhatsApp",
  linkedin_message: "LinkedIn message",
  platform_message: "Platform message",
  in_person: "In person",
  other: "Other",
};
export const COMM_DIRECTIONS = ["inbound", "outbound"] as const;
export type CommDirection = (typeof COMM_DIRECTIONS)[number];
export const COMM_DIRECTION_LABELS: Record<CommDirection, string> = {
  inbound: "From employer",
  outbound: "From me",
};

export const EMAIL_CLASSIFICATIONS = [
  "application_confirmation",
  "cv_screening",
  "interview_invitation",
  "assessment_invitation",
  "interview_follow_up",
  "rejection",
  "job_offer",
  "other_recruitment",
  "not_recruitment",
] as const;
export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];
export const EMAIL_CLASSIFICATION_LABELS: Record<EmailClassification, string> = {
  application_confirmation: "Application Confirmation",
  cv_screening: "CV Screening",
  interview_invitation: "Interview Invitation",
  assessment_invitation: "Assessment Invitation",
  interview_follow_up: "Interview Follow-up",
  rejection: "Rejection Notification",
  job_offer: "Job Offer",
  other_recruitment: "Other Recruitment Communication",
  not_recruitment: "Not Recruitment",
};
export const EMAIL_LINK_STATUSES = ["suggested", "confirmed", "unlinked", "ignored"] as const;

export const INTERVIEW_TYPES = ["hr", "technical", "user", "panel", "final", "assessment"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr: "HR Interview",
  technical: "Technical Interview",
  user: "User Interview",
  panel: "Panel Interview",
  final: "Final Interview",
  assessment: "Assessment",
};
export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "rescheduled"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};
export const INTERVIEW_RESULTS = ["pending", "passed", "failed", "no_show", "cancelled"] as const;
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];
export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Not passed",
  no_show: "No show",
  cancelled: "Cancelled",
};

export const ASSESSMENT_TYPES = ["technical", "psychometric", "case_study", "competency", "other"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  technical: "Technical / Coding Test",
  psychometric: "Psychometric / Aptitude Test",
  case_study: "Case Study / Take-Home Assignment",
  competency: "Competency Evaluation",
  other: "Other Assessment",
};

export const OFFER_DECISIONS = ["pending", "accepted", "declined", "rescinded"] as const;
export type OfferDecision = (typeof OFFER_DECISIONS)[number];
export const OFFER_DECISION_LABELS: Record<OfferDecision, string> = {
  pending: "Pending Decision",
  accepted: "Offer Accepted",
  declined: "Offer Declined",
  rescinded: "Offer Rescinded",
};

export const DOCUMENT_CATEGORIES = [
  "master_cv",
  "custom_cv",
  "cover_letter",
  "portfolio",
  "certificate",
  "transcript",
  "supporting",
  "interview_prep",
  "offer",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  master_cv: "Master CV",
  custom_cv: "Customized CV",
  cover_letter: "Cover Letter",
  portfolio: "Portfolio",
  certificate: "Certificates",
  transcript: "Academic Transcript",
  supporting: "Supporting Documents",
  interview_prep: "Interview Preparation Documents",
  offer: "Employment Offer",
};

export const FOLLOW_UP_TYPES = ["follow_up", "deadline", "interview_prep", "custom"] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];
export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  follow_up: "Follow up",
  deadline: "Application deadline",
  interview_prep: "Interview preparation",
  custom: "Task",
};
export const FOLLOW_UP_STATUSES = ["open", "done", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "EUR", "GBP", "AUD", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;
