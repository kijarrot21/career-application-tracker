"use client";

import {
  Archive,
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
import { ManualArchiveDialog } from "@/components/archive/archive-dialogs";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FormField,
  Input,
  OutcomeBadge,
  SampleBadge,
  Select,
  StageBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
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
import { cn } from "@/lib/utils";
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
  activeArchive,
}: {
  app: AppDetailData;
  sources: { id: string; key: string; name: string }[];
  careerExtras?: CareerExtrasData;
  activeArchive?: {
    id: string;
    closureOutcome: string;
    closedOn: string;
    archivedAt: Date;
  } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialTab = (searchParams.get("tab") as TabKey) || "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [moveOpen, setMoveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  function handleConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteApplicationAction(app.id);
        toast.success("Application deleted.");
        setDeleteOpen(false);
        router.push("/applications");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

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
          className="text-xs font-semibold text-primary-text hover:underline"
        >
          &larr; Back to Applications
        </Link>
        <Link
          href={`/jobs/${app.vacancy.id}`}
          className="text-xs font-semibold text-muted-foreground tabular-nums hover:text-primary-text hover:underline"
        >
          View Underlying Vacancy ({app.vacancy.code}) &rarr;
        </Link>
      </div>

      {/* Header */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary-text tabular-nums">
                {app.code}
              </span>
              <h1 className="text-page-title text-foreground">
                {app.vacancy.title}
              </h1>
              <StageBadge name={app.stage.name} color={app.stage.color} />
              <OutcomeBadge outcome={app.outcome} />
              {app.attemptNumber > 1 && (
                <Badge variant="secondary" className="font-mono tabular-nums">
                  Attempt #{app.attemptNumber}
                </Badge>
              )}
              {app.isSample && <SampleBadge />}
            </div>

            <p className="text-[14px] text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {app.company.name}
              </strong>
              {app.jobCategory ? ` · ${app.jobCategory}` : ""}
              {app.vacancy.location ? ` · ${app.vacancy.location}` : ""}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground tabular-nums">
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
                  <strong className="font-mono font-semibold text-foreground">
                    {formatMoney(app.expectedSalary, app.currency)}
                  </strong>
                </span>
              )}
              {(app.applicationUrl || app.vacancy.url) && (
                <a
                  href={app.applicationUrl ?? app.vacancy.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
                >
                  External Link <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setTargetMoveStageId(undefined);
                setMoveOpen(true);
              }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Move Stage
            </Button>

            {activeArchive ? (
              <Button variant="secondary" size="lg" asChild>
                <Link href={`/archive/${activeArchive.id}`}>
                  <Archive className="h-3.5 w-3.5" />
                  View Archive Snapshot
                </Link>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
            )}

            <Button
              variant="destructive"
              size="lg"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Visual Pipeline Stepper */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-3">
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
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.02em] transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-white"
                    : wasReached
                      ? "border-success-border bg-success-soft text-success-on-soft"
                      : wasSkipped
                        ? "border-dashed border-border bg-surface-subtle text-muted-foreground line-through"
                        : "border-border bg-card text-muted-foreground hover:border-primary hover:bg-primary-soft hover:text-primary-on-soft",
                )}
              >
                {s.name}
                {wasSkipped ? " (skipped)" : ""}
              </button>
            );
          })}
        </div>

        {/* No Response Suggestion Banner */}
        {app.noResponseSuggestion.shouldSuggest && noResponseStage && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-3.5 py-2.5 text-xs text-warning-on-soft">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{app.noResponseSuggestion.reason}</span>
            </div>
            <Button
              variant="warning"
              size="sm"
              onClick={() => {
                setTargetMoveStageId(noResponseStage.id);
                setMoveOpen(true);
              }}
            >
              Confirm &ldquo;No Response&rdquo;
            </Button>
          </div>
        )}
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="overview">Overview & Details</TabsTrigger>
          <TabsTrigger value="timeline" className="tabular-nums">
            Timeline & Status History ({app.history.length})
          </TabsTrigger>
          <TabsTrigger value="communications" className="tabular-nums">
            Communications ({app.communications.length})
          </TabsTrigger>
          <TabsTrigger value="interviews" className="tabular-nums">
            Interviews ({app.interviews.length})
          </TabsTrigger>
          <TabsTrigger value="followups" className="tabular-nums">
            Follow-up Tasks ({app.followUps.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="tabular-nums">
            Attached Documents ({careerExtras?.attachedDocuments.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="offer">
            {careerExtras?.offer || app.offer
              ? "Offer & Result (Recorded)"
              : "Offer & Result"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {tab === "overview" && (
        <Card padding="md">
          <form onSubmit={handleSaveOverview} className="space-y-4 text-xs">
            <h2 className="text-section-title text-foreground">
              Application Record Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Application Date">
                <Input
                  type="date"
                  inputSize="lg"
                  value={submittedOn}
                  onChange={(e) => setSubmittedOn(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="Application Platform">
                <Select
                  selectSize="lg"
                  value={platformSourceId}
                  onChange={(e) => setPlatformSourceId(e.target.value)}
                >
                  <option value="">Unspecified</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Submission Method">
                <Select
                  selectSize="lg"
                  value={submissionMethod}
                  onChange={(e) =>
                    setSubmissionMethod(e.target.value as SubmissionMethod)
                  }
                >
                  {SUBMISSION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {SUBMISSION_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="CV Version Used">
                <Input
                  type="text"
                  inputSize="lg"
                  value={cvVersionLabel}
                  onChange={(e) => setCvVersionLabel(e.target.value)}
                />
              </FormField>

              <FormField label="Cover Letter Version">
                <Input
                  type="text"
                  inputSize="lg"
                  value={coverLetterVersionLabel}
                  onChange={(e) => setCoverLetterVersionLabel(e.target.value)}
                />
              </FormField>

              <FormField label="Job Category / Department">
                <Input
                  type="text"
                  inputSize="lg"
                  value={jobCategory}
                  onChange={(e) => setJobCategory(e.target.value)}
                />
              </FormField>

              <FormField label="Expected Salary">
                <Input
                  type="number"
                  inputSize="lg"
                  min={0}
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="Currency">
                <Select
                  selectSize="lg"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Next Follow-up Date">
                <Input
                  type="date"
                  inputSize="lg"
                  value={nextFollowUpOn}
                  onChange={(e) => setNextFollowUpOn(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="External Application Ref ID">
                <Input
                  type="text"
                  inputSize="lg"
                  value={externalReferenceId}
                  onChange={(e) => setExternalReferenceId(e.target.value)}
                />
              </FormField>

              <FormField label="Confirmation Reference">
                <Input
                  type="text"
                  inputSize="lg"
                  value={confirmationReference}
                  onChange={(e) => setConfirmationReference(e.target.value)}
                />
              </FormField>

              <FormField label="Application Portal URL">
                <Input
                  type="url"
                  inputSize="lg"
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                />
              </FormField>

              <FormField label="Recruiter Name">
                <Input
                  type="text"
                  inputSize="lg"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                />
              </FormField>

              <FormField label="Recruiter Email">
                <Input
                  type="email"
                  inputSize="lg"
                  value={recruiterEmail}
                  onChange={(e) => setRecruiterEmail(e.target.value)}
                />
              </FormField>

              <FormField label="Recruiter Phone / Contact">
                <Input
                  type="text"
                  inputSize="lg"
                  value={recruiterContact}
                  onChange={(e) => setRecruiterContact(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Application Notes">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Application Details"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "timeline" && (
        <Card padding="md" className="space-y-4 text-xs">
          <div>
            <h2 className="text-section-title text-foreground">
              Recruitment Stage Status History
            </h2>
            <p className="text-muted-foreground">
              Append-only audit trail of every recruitment stage transition for{" "}
              {app.code}.
            </p>
          </div>

          <div className="space-y-3">
            {app.history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3.5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.fromStage ? (
                      <>
                        <StageBadge
                          name={item.fromStage.name}
                          color={item.fromStage.color}
                        />
                        <span className="text-muted-foreground">&rarr;</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Initial &rarr;
                      </span>
                    )}
                    <StageBadge
                      name={item.toStage.name}
                      color={item.toStage.color}
                    />
                    <Badge variant="secondary">
                      {HISTORY_SOURCE_LABELS[item.source as HistorySource] ??
                        item.source}
                    </Badge>
                  </div>
                  {item.reason && (
                    <p className="text-foreground/90">
                      <strong>Reason:</strong> {item.reason}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-muted-foreground">{item.note}</p>
                  )}
                </div>

                <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                  <div>Effective: {formatDate(item.effectiveOn)}</div>
                  <div className="text-[10px]">
                    Recorded: {formatDateTime(item.recordedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "communications" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <Card padding="md" className="space-y-3 text-xs">
              <h2 className="text-section-title text-foreground">
                Communication History
              </h2>
              {app.communications.length === 0 ? (
                <p className="py-6 text-muted-foreground">
                  No correspondence logged yet. Log emails, recruiter messages,
                  or phone calls using the form.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {app.communications.map((c) => (
                    <div
                      key={c.id}
                      className="space-y-1.5 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {c.subject}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatDateTime(c.occurredAt)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="primary">
                          {
                            EMAIL_CLASSIFICATION_LABELS[
                              c.classification as EmailClassification
                            ]
                          }
                        </Badge>
                        <span>
                          {COMM_CHANNEL_LABELS[c.channel as CommChannel]} ·{" "}
                          {COMM_DIRECTION_LABELS[c.direction as CommDirection]}
                        </span>
                        {c.sender && <span>From: {c.sender}</span>}
                      </div>
                      {c.snippet && (
                        <p className="mt-1 whitespace-pre-line text-foreground/90">
                          {c.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card padding="md" className="lg:col-span-5">
            <form onSubmit={handleLogCommunication} className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary-text" />
                <h3 className="text-section-title text-foreground">
                  Log Recruitment Communication
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Record emails, WhatsApp, LinkedIn messages, or calls, or sync
                automatically from the Email Center.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Channel">
                  <Select
                    selectSize="lg"
                    value={commChannel}
                    onChange={(e) =>
                      setCommChannel(e.target.value as CommChannel)
                    }
                  >
                    {COMM_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {COMM_CHANNEL_LABELS[ch]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Direction">
                  <Select
                    selectSize="lg"
                    value={commDirection}
                    onChange={(e) =>
                      setCommDirection(e.target.value as CommDirection)
                    }
                  >
                    {COMM_DIRECTIONS.map((d) => (
                      <option key={d} value={d}>
                        {COMM_DIRECTION_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <FormField label="Recruitment Classification">
                <Select
                  selectSize="lg"
                  value={commClass}
                  onChange={(e) =>
                    setCommClass(e.target.value as EmailClassification)
                  }
                >
                  {EMAIL_CLASSIFICATIONS.map((cl) => (
                    <option key={cl} value={cl}>
                      {EMAIL_CLASSIFICATION_LABELS[cl]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Sender / Contact">
                <Input
                  type="text"
                  inputSize="lg"
                  value={commSender}
                  onChange={(e) => setCommSender(e.target.value)}
                  placeholder="recruiter@company.com"
                />
              </FormField>

              <FormField label="Subject / Summary" required>
                <Input
                  type="text"
                  inputSize="lg"
                  required
                  value={commSubject}
                  onChange={(e) => setCommSubject(e.target.value)}
                  placeholder="Invitation to HR Interview"
                />
              </FormField>

              <FormField label="Message Excerpt / Notes">
                <Textarea
                  rows={3}
                  value={commSnippet}
                  onChange={(e) => setCommSnippet(e.target.value)}
                  placeholder="Key details from the email or call..."
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full"
              >
                {isPending ? "Saving..." : "Log Communication"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {tab === "interviews" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <Card padding="md" className="space-y-3 text-xs">
              <h2 className="text-section-title text-foreground">
                Interview Records
              </h2>
              {app.interviews.length === 0 ? (
                <p className="py-6 text-muted-foreground">
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
            </Card>
          </div>

          <Card padding="md" className="lg:col-span-5">
            <form
              onSubmit={handleScheduleInterview}
              className="space-y-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary-text" />
                <h3 className="text-section-title text-foreground">
                  Schedule Interview
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Interview Type">
                  <Select
                    selectSize="lg"
                    value={intType}
                    onChange={(e) =>
                      setIntType(e.target.value as InterviewType)
                    }
                  >
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {INTERVIEW_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Duration (min)">
                  <Input
                    type="number"
                    inputSize="lg"
                    min={10}
                    max={480}
                    value={intDuration}
                    onChange={(e) => setIntDuration(e.target.value)}
                    className="tabular-nums"
                  />
                </FormField>
              </div>

              <FormField label="Date & Time" required>
                <Input
                  type="datetime-local"
                  inputSize="lg"
                  required
                  value={intStartsAt}
                  onChange={(e) => setIntStartsAt(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="Meeting Link (Zoom / Google Meet / Teams)">
                <Input
                  type="url"
                  inputSize="lg"
                  value={intMeetingUrl}
                  onChange={(e) => setIntMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                />
              </FormField>

              <FormField label="On-site Location (if applicable)">
                <Input
                  type="text"
                  inputSize="lg"
                  value={intLocation}
                  onChange={(e) => setIntLocation(e.target.value)}
                  placeholder="Office building / floor"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Interviewer Name">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={intInterviewerName}
                    onChange={(e) => setIntInterviewerName(e.target.value)}
                  />
                </FormField>
                <FormField label="Interviewer Position">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={intInterviewerPosition}
                    onChange={(e) => setIntInterviewerPosition(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Candidate Preparation Notes">
                <Textarea
                  rows={2}
                  value={intPrepNotes}
                  onChange={(e) => setIntPrepNotes(e.target.value)}
                />
              </FormField>

              <FormField label="Questions to Ask / Expected Questions">
                <Textarea
                  rows={2}
                  value={intQuestions}
                  onChange={(e) => setIntQuestions(e.target.value)}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full"
              >
                {isPending ? "Scheduling..." : "Save Interview"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {tab === "followups" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <Card padding="md" className="space-y-3 text-xs">
              <h2 className="text-section-title text-foreground">
                Follow-up Tasks & Reminders
              </h2>
              {app.followUps.length === 0 ? (
                <p className="py-6 text-muted-foreground">
                  No follow-up tasks for this application.
                </p>
              ) : (
                <div className="space-y-2">
                  {app.followUps.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {f.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {FOLLOW_UP_TYPE_LABELS[f.type as FollowUpType]} · Due{" "}
                          {formatDate(f.dueOn)} · Status:{" "}
                          <strong className="uppercase text-foreground">
                            {f.status}
                          </strong>
                        </p>
                        {f.note && (
                          <p className="mt-1 text-muted-foreground">{f.note}</p>
                        )}
                      </div>

                      {f.status === "open" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
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
                          >
                            Snooze +3d
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                await completeFollowUpTaskAction(f.id, true);
                                toast.success("Task completed.");
                                router.refresh();
                              })
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card padding="md" className="lg:col-span-5">
            <form onSubmit={handleAddFollowUp} className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary-text" />
                <h3 className="text-section-title text-foreground">
                  Add Follow-up Reminder
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Reminder Type">
                  <Select
                    selectSize="lg"
                    value={taskType}
                    onChange={(e) =>
                      setTaskType(e.target.value as FollowUpType)
                    }
                  >
                    {FOLLOW_UP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FOLLOW_UP_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Due Date" required>
                  <Input
                    type="date"
                    inputSize="lg"
                    required
                    value={taskDueOn}
                    onChange={(e) => setTaskDueOn(e.target.value)}
                    className="tabular-nums"
                  />
                </FormField>
              </div>

              <FormField label="Title" required>
                <Input
                  type="text"
                  inputSize="lg"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Check in with HR after technical interview"
                />
              </FormField>

              <FormField label="Note">
                <Textarea
                  rows={2}
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full"
              >
                Add Follow-up Task
              </Button>
            </form>
          </Card>
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete application ${app.code}?`}
        description="This will permanently delete this application, its timeline history, interviews, and follow-up tasks."
        confirmLabel="Delete Application"
        pending={isPending}
        onConfirm={handleConfirmDelete}
      />

      {archiveOpen && (
        <ManualArchiveDialog
          open={archiveOpen}
          onClose={() => setArchiveOpen(false)}
          preselectedApplicationId={app.id}
          onArchived={(closureId) => {
            router.push(`/archive/${closureId}`);
            router.refresh();
          }}
        />
      )}
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
    <div className="space-y-2.5 rounded-xl border border-border-subtle bg-surface-subtle p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {INTERVIEW_TYPE_LABELS[interview.interviewType as InterviewType] ??
            interview.interviewType}
        </span>
        <span className="font-mono font-semibold text-primary-text tabular-nums">
          {formatDateTime(interview.startsAt, interview.timezone)} (
          {interview.durationMinutes} min)
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
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
            className="font-semibold text-primary-text hover:underline"
          >
            Meeting Link
          </a>
        )}
      </div>

      {interview.preparationNotes && (
        <p className="text-foreground/90">
          <strong>Prep Notes:</strong> {interview.preparationNotes}
        </p>
      )}
      {interview.questions && (
        <p className="text-foreground/90">
          <strong>Questions:</strong> {interview.questions}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 border-t border-border-subtle pt-2.5 sm:grid-cols-3">
        <Select
          aria-label="Interview status"
          selectSize="md"
          value={status}
          onChange={(e) => setStatus(e.target.value as InterviewStatus)}
        >
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              Status: {INTERVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Interview result"
          selectSize="md"
          value={result}
          onChange={(e) => setResult(e.target.value as InterviewResult)}
        >
          {INTERVIEW_RESULTS.map((r) => (
            <option key={r} value={r}>
              Result: {INTERVIEW_RESULT_LABELS[r]}
            </option>
          ))}
        </Select>

        <Button
          variant="primary"
          size="md"
          disabled={isPending}
          onClick={handleSaveOutcome}
        >
          Save Feedback & Result
        </Button>
      </div>

      <Input
        type="text"
        inputSize="md"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Post-interview feedback or outcome notes..."
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
        <Card padding="md" className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-section-title text-foreground">
              Documents Associated with This Application
            </h2>
            <Link
              href="/documents"
              className="font-semibold text-primary-text hover:underline"
            >
              Open Document Repository &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-subtle p-3">
            <div>
              <span className="text-muted-foreground">CV Version Recorded:</span>
              <p className="mt-0.5 font-semibold text-foreground">
                {cvVersionLabel || "Not specified"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                Cover Letter Version:
              </span>
              <p className="mt-0.5 font-semibold text-foreground">
                {coverLetterVersionLabel || "Not specified"}
              </p>
            </div>
          </div>

          {!careerExtras || careerExtras.attachedDocuments.length === 0 ? (
            <p className="py-4 text-muted-foreground">
              No repository document versions linked yet. Use the form on the
              right to link a CV, Cover Letter, or Offer document version.
            </p>
          ) : (
            <div className="space-y-2">
              {careerExtras.attachedDocuments.map((att) => (
                <div
                  key={att.linkId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="primary" className="font-mono uppercase">
                        {att.role}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {att.document.title} ({att.version.label})
                      </span>
                    </div>
                    {att.version.filename && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {att.version.filename}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {att.version.storageKey && (
                      <Button variant="secondary" size="sm" asChild>
                        <a
                          href={`/api/documents/versions/${att.version.id}/file?download=1`}
                          download
                        >
                          Download
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
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
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padding="md" className="lg:col-span-5">
        <form onSubmit={handleAttach} className="space-y-3.5 text-xs">
          <h3 className="text-section-title text-foreground">
            Associate Repository Document Version
          </h3>

          <FormField label="Select Document Version">
            <Select
              selectSize="lg"
              value={selectedVerId}
              onChange={(e) => setSelectedVerId(e.target.value)}
            >
              <option value="">Choose a document version...</option>
              {(careerExtras?.availableVersions ?? []).map((item) => (
                <option key={item.version.id} value={item.version.id}>
                  {item.document.title} - v{item.version.versionNo} (
                  {item.version.label})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Role on This Application">
            <Select
              selectSize="lg"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "cv" | "cover_letter" | "other")
              }
            >
              <option value="cv">CV Version Used</option>
              <option value="cover_letter">Cover Letter Version</option>
              <option value="other">Supporting / Offer Document</option>
            </Select>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending || !selectedVerId}
            className="w-full"
          >
            Link Document Version
          </Button>
        </form>
      </Card>
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
    <Card padding="md">
      <form onSubmit={handleSaveOffer} className="space-y-4 text-xs">
        <div>
          <h2 className="text-section-title text-foreground">
            Employment Offer & Recruitment Outcome Management
          </h2>
          <p className="text-muted-foreground">
            Record proposed salary, benefits, joining date, and offer decision.
            Accepting an offer transitions the application to Hired (Successful).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Offered Position Title" required>
            <Input
              type="text"
              inputSize="lg"
              required
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
            />
          </FormField>

          <FormField label="Proposed Base Salary">
            <Input
              type="number"
              inputSize="lg"
              min={0}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="28500000"
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Currency & Period">
            <div className="flex gap-2">
              <Select
                aria-label="Offer currency"
                selectSize="lg"
                wrapperClassName="w-24 shrink-0"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Offer salary period"
                selectSize="lg"
                value={salaryPeriod}
                onChange={(e) =>
                  setSalaryPeriod(e.target.value as SalaryPeriod)
                }
              >
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {SALARY_PERIOD_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
          </FormField>

          <FormField label="Offer Received Date" required>
            <Input
              type="date"
              inputSize="lg"
              required
              value={offerReceivedOn}
              onChange={(e) => setOfferReceivedOn(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Offer Response Deadline">
            <Input
              type="date"
              inputSize="lg"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Proposed Joining Date">
            <Input
              type="date"
              inputSize="lg"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="tabular-nums"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Offer Decision">
            <Select
              selectSize="lg"
              value={decision}
              onChange={(e) => setDecision(e.target.value as OfferDecision)}
              className="font-semibold"
            >
              {OFFER_DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {OFFER_DECISION_LABELS[d]}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 font-semibold text-foreground">
              <input
                type="checkbox"
                checked={syncStage}
                onChange={(e) => setSyncStage(e.target.checked)}
              />
              Automatically sync pipeline stage (Offer / Hired / Withdrawn)
            </label>
          </div>
        </div>

        <FormField label="Benefits & Compensation Package Breakdown">
          <Textarea
            rows={3}
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            placeholder="THR, bonus structure, health insurance, equity/ESOP, leave days, remote allowance..."
          />
        </FormField>

        <FormField label="Negotiation & Offer Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save Employment Offer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
