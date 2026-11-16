"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoveStageDialog } from "@/components/applications/move-stage-dialog";
import {
  OutcomeBadge,
  SampleBadge,
  StageBadge,
} from "@/components/ui/badges";
import {
  COMM_CHANNEL_LABELS,
  COMM_CHANNELS,
  COMM_DIRECTION_LABELS,
  COMM_DIRECTIONS,
  CURRENCIES,
  EMAIL_CLASSIFICATION_LABELS,
  EMAIL_CLASSIFICATIONS,
  FOLLOW_UP_TYPE_LABELS,
  FOLLOW_UP_TYPES,
  HISTORY_SOURCE_LABELS,
  INTERVIEW_RESULT_LABELS,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPES,
  OFFER_DECISION_LABELS,
  OFFER_DECISIONS,
  SALARY_PERIOD_LABELS,
  SALARY_PERIODS,
  SUBMISSION_METHOD_LABELS,
  SUBMISSION_METHODS,
  type CommChannel,
  type CommDirection,
  type Currency,
  type EmailClassification,
  type FollowUpType,
  type HistorySource,
  type InterviewResult,
  type InterviewStatus,
  type InterviewType,
  type OfferDecision,
  type SalaryPeriod,
  type SubmissionMethod,
} from "@/lib/constants";
import { addBusinessDays } from "@/lib/domain/business-days";
import { isTerminal, isVacancyLevel } from "@/lib/domain/stages";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  completeFollowUpTaskAction,
  createFollowUpTaskAction,
  deleteApplicationAction,
  logCommunicationAction,
  scheduleInterviewAction,
  snoozeFollowUpTaskAction,
  updateApplicationAction,
  updateInterviewOutcomeAction,
} from "@/server/actions/applications";
import {
  linkDocumentVersionToApplicationAction,
  unlinkDocumentVersionFromApplicationAction,
  upsertJobOfferAction,
} from "@/server/actions/career";
import type { getApplicationDetail } from "@/server/queries/applications";
import type { getApplicationCareerExtras } from "@/server/queries/career";

type AppDetailData = NonNullable<
  Awaited<ReturnType<typeof getApplicationDetail>>
>;
type CareerExtrasData = Awaited<ReturnType<typeof getApplicationCareerExtras>>;

type TabKey =
  | "overview"
  | "timeline"
  | "communications"
  | "interviews"
  | "followups"
  | "documents"
  | "offer";

