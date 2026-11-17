/**
 * Application Archive domain rules and types.
 *
 * Pure, isomorphic helpers used by DB schema enums, server services, and UI.
 */

import { addCalendarDays, daysBetween } from "./business-days";
import type { Outcome, StageType } from "./stages";

export const ARCHIVE_OUTCOMES = [
  "rejected",
  "withdrawn",
  "hired",
  "no_response",
  "closed",
] as const;
export type ArchiveOutcome = (typeof ARCHIVE_OUTCOMES)[number];

export const ARCHIVE_OUTCOME_LABELS: Record<ArchiveOutcome, string> = {
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  hired: "Hired",
  no_response: "No Response",
  closed: "Closed",
};

export const ARCHIVE_CLOSURE_SOURCES = [
  "auto_stage_transition",
  "manual_archive",
  "email_confirmation",
  "offer_decision",
  "no_response_confirmation",
  "sample",
] as const;
export type ArchiveClosureSource = (typeof ARCHIVE_CLOSURE_SOURCES)[number];

export const ARCHIVE_CLOSURE_SOURCE_LABELS: Record<ArchiveClosureSource, string> = {
  auto_stage_transition: "Auto-archived on terminal stage",
  manual_archive: "Manual closure & archive",
  email_confirmation: "Confirmed from recruitment email",
  offer_decision: "Offer decision",
  no_response_confirmation: "Confirmed no response",
  sample: "Sample data",
};

export const CLOSURE_RECORD_STATUSES = ["archived", "restored"] as const;
export type ClosureRecordStatus = (typeof CLOSURE_RECORD_STATUSES)[number];

export const RETENTION_PRESET_DAYS = [
  { label: "Keep indefinitely", value: null },
  { label: "6 months (180 days)", value: 180 },
  { label: "1 year (365 days)", value: 365 },
  { label: "2 years (730 days - UU PDP recommended)", value: 730 },
  { label: "3 years (1095 days)", value: 1095 },
] as const;

export function mapToArchiveOutcome(params: {
  stageType?: StageType | null;
  outcome?: Outcome | null;
  explicitOutcome?: ArchiveOutcome | null;
}): ArchiveOutcome {
  if (params.explicitOutcome) return params.explicitOutcome;
  if (params.stageType === "rejected" || params.outcome === "unsuccessful") {
    return "rejected";
  }
  if (params.stageType === "withdrawn" || params.outcome === "withdrawn") {
    return "withdrawn";
  }
  if (params.stageType === "hired" || params.outcome === "successful") {
    return "hired";
  }
  if (params.stageType === "no_response" || params.outcome === "no_response") {
    return "no_response";
  }
  return "closed";
}

export function archiveOutcomeToAppOutcome(archiveOutcome: ArchiveOutcome): Outcome {
  switch (archiveOutcome) {
    case "rejected":
      return "unsuccessful";
    case "withdrawn":
      return "withdrawn";
    case "hired":
      return "successful";
    case "no_response":
      return "no_response";
    case "closed":
      return "closed";
  }
}

export function archiveOutcomeToStageType(archiveOutcome: ArchiveOutcome): StageType | null {
  switch (archiveOutcome) {
    case "rejected":
      return "rejected";
    case "withdrawn":
      return "withdrawn";
    case "hired":
      return "hired";
    case "no_response":
      return "no_response";
    case "closed":
      return null;
  }
}

export function computeRetainUntil(
  closedOn: string,
  retentionDays: number | null | undefined,
): string | null {
  if (!retentionDays || retentionDays <= 0) return null;
  return addCalendarDays(closedOn, retentionDays);
}

export type RetentionState = "indefinite" | "active" | "expiring_soon" | "expired";

export function evaluateRetentionState(
  retainUntil: string | null | undefined,
  todayIso: string,
): RetentionState {
  if (!retainUntil) return "indefinite";
  const remainingDays = daysBetween(todayIso, retainUntil);
  if (remainingDays < 0) return "expired";
  if (remainingDays <= 30) return "expiring_soon";
  return "active";
}