export function ApplicationDetailClient({
  app,
  sources,
  careerExtras,
}: {
  app: AppDetailData;
  sources: { id: string; key: string; name: string }[];
  careerExtras?: CareerExtrasData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialTab = (searchParams.get("tab") as TabKey) || "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetMoveStageId, setTargetMoveStageId] = useState<
    string | undefined
  >(undefined);

  // Overview edit state
  const [submittedOn, setSubmittedOn] = useState(app.submittedOn);
  const [platformSourceId, setPlatformSourceId] = useState(
    app.platformSourceId ?? "",
  );
  const [submissionMethod, setSubmissionMethod] = useState<SubmissionMethod>(
    app.submissionMethod as SubmissionMethod,
  );
  const [applicationUrl, setApplicationUrl] = useState(
    app.applicationUrl ?? "",
  );
  const [externalReferenceId, setExternalReferenceId] = useState(
    app.externalReferenceId ?? "",
  );
  const [confirmationReference, setConfirmationReference] = useState(
    app.confirmationReference ?? "",
  );
  const [cvVersionLabel, setCvVersionLabel] = useState(
    app.cvVersionLabel ?? "",
  );
  const [coverLetterVersionLabel, setCoverLetterVersionLabel] = useState(
    app.coverLetterVersionLabel ?? "",
  );
  const [expectedSalary, setExpectedSalary] = useState(
    app.expectedSalary != null ? String(app.expectedSalary) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    (app.currency as Currency) ?? "IDR",
  );
  const [jobCategory, setJobCategory] = useState(app.jobCategory ?? "");
  const [recruiterName, setRecruiterName] = useState(app.recruiterName ?? "");
  const [recruiterEmail, setRecruiterEmail] = useState(
    app.recruiterEmail ?? "",
  );
  const [recruiterContact, setRecruiterContact] = useState(
    app.recruiterContact ?? "",
  );
  const [nextFollowUpOn, setNextFollowUpOn] = useState(
    app.nextFollowUpOn ?? "",
  );
  const [notes, setNotes] = useState(app.notes ?? "");

  // Communication form state
  const [commChannel, setCommChannel] = useState<CommChannel>("email");
  const [commDirection, setCommDirection] = useState<CommDirection>("inbound");
  const [commClass, setCommClass] = useState<EmailClassification>(
    "application_confirmation",
  );
  const [commSender, setCommSender] = useState(app.recruiterEmail ?? "");
  const [commSubject, setCommSubject] = useState("");
  const [commSnippet, setCommSnippet] = useState("");

  // Interview form state
  const [intType, setIntType] = useState<InterviewType>("hr");
  const [intStartsAt, setIntStartsAt] = useState("");
  const [intDuration, setIntDuration] = useState("45");
  const [intMeetingUrl, setIntMeetingUrl] = useState("");
  const [intLocation, setIntLocation] = useState("");
  const [intInterviewerName, setIntInterviewerName] = useState("");
  const [intInterviewerPosition, setIntInterviewerPosition] = useState("");
  const [intPrepNotes, setIntPrepNotes] = useState("");
  const [intQuestions, setIntQuestions] = useState("");

  // Follow-up form state
  const [taskType, setTaskType] = useState<FollowUpType>("follow_up");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueOn, setTaskDueOn] = useState(
    app.nextFollowUpOn ?? addBusinessDays(app.submittedOn, 5),
  );
  const [taskNote, setTaskNote] = useState("");

  const noResponseStage = app.allStages.find(
    (s) => s.stageType === "no_response",
  );

  function handleSaveOverview(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateApplicationAction(app.id, {
          submittedOn,
          platformSourceId: platformSourceId || null,
          submissionMethod,
          applicationUrl: applicationUrl || null,
          externalReferenceId: externalReferenceId || null,
          confirmationReference: confirmationReference || null,
          cvVersionLabel: cvVersionLabel || null,
          coverLetterVersionLabel: coverLetterVersionLabel || null,
          recruiterName: recruiterName || null,
          recruiterEmail: recruiterEmail || null,
          recruiterContact: recruiterContact || null,
          expectedSalary: expectedSalary ? Number(expectedSalary) : null,
          currency,
          jobCategory: jobCategory || null,
          nextFollowUpOn: nextFollowUpOn || null,
          notes: notes || null,
        });
        toast.success("Application details saved.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function handleLogCommunication(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await logCommunicationAction({
          applicationId: app.id,
          channel: commChannel,
          direction: commDirection,
          classification: commClass,
          sender: commSender || null,
          subject: commSubject,
          snippet: commSnippet || null,
        });
        setCommSubject("");
        setCommSnippet("");
        toast.success("Communication logged.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not log communication",
        );
      }
    });
  }

  function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await scheduleInterviewAction({
          applicationId: app.id,
          interviewType: intType,
          startsAt: intStartsAt,
          durationMinutes: Number(intDuration) || 45,
          meetingUrl: intMeetingUrl || null,
          location: intLocation || null,
          interviewerName: intInterviewerName || null,
          interviewerPosition: intInterviewerPosition || null,
          preparationNotes: intPrepNotes || null,
          questions: intQuestions || null,
        });
        setIntStartsAt("");
        setIntMeetingUrl("");
        setIntPrepNotes("");
        setIntQuestions("");
        toast.success("Interview scheduled.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not schedule interview",
        );
      }
    });
  }

  function handleAddFollowUp(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createFollowUpTaskAction({
          applicationId: app.id,
          type: taskType,
          title: taskTitle,
          dueOn: taskDueOn,
          note: taskNote || null,
        });
        setTaskTitle("");
        setTaskNote("");
        toast.success("Follow-up task added.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add task");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete application ${app.code}?`)) return;
    startTransition(async () => {
      try {
        await deleteApplicationAction(app.id);
        toast.success("Application deleted.");
        router.push("/applications");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  // Reached stage IDs for visual pipeline progression
  const reachedStageIds = new Set(app.history.map((h) => h.toStageId));
  reachedStageIds.add(app.currentStageId);
  const activePipelineStages = app.allStages.filter(
    (s) => !isVacancyLevel(s.stageType) && !isTerminal(s.stageType),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/applications"
          className="text-xs font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
        >
          &larr; Back to Applications
        </Link>
        <Link
          href={`/jobs/${app.vacancy.id}`}
          className="text-xs font-semibold text-[#334155] tabular-nums hover:text-[#204CD3] hover:underline dark:text-slate-400"
        >
          View Underlying Vacancy ({app.vacancy.code}) &rarr;
        </Link>
      </div>

      {/* Header */}
      <div className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
                {app.code}
              </span>
              <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
                {app.vacancy.title}
              </h1>
              <StageBadge name={app.stage.name} color={app.stage.color} />
              <OutcomeBadge outcome={app.outcome} />
              {app.attemptNumber > 1 && (
                <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
                  Attempt #{app.attemptNumber}
                </span>
              )}
              {app.isSample && <SampleBadge />}
            </div>

            <p className="text-[14px] text-[#334155] dark:text-slate-300">
              <strong className="font-semibold text-[#0F172A] dark:text-slate-100">
                {app.company.name}
              </strong>
              {app.jobCategory ? ` · ${app.jobCategory}` : ""}
              {app.vacancy.location ? ` · ${app.vacancy.location}` : ""}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] tabular-nums">
              <span>Submitted: {formatDate(app.submittedOn)}</span>
              {app.platform && <span>Platform: {app.platform.name}</span>}
              <span>
                Method:{" "}
                {
                  SUBMISSION_METHOD_LABELS[
                    app.submissionMethod as SubmissionMethod
                  ]
                }
              </span>
              {app.expectedSalary != null && (
                <span>
                  Expected:{" "}
                  <strong className="font-mono font-semibold text-[#0F172A] dark:text-slate-200">
                    {formatMoney(app.expectedSalary, app.currency)}
                  </strong>
                </span>
              )}
              {(app.applicationUrl || app.vacancy.url) && (
                <a
                  href={app.applicationUrl ?? app.vacancy.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
                >
                  External Link <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetMoveStageId(undefined);
                setMoveOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Move Stage
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="inline-flex h-9 items-center gap-1 rounded-[4px] border border-[#F43F5E]/40 bg-[#FFFFFF] px-3 text-xs font-semibold text-[#BE123C] transition-colors hover:bg-[#FFF1F2] dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Visual Pipeline Stepper */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
          {activePipelineStages.map((s) => {
            const isCurrent = s.id === app.currentStageId;
            const wasReached = reachedStageIds.has(s.id);
            const wasSkipped =
              !wasReached &&
              s.sortOrder < app.stage.sortOrder &&
              !isTerminal(app.stage.stageType);

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id !== app.currentStageId) {
                    setTargetMoveStageId(s.id);
                    setMoveOpen(true);
                  }
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.02em] transition-colors ${
                  isCurrent
                    ? "border-[#204CD3] bg-[#204CD3] text-white"
                    : wasReached
                      ? "border-[#10B981]/30 bg-[#ECFDF5] text-[#047857] dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : wasSkipped
                        ? "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] line-through dark:border-slate-700 dark:bg-slate-900"
                        : "border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:border-[#204CD3] hover:bg-[#EEF2FF] hover:text-[#1D4ED8] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                }`}
              >
                {s.name}
                {wasSkipped ? " (skipped)" : ""}
              </button>
            );
          })}
        </div>

        {/* No Response Suggestion Banner */}
        {app.noResponseSuggestion.shouldSuggest && noResponseStage && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#F59E0B]/40 bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#B45309] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{app.noResponseSuggestion.reason}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTargetMoveStageId(noResponseStage.id);
                setMoveOpen(true);
              }}
              className="rounded-[4px] bg-[#B45309] px-3 py-1 text-xs font-semibold text-white hover:bg-[#92400E]"
            >
              Confirm &ldquo;No Response&rdquo;
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0] dark:border-slate-800">
        {(
          [
            { key: "overview", label: "Overview & Details" },
            {
              key: "timeline",
              label: `Timeline & Status History (${app.history.length})`,
            },
            {
              key: "communications",
              label: `Communications (${app.communications.length})`,
            },
            {
              key: "interviews",
              label: `Interviews (${app.interviews.length})`,
            },
            {
              key: "followups",
              label: `Follow-up Tasks (${app.followUps.length})`,
            },
            {
              key: "documents",
              label: `Attached Documents (${careerExtras?.attachedDocuments.length ?? 0})`,
            },
            {
              key: "offer",
              label: careerExtras?.offer || app.offer ? "Offer & Result (Recorded)" : "Offer & Result",
            },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-3.5 py-2.5 text-xs font-semibold tabular-nums transition-colors ${
              tab === item.key
                ? "border-[#204CD3] text-[#204CD3] dark:border-[#B7C4FF] dark:text-[#B7C4FF]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <form
          onSubmit={handleSaveOverview}
          className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
            Application Record Details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Date
              </label>
              <input
                type="date"
                value={submittedOn}
                onChange={(e) => setSubmittedOn(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Platform
              </label>
              <select
                value={platformSourceId}
                onChange={(e) => setPlatformSourceId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Unspecified</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Submission Method
              </label>
              <select
                value={submissionMethod}
                onChange={(e) =>
                  setSubmissionMethod(e.target.value as SubmissionMethod)
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                {SUBMISSION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {SUBMISSION_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                CV Version Used
              </label>
              <input
                type="text"
                value={cvVersionLabel}
                onChange={(e) => setCvVersionLabel(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Cover Letter Version
              </label>
              <input
                type="text"
                value={coverLetterVersionLabel}
                onChange={(e) => setCoverLetterVersionLabel(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Job Category / Department
              </label>
              <input
                type="text"
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Expected Salary
              </label>
              <input
                type="number"
                min={0}
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Next Follow-up Date
              </label>
              <input
                type="date"
                value={nextFollowUpOn}
                onChange={(e) => setNextFollowUpOn(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                External Application Ref ID
              </label>
              <input
                type="text"
                value={externalReferenceId}
                onChange={(e) => setExternalReferenceId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Confirmation Reference
              </label>
              <input
                type="text"
                value={confirmationReference}
                onChange={(e) => setConfirmationReference(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Portal URL
              </label>
              <input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Name
              </label>
              <input
                type="text"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Email
              </label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Phone / Contact
              </label>
              <input
                type="text"
                value={recruiterContact}
                onChange={(e) => setRecruiterContact(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Application Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="h-9 rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Application Details"}
            </button>
          </div>
        </form>
      )}

      {tab === "timeline" && (
        <div className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Recruitment Stage Status History
              </h2>
              <p className="text-[#64748B]">
                Append-only audit trail of every recruitment stage transition
                for {app.code}.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {app.history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.fromStage ? (
                      <>
                        <StageBadge
                          name={item.fromStage.name}
                          color={item.fromStage.color}
                        />
                        <span className="text-[#64748B]">&rarr;</span>
                      </>
                    ) : (
                      <span className="text-[#64748B]">Initial &rarr;</span>
                    )}
                    <StageBadge
                      name={item.toStage.name}
                      color={item.toStage.color}
                    />
                    <span className="rounded-full bg-[#E2E8F0] px-2.5 py-0.5 text-[11px] font-semibold text-[#334155] dark:bg-slate-800 dark:text-slate-300">
                      {HISTORY_SOURCE_LABELS[item.source as HistorySource] ??
                        item.source}
                    </span>
                  </div>
                  {item.reason && (
                    <p className="text-[#334155] dark:text-slate-300">
                      <strong>Reason:</strong> {item.reason}
                    </p>
                  )}
                  {item.note && <p className="text-[#64748B]">{item.note}</p>}
                </div>

                <div className="shrink-0 text-right font-mono text-[11px] text-[#64748B] tabular-nums">
                  <div>Effective: {formatDate(item.effectiveOn)}</div>
                  <div className="text-[10px]">
                    Recorded: {formatDateTime(item.recordedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "communications" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Communication History
              </h2>
              {app.communications.length === 0 ? (
                <p className="py-6 text-[#64748B]">
                  No correspondence logged yet. Log emails, recruiter messages,
                  or phone calls using the form.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {app.communications.map((c) => (
                    <div
                      key={c.id}
                      className="space-y-1.5 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {c.subject}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                          {formatDateTime(c.occurredAt)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                        <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 font-semibold text-[#1D4ED8] dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]">
                          {
                            EMAIL_CLASSIFICATION_LABELS[
                              c.classification as EmailClassification
                            ]
                          }
                        </span>
                        <span>
                          {COMM_CHANNEL_LABELS[c.channel as CommChannel]} ·{" "}
                          {COMM_DIRECTION_LABELS[c.direction as CommDirection]}
                        </span>
                        {c.sender && <span>From: {c.sender}</span>}
                      </div>
                      {c.snippet && (
                        <p className="mt-1 whitespace-pre-line text-[#334155] dark:text-slate-300">
                          {c.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleLogCommunication}
            className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#204CD3]" />
              <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Log Recruitment Communication
              </h3>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Record emails, WhatsApp, LinkedIn messages, or calls. (Automated
              Gmail/Outlook OAuth sync arrives in Phase 3.)
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Channel
                </label>
                <select
                  value={commChannel}
                  onChange={(e) =>
                    setCommChannel(e.target.value as CommChannel)
                  }
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {COMM_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {COMM_CHANNEL_LABELS[ch]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Direction
                </label>
                <select
                  value={commDirection}
                  onChange={(e) =>
                    setCommDirection(e.target.value as CommDirection)
                  }
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {COMM_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {COMM_DIRECTION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruitment Classification
              </label>
              <select
                value={commClass}
                onChange={(e) =>
                  setCommClass(e.target.value as EmailClassification)
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                {EMAIL_CLASSIFICATIONS.map((cl) => (
                  <option key={cl} value={cl}>
                    {EMAIL_CLASSIFICATION_LABELS[cl]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Sender / Contact
              </label>
              <input
                type="text"
                value={commSender}
                onChange={(e) => setCommSender(e.target.value)}
                placeholder="recruiter@company.com"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Subject / Summary *
              </label>
              <input
                type="text"
                required
                value={commSubject}
                onChange={(e) => setCommSubject(e.target.value)}
                placeholder="Invitation to HR Interview"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Message Excerpt / Notes
              </label>
              <textarea
                rows={3}
                value={commSnippet}
                onChange={(e) => setCommSnippet(e.target.value)}
                placeholder="Key details from the email or call..."
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-9 w-full rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Log Communication"}
            </button>
          </form>
        </div>
      )}

      {tab === "interviews" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Interview Records
              </h2>
              {app.interviews.length === 0 ? (
                <p className="py-6 text-[#64748B]">
                  No interviews recorded for this application yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {app.interviews.map((intv) => (
                    <InterviewCard
                      key={intv.id}
                      applicationId={app.id}
                      interview={intv}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleScheduleInterview}
            className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#10B981]" />
              <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Schedule Interview
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Interview Type
                </label>
                <select
                  value={intType}
                  onChange={(e) => setIntType(e.target.value as InterviewType)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INTERVIEW_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={10}
                  max={480}
                  value={intDuration}
                  onChange={(e) => setIntDuration(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={intStartsAt}
                onChange={(e) => setIntStartsAt(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Meeting Link (Zoom / Google Meet / Teams)
              </label>
              <input
                type="url"
                value={intMeetingUrl}
                onChange={(e) => setIntMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                On-site Location (if applicable)
              </label>
              <input
                type="text"
                value={intLocation}
                onChange={(e) => setIntLocation(e.target.value)}
                placeholder="Office building / floor"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Interviewer Name
                </label>
                <input
                  type="text"
                  value={intInterviewerName}
                  onChange={(e) => setIntInterviewerName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Interviewer Position
                </label>
                <input
                  type="text"
                  value={intInterviewerPosition}
                  onChange={(e) => setIntInterviewerPosition(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Candidate Preparation Notes
              </label>
              <textarea
                rows={2}
                value={intPrepNotes}
                onChange={(e) => setIntPrepNotes(e.target.value)}
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Questions to Ask / Expected Questions
              </label>
              <textarea
                rows={2}
                value={intQuestions}
                onChange={(e) => setIntQuestions(e.target.value)}
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-9 w-full rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Scheduling..." : "Save Interview"}
            </button>
          </form>
        </div>
      )}

      {tab === "followups" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Follow-up Tasks & Reminders
              </h2>
              {app.followUps.length === 0 ? (
                <p className="py-6 text-[#64748B]">
                  No follow-up tasks for this application.
                </p>
              ) : (
                <div className="space-y-2">
                  {app.followUps.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {f.title}
                        </p>
                        <p className="text-[11px] text-[#64748B] tabular-nums">
                          {FOLLOW_UP_TYPE_LABELS[f.type as FollowUpType]} · Due{" "}
                          {formatDate(f.dueOn)} · Status:{" "}
                          <strong className="uppercase text-[#334155] dark:text-slate-300">
                            {f.status}
                          </strong>
                        </p>
                        {f.note && (
                          <p className="mt-1 text-[#334155] dark:text-slate-400">
                            {f.note}
                          </p>
                        )}
                      </div>

                      {f.status === "open" && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                await snoozeFollowUpTaskAction(
                                  f.id,
                                  addBusinessDays(f.dueOn, 3),
                                );
                                toast.success("Snoozed by 3 business days.");
                                router.refresh();
                              })
                            }
                            className="rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Snooze +3d
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                await completeFollowUpTaskAction(f.id, true);
                                toast.success("Task completed.");
                                router.refresh();
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-[4px] bg-[#10B981] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#059669]"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleAddFollowUp}
            className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 text-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#204CD3]" />
              <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Add Follow-up Reminder
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Reminder Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as FollowUpType)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {FOLLOW_UP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FOLLOW_UP_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={taskDueOn}
                  onChange={(e) => setTaskDueOn(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Title *
              </label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Check in with HR after technical interview"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Note
              </label>
              <textarea
                rows={2}
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-9 w-full rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              Add Follow-up Task
            </button>
          </form>
        </div>
      )}

      {tab === "documents" && (
        <ApplicationDocumentsTab
          applicationId={app.id}
          cvVersionLabel={app.cvVersionLabel}
          coverLetterVersionLabel={app.coverLetterVersionLabel}
          careerExtras={careerExtras}
        />
      )}

      {tab === "offer" && (
        <ApplicationOfferTab
          applicationId={app.id}
          defaultTitle={app.vacancy.title}
          defaultCurrency={(app.currency as Currency) ?? "IDR"}
          defaultDate={app.submittedOn}
          offer={careerExtras?.offer ?? app.offer}
        />
      )}

      <MoveStageDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        applicationId={app.id}
        applicationLabel={`${app.code}: ${app.vacancy.title} at ${app.company.name}`}
        fromStage={app.stage}
        initialToStage={
          targetMoveStageId
            ? app.allStages.find((s) => s.id === targetMoveStageId)
            : undefined
        }
        stages={app.allStages}
        source="manual"
        onMoved={() => router.refresh()}
      />
    </div>
  );
}

function InterviewCard({
  applicationId,
  interview,
}: {
  applicationId: string;
  interview: AppDetailData["interviews"][number];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<InterviewStatus>(
    interview.status as InterviewStatus,
  );
  const [result, setResult] = useState<InterviewResult>(
    interview.result as InterviewResult,
  );
  const [feedback, setFeedback] = useState(interview.feedback ?? "");

  function handleSaveOutcome() {
    startTransition(async () => {
      try {
        await updateInterviewOutcomeAction(applicationId, {
          interviewId: interview.id,
          status,
          result,
          feedback: feedback || null,
        });
        toast.success("Interview outcome updated.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  return (
    <div className="space-y-2.5 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
          {INTERVIEW_TYPE_LABELS[interview.interviewType as InterviewType] ??
            interview.interviewType}
        </span>
        <span className="font-mono font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
          {formatDateTime(interview.startsAt, interview.timezone)} (
          {interview.durationMinutes} min)
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-[#64748B]">
        {interview.interviewerName && (
          <span>
            Interviewer: {interview.interviewerName}
            {interview.interviewerPosition
              ? ` (${interview.interviewerPosition})`
              : ""}
          </span>
        )}
        {interview.location && <span>Location: {interview.location}</span>}
        {interview.meetingUrl && (
          <a
            href={interview.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
          >
            Meeting Link
          </a>
        )}
      </div>

      {interview.preparationNotes && (
        <p className="text-[#334155] dark:text-slate-300">
          <strong>Prep Notes:</strong> {interview.preparationNotes}
        </p>
      )}
      {interview.questions && (
        <p className="text-[#334155] dark:text-slate-300">
          <strong>Questions:</strong> {interview.questions}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 border-t border-[#E2E8F0] pt-2.5 sm:grid-cols-3 dark:border-slate-800">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InterviewStatus)}
          className="h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900"
        >
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              Status: {INTERVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={result}
          onChange={(e) => setResult(e.target.value as InterviewResult)}
          className="h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900"
        >
          {INTERVIEW_RESULTS.map((r) => (
            <option key={r} value={r}>
              Result: {INTERVIEW_RESULT_LABELS[r]}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSaveOutcome}
          className="h-9 rounded-[4px] bg-[#204CD3] px-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
        >
          Save Feedback & Result
        </button>
      </div>

      <input
        type="text"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Post-interview feedback or outcome notes..."
        className="h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900"
      />
    </div>
  );
}

function ApplicationDocumentsTab({
  applicationId,
  cvVersionLabel,
  coverLetterVersionLabel,
  careerExtras,
}: {
  applicationId: string;
  cvVersionLabel: string | null;
  coverLetterVersionLabel: string | null;
  careerExtras?: CareerExtrasData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedVerId, setSelectedVerId] = useState(
    careerExtras?.availableVersions[0]?.version.id ?? "",
  );
  const [role, setRole] = useState<"cv" | "cover_letter" | "other">("cv");

  function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVerId) return;
    startTransition(async () => {
      try {
        await linkDocumentVersionToApplicationAction({
          applicationId,
          documentVersionId: selectedVerId,
          role,
        });
        toast.success("Document version associated with application.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not attach");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Documents Associated with This Application
            </h2>
            <Link
              href="/documents"
              className="font-semibold text-[#204CD3] hover:underline"
            >
              Open Document Repository &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[6px] bg-[#F8FAFC] p-3 dark:bg-slate-950">
            <div>
              <span className="text-[#64748B]">CV Version Recorded:</span>
              <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-slate-100">
                {cvVersionLabel || "Not specified"}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Cover Letter Version:</span>
              <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-slate-100">
                {coverLetterVersionLabel || "Not specified"}
              </p>
            </div>
          </div>

          {!careerExtras || careerExtras.attachedDocuments.length === 0 ? (
            <p className="py-4 text-[#64748B]">
              No repository document versions linked yet. Use the form on the right to link a CV, Cover Letter, or Offer document version.
            </p>
          ) : (
            <div className="space-y-2">
              {careerExtras.attachedDocuments.map((att) => (
                <div
                  key={att.linkId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#E2E8F0] p-3 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#1D4ED8]">
                        {att.role}
                      </span>
                      <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                        {att.document.title} ({att.version.label})
                      </span>
                    </div>
                    {att.version.filename && (
                      <p className="mt-0.5 font-mono text-[11px] text-[#64748B]">
                        {att.version.filename}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {att.version.storageKey && (
                      <a
                        href={`/api/documents/versions/${att.version.id}/file?download=1`}
                        download
                        className="btn-secondary h-8 px-2.5 text-xs"
                      >
                        Download
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await unlinkDocumentVersionFromApplicationAction(
                            att.linkId,
                            applicationId,
                          );
                          toast.success("Unlinked document.");
                          router.refresh();
                        })
                      }
                      className="rounded-[4px] border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-xs font-semibold text-[#BE123C]"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleAttach}
        className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3.5 text-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
          Associate Repository Document Version
        </h3>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Select Document Version
          </label>
          <select
            value={selectedVerId}
            onChange={(e) => setSelectedVerId(e.target.value)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Choose a document version...</option>
            {(careerExtras?.availableVersions ?? []).map((item) => (
              <option key={item.version.id} value={item.version.id}>
                {item.document.title} - v{item.version.versionNo} (
                {item.version.label})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Role on This Application
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "cv" | "cover_letter" | "other")
            }
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="cv">CV Version Used</option>
            <option value="cover_letter">Cover Letter Version</option>
            <option value="other">Supporting / Offer Document</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending || !selectedVerId}
          className="btn-primary h-9 w-full text-xs disabled:opacity-50"
        >
          Link Document Version
        </button>
      </form>
    </div>
  );
}

function ApplicationOfferTab({
  applicationId,
  defaultTitle,
  defaultCurrency,
  defaultDate,
  offer,
}: {
  applicationId: string;
  defaultTitle: string;
  defaultCurrency: Currency;
  defaultDate: string;
  offer: AppDetailData["offer"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [positionTitle, setPositionTitle] = useState(
    offer?.positionTitle ?? defaultTitle,
  );
  const [baseSalary, setBaseSalary] = useState(
    offer?.baseSalary != null ? String(offer.baseSalary) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    (offer?.currency as Currency) ?? defaultCurrency,
  );
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(
    (offer?.salaryPeriod as SalaryPeriod) ?? "month",
  );
  const [offerReceivedOn, setOfferReceivedOn] = useState(
    offer?.offerReceivedOn ?? defaultDate,
  );
  const [responseDeadline, setResponseDeadline] = useState(
    offer?.responseDeadline ?? "",
  );
  const [joiningDate, setJoiningDate] = useState(offer?.joiningDate ?? "");
  const [decision, setDecision] = useState<OfferDecision>(
    (offer?.decision as OfferDecision) ?? "pending",
  );
  const [benefits, setBenefits] = useState(offer?.benefits ?? "");
  const [notes, setNotes] = useState(offer?.notes ?? "");
  const [syncStage, setSyncStage] = useState(true);

  function handleSaveOffer(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertJobOfferAction({
          applicationId,
          positionTitle,
          baseSalary: baseSalary ? Number(baseSalary) : null,
          currency,
          salaryPeriod,
          offerReceivedOn,
          responseDeadline: responseDeadline || null,
          joiningDate: joiningDate || null,
          decision,
          benefits: benefits || null,
          notes: notes || null,
          syncApplicationStage: syncStage,
        });
        toast.success("Employment offer and outcome saved.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save offer");
      }
    });
  }

  return (
    <form
      onSubmit={handleSaveOffer}
      className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4 text-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
          Employment Offer & Recruitment Outcome Management
        </h2>
        <p className="text-[#64748B]">
          Record proposed salary, benefits, joining date, and offer decision. Accepting an offer transitions the application to Hired (Successful).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Offered Position Title *
          </label>
          <input
            type="text"
            required
            value={positionTitle}
            onChange={(e) => setPositionTitle(e.target.value)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Proposed Base Salary
          </label>
          <input
            type="number"
            min={0}
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
            placeholder="28500000"
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Currency & Period
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="h-10 w-24 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={salaryPeriod}
              onChange={(e) => setSalaryPeriod(e.target.value as SalaryPeriod)}
              className="h-10 flex-1 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {SALARY_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Offer Received Date *
          </label>
          <input
            type="date"
            required
            value={offerReceivedOn}
            onChange={(e) => setOfferReceivedOn(e.target.value)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Offer Response Deadline
          </label>
          <input
            type="date"
            value={responseDeadline}
            onChange={(e) => setResponseDeadline(e.target.value)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Proposed Joining Date
          </label>
          <input
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Offer Decision
          </label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as OfferDecision)}
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-semibold text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          >
            {OFFER_DECISIONS.map((d) => (
              <option key={d} value={d}>
                {OFFER_DECISION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 font-semibold text-[#334155] dark:text-slate-300">
            <input
              type="checkbox"
              checked={syncStage}
              onChange={(e) => setSyncStage(e.target.checked)}
            />
            Automatically sync pipeline stage (Offer / Hired / Withdrawn)
          </label>
        </div>
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Benefits & Compensation Package Breakdown
        </label>
        <textarea
          rows={3}
          value={benefits}
          onChange={(e) => setBenefits(e.target.value)}
          placeholder="THR, bonus structure, health insurance, equity/ESOP, leave days, remote allowance..."
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Negotiation & Offer Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary h-9 px-4 text-xs disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Employment Offer"}
        </button>
      </div>
    </form>
  );
}