export interface SnapshotStatusHistoryItem {
  id: string;
  fromStageId: string | null;
  fromStageName: string | null;
  toStageId: string;
  toStageName: string;
  toStageType: string;
  toStageColor: string;
  effectiveOn: string;
  recordedAt: string;
  source: string;
  reason: string | null;
  note: string | null;
}

export interface SnapshotCommunicationItem {
  id: string;
  source: string;
  channel: string;
  direction: string;
  sender: string | null;
  recipient: string | null;
  subject: string;
  snippet: string | null;
  occurredAt: string;
  classification: string;
  confidence: number | null;
}

export interface SnapshotInterviewItem {
  id: string;
  interviewType: string;
  startsAt: string;
  durationMinutes: number;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  interviewerPosition: string | null;
  notes: string | null;
  questions: string | null;
  preparationNotes: string | null;
  feedback: string | null;
  result: string;
  status: string;
}

export interface SnapshotAssessmentItem {
  id: string;
  assessmentType: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  score: string | null;
  maxScore: string | null;
  result: string;
  notes: string | null;
}

export interface SnapshotOfferItem {
  id: string;
  positionTitle: string;
  baseSalary: number | null;
  currency: string;
  salaryPeriod: string;
  benefits: string | null;
  joiningDate: string | null;
  offerReceivedOn: string;
  responseDeadline: string | null;
  decision: string;
  decidedOn: string | null;
  notes: string | null;
}

export interface SnapshotFollowUpItem {
  id: string;
  type: string;
  title: string;
  sequenceNo: number;
  dueOn: string;
  status: string;
  completedAt: string | null;
  note: string | null;
}

export interface SnapshotDocumentItem {
  documentId: string | null;
  documentVersionId: string | null;
  role: string;
  documentCategory: string | null;
  documentTitle: string;
  versionNo: number | null;
  versionLabel: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  notes: string | null;
}

export interface ApplicationArchiveSnapshotPayload {
  schemaVersion: 1;
  application: {
    id: string;
    code: string;
    submittedOn: string;
    closedOn: string;
    outcome: Outcome;
    closureOutcome: ArchiveOutcome;
    submissionMethod: string;
    platformName: string | null;
    applicationUrl: string | null;
    externalReferenceId: string | null;
    confirmationReference: string | null;
    cvVersionLabel: string | null;
    coverLetterVersionLabel: string | null;
    recruiterName: string | null;
    recruiterEmail: string | null;
    recruiterContact: string | null;
    expectedSalary: number | null;
    currency: string;
    jobCategory: string | null;
    attemptNumber: number;
    reapplyReason: string | null;
    notes: string | null;
    stageAtClosure: {
      id: string;
      name: string;
      stageType: string;
      color: string;
    };
  };
  vacancy: {
    id: string;
    code: string;
    title: string;
    department: string | null;
    industry: string | null;
    location: string | null;
    employmentType: string | null;
    workArrangement: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string;
    salaryPeriod: string;
    url: string | null;
    qualifications: string | null;
    description: string | null;
    skills: string[];
    suitabilityScore: number | null;
    notes: string | null;
  };
  company: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    location: string | null;
    size: string | null;
  };
  suitabilityEvaluation: {
    skillsScore: number | null;
    experienceScore: number | null;
    educationScore: number | null;
    salaryScore: number | null;
    locationScore: number | null;
    growthScore: number | null;
    overallScore: number | null;
    notes: string | null;
  } | null;
  statusHistory: SnapshotStatusHistoryItem[];
  communications: SnapshotCommunicationItem[];
  interviews: SnapshotInterviewItem[];
  assessments: SnapshotAssessmentItem[];
  offer: SnapshotOfferItem | null;
  followUpTasks: SnapshotFollowUpItem[];
  documents: SnapshotDocumentItem[];
}
