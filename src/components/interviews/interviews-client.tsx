"use client";

import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  ListFilter,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  SampleBadge,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import {
  ASSESSMENT_TYPE_LABELS,
  ASSESSMENT_TYPES,
  INTERVIEW_RESULT_LABELS,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPES,
  type AssessmentType,
  type InterviewResult,
  type InterviewStatus,
  type InterviewType,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { scheduleInterviewAction } from "@/server/actions/applications";
import {
  deleteAssessmentAction,
  deleteInterviewAction,
  saveAssessmentAction,
  updateInterviewFullAction,
} from "@/server/actions/career";
import type { getInterviewsModuleData } from "@/server/queries/career";

type InterviewsData = Awaited<ReturnType<typeof getInterviewsModuleData>>;
type InterviewRow = InterviewsData["interviews"][number];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function buildMonthCalendarCells(year: number, monthZeroIndexed: number) {
  const firstDay = new Date(Date.UTC(year, monthZeroIndexed, 1));
  const daysInMonth = new Date(
    Date.UTC(year, monthZeroIndexed + 1, 0),
  ).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7;

  const cells: { dateStr: string | null; dayNumber: number | null }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ dateStr: null, dayNumber: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(monthZeroIndexed + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({
      dateStr: `${year}-${mm}-${dd}`,
      dayNumber: d,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateStr: null, dayNumber: null });
  }
  return cells;
}

export function InterviewsClient({
  data,
  initialYearMonth,
}: {
  data: InterviewsData;
  initialYearMonth: { year: number; month: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<
    "calendar" | "list" | "assessments" | "schedule"
  >("calendar");

  const [calYear, setCalYear] = useState(initialYearMonth.year);
  const [calMonth, setCalMonth] = useState(initialYearMonth.month);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(
    data.interviews[0]?.id ?? null,
  );

  // Filters for list view
  const [typeFilter, setTypeFilter] = useState<InterviewType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "all">(
    "all",
  );

  // New interview form state
  const [newAppId, setNewAppId] = useState(data.applications[0]?.id ?? "");
  const [newType, setNewType] = useState<InterviewType>("hr");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newDuration, setNewDuration] = useState("45");
  const [newMeetingUrl, setNewMeetingUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newInterviewerName, setNewInterviewerName] = useState("");
  const [newInterviewerPosition, setNewInterviewerPosition] = useState("");
  const [newInterviewerContact, setNewInterviewerContact] = useState("");
  const [newPrepNotes, setNewPrepNotes] = useState("");
  const [newQuestions, setNewQuestions] = useState("");

  // New assessment form state
  const [assAppId, setAssAppId] = useState(data.applications[0]?.id ?? "");
  const [assType, setAssType] = useState<AssessmentType>("technical");
  const [assTitle, setAssTitle] = useState("");
  const [assDueAt, setAssDueAt] = useState("");
  const [assScore, setAssScore] = useState("");
  const [assMaxScore, setAssMaxScore] = useState("100");
  const [assResult, setAssResult] = useState<InterviewResult>("pending");
  const [assNotes, setAssNotes] = useState("");
  const [deleteAssessmentId, setDeleteAssessmentId] = useState<string | null>(
    null,
  );

  const cells = buildMonthCalendarCells(calYear, calMonth);
  const selectedInterview =
    data.interviews.find((i) => i.id === selectedInterviewId) ??
    data.interviews[0] ??
    null;

  function stepMonth(delta: number) {
    const next = new Date(Date.UTC(calYear, calMonth + delta, 1));
    setCalYear(next.getUTCFullYear());
    setCalMonth(next.getUTCMonth());
  }

  function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!newAppId) {
      toast.error("Select an application first.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await scheduleInterviewAction({
          applicationId: newAppId,
          interviewType: newType,
          startsAt: newStartsAt,
          durationMinutes: Number(newDuration) || 45,
          meetingUrl: newMeetingUrl || null,
          location: newLocation || null,
          interviewerName: newInterviewerName || null,
          interviewerPosition: newInterviewerPosition || null,
          interviewerContact: newInterviewerContact || null,
          preparationNotes: newPrepNotes || null,
          questions: newQuestions || null,
        });
        setNewStartsAt("");
        setNewMeetingUrl("");
        setNewLocation("");
        setNewPrepNotes("");
        setNewQuestions("");
        setSelectedInterviewId(created.id);
        setTab("calendar");
        toast.success("Interview scheduled.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not schedule interview",
        );
      }
    });
  }

  function handleSaveAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!assAppId) {
      toast.error("Select an application first.");
      return;
    }
    startTransition(async () => {
      try {
        await saveAssessmentAction({
          applicationId: assAppId,
          assessmentType: assType,
          title: assTitle,
          dueAt: assDueAt || null,
          score: assScore || null,
          maxScore: assMaxScore || null,
          result: assResult,
          notes: assNotes || null,
        });
        setAssTitle("");
        setAssDueAt("");
        setAssScore("");
        setAssNotes("");
        toast.success("Assessment saved.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save assessment",
        );
      }
    });
  }

  function handleConfirmDeleteAssessment() {
    if (!deleteAssessmentId) return;
    startTransition(async () => {
      try {
        await deleteAssessmentAction(deleteAssessmentId);
        toast.success("Assessment removed.");
        setDeleteAssessmentId(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete assessment",
        );
      }
    });
  }

  const filteredInterviews = data.interviews.filter((i) => {
    if (typeFilter !== "all" && i.interviewType !== typeFilter) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-xs">
      <PageHeader
        title="Interview & Technical Assessment Management"
        description="Monitor upcoming interviews, calendar schedules, preparation notes, interview feedback, and technical assessments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setTab("assessments")}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Assessments ({data.assessments.length})
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setTab("schedule")}
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule Interview
            </Button>
          </div>
        }
      />

      {/* KPI Metric Tiles */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-label-sm uppercase text-muted-foreground">
            Scheduled Interviews
          </p>
          <p className="text-metric-num mt-2 text-foreground">
            {data.metrics.scheduledCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-primary-text">
            Upcoming in pipeline
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-label-sm uppercase text-muted-foreground">
            Completed Rounds
          </p>
          <p className="text-metric-num mt-2 text-foreground">
            {data.metrics.completedCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-primary-text">
            {data.metrics.passedCount} passed rounds
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-label-sm uppercase text-muted-foreground">
            Interview Pass Rate
          </p>
          <p className="text-metric-num mt-2 text-foreground">
            {data.metrics.passRate != null
              ? `${data.metrics.passRate}%`
              : "N/A"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Across decided rounds
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-label-sm uppercase text-muted-foreground">
            Pending Assessments
          </p>
          <p className="text-metric-num mt-2 text-foreground">
            {data.metrics.pendingAssessmentsCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-warning-on-soft">
            {data.assessments.length} total recorded tests
          </p>
        </Card>
      </section>

      {/* View Switcher Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setTab(v as "calendar" | "list" | "assessments" | "schedule")
        }
      >
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar & Split Inspector
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListFilter className="h-3.5 w-3.5" />
            All Interviews ({data.interviews.length})
          </TabsTrigger>
          <TabsTrigger value="assessments">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Assessments & Technical Tests ({data.assessments.length})
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClock className="h-3.5 w-3.5" />
            Schedule New Interview
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB 1: Interactive Calendar + Split Inspector */}
      {tab === "calendar" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card padding="md" className="lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-section-title text-foreground">
                  {MONTH_NAMES[calMonth]} {calYear}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Click any interview on the calendar to open its preparation &
                  feedback inspector.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => stepMonth(-1)}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCalYear(initialYearMonth.year);
                    setCalMonth(initialYearMonth.month);
                  }}
                >
                  Current Month
                </Button>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => stepMonth(1)}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-label-xs uppercase text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {cells.map((cell, idx) => {
                if (!cell.dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-24 rounded-xl bg-surface-subtle/60"
                    />
                  );
                }

                const dayInterviews = data.interviews.filter(
                  (i) => i.startsAt.toISOString().slice(0, 10) === cell.dateStr,
                );
                const dayAssessments = data.assessments.filter(
                  (a) =>
                    a.dueAt &&
                    a.dueAt.toISOString().slice(0, 10) === cell.dateStr,
                );

                return (
                  <div
                    key={cell.dateStr}
                    className="min-h-24 rounded-xl border border-border-subtle bg-card p-1.5 transition-colors hover:border-border"
                  >
                    <div className="mb-1 text-right font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {cell.dayNumber}
                    </div>

                    <div className="space-y-1">
                      {dayInterviews.map((intv) => {
                        const isSelected = selectedInterview?.id === intv.id;
                        return (
                          <button
                            key={intv.id}
                            type="button"
                            onClick={() => setSelectedInterviewId(intv.id)}
                            className={cn(
                              "block w-full cursor-pointer truncate rounded-lg px-1.5 py-0.5 text-left text-[10px] font-semibold transition-colors",
                              isSelected
                                ? "bg-primary text-white"
                                : intv.result === "passed"
                                  ? "bg-success-soft text-success-on-soft"
                                  : intv.status === "cancelled"
                                    ? "bg-destructive-soft text-destructive-on-soft"
                                    : "bg-primary-soft text-primary-on-soft",
                            )}
                          >
                            {intv.application.companyName}
                          </button>
                        );
                      })}

                      {dayAssessments.map((ass) => (
                        <button
                          key={ass.id}
                          type="button"
                          onClick={() => setTab("assessments")}
                          className="block w-full cursor-pointer truncate rounded-lg bg-warning-soft px-1.5 py-0.5 text-left text-[10px] font-semibold text-warning-on-soft"
                        >
                          Test: {ass.application.companyName}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="lg:col-span-5">
            {selectedInterview ? (
              <InterviewInspectorEditor
                key={selectedInterview.id}
                interview={selectedInterview}
                timezone={data.timezone}
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No interview selected"
                description="Schedule your first interview or click any event on the calendar to inspect preparation notes and record feedback."
                className="h-full"
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: All Interviews List */}
      {tab === "list" && (
        <div className="space-y-4">
          <Card padding="sm" className="flex flex-wrap items-center gap-3">
            <Select
              aria-label="Filter by interview type"
              selectSize="lg"
              wrapperClassName="w-52"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as InterviewType | "all")
              }
            >
              <option value="all">All Interview Types</option>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INTERVIEW_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by interview status"
              selectSize="lg"
              wrapperClassName="w-48"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as InterviewStatus | "all")
              }
            >
              <option value="all">All Statuses</option>
              {INTERVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INTERVIEW_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Card>

          {filteredInterviews.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No interviews match the selected filters"
            />
          ) : (
            <div className="space-y-3">
              {filteredInterviews.map((intv) => (
                <Card
                  key={intv.id}
                  elevation="interactive"
                  padding="sm"
                  className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">
                        {
                          INTERVIEW_TYPE_LABELS[
                            intv.interviewType as InterviewType
                          ]
                        }
                      </Badge>
                      <span className="text-section-title text-foreground">
                        {intv.application.jobTitle} at{" "}
                        {intv.application.companyName}
                      </span>
                      <Link
                        href={`/applications/${intv.application.id}`}
                        className="font-mono text-xs font-semibold text-primary-text hover:underline"
                      >
                        ({intv.application.code})
                      </Link>
                      {intv.isSample && <SampleBadge />}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
                      <span>
                        When:{" "}
                        <strong className="text-foreground">
                          {formatDateTime(intv.startsAt, data.timezone)}
                        </strong>{" "}
                        ({intv.durationMinutes} min)
                      </span>
                      {intv.interviewerName && (
                        <span>
                          Interviewer: {intv.interviewerName}
                          {intv.interviewerPosition
                            ? ` (${intv.interviewerPosition})`
                            : ""}
                        </span>
                      )}
                      {intv.meetingUrl && (
                        <a
                          href={intv.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
                        >
                          Meeting Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {INTERVIEW_STATUS_LABELS[intv.status as InterviewStatus]}{" "}
                      ·{" "}
                      {INTERVIEW_RESULT_LABELS[intv.result as InterviewResult]}
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedInterviewId(intv.id);
                        setTab("calendar");
                      }}
                    >
                      Inspect & Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Assessments & Technical Tests */}
      {tab === "assessments" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <Card padding="md" className="space-y-3">
              <h2 className="text-section-title text-foreground">
                Technical Tests, Case Studies & Psychometric Assessments
              </h2>

              {data.assessments.length === 0 ? (
                <p className="py-6 text-muted-foreground">
                  No assessments recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.assessments.map((ass) => (
                    <div
                      key={ass.id}
                      className="space-y-1.5 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="warning">
                            {
                              ASSESSMENT_TYPE_LABELS[
                                ass.assessmentType as AssessmentType
                              ]
                            }
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {ass.title}
                          </span>
                        </div>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          disabled={isPending}
                          aria-label={`Delete assessment ${ass.title}`}
                          onClick={() => setDeleteAssessmentId(ass.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <p className="text-muted-foreground">
                        <Link
                          href={`/applications/${ass.application.id}`}
                          className="font-mono font-semibold text-primary-text hover:underline"
                        >
                          {ass.application.code}
                        </Link>{" "}
                        · {ass.application.jobTitle} at{" "}
                        {ass.application.companyName}
                      </p>

                      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground tabular-nums">
                        {ass.dueAt && <span>Due: {formatDate(ass.dueAt)}</span>}
                        {ass.score && (
                          <span>
                            Score:{" "}
                            <strong className="text-foreground">
                              {ass.score}
                              {ass.maxScore ? ` / ${ass.maxScore}` : ""}
                            </strong>
                          </span>
                        )}
                        <span>
                          Result:{" "}
                          <strong className="text-foreground">
                            {
                              INTERVIEW_RESULT_LABELS[
                                ass.result as InterviewResult
                              ]
                            }
                          </strong>
                        </span>
                      </div>

                      {ass.notes && (
                        <p className="text-muted-foreground">{ass.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card padding="md" className="lg:col-span-5">
            <form onSubmit={handleSaveAssessment} className="space-y-3.5">
              <h3 className="text-section-title text-foreground">
                Record Technical Test / Assessment
              </h3>

              <FormField label="Application" required>
                <Select
                  required
                  selectSize="lg"
                  value={assAppId}
                  onChange={(e) => setAssAppId(e.target.value)}
                >
                  <option value="">Select application...</option>
                  {data.applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}: {a.jobTitle} at {a.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Assessment Type">
                  <Select
                    selectSize="lg"
                    value={assType}
                    onChange={(e) =>
                      setAssType(e.target.value as AssessmentType)
                    }
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ASSESSMENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Due Date">
                  <Input
                    type="date"
                    inputSize="lg"
                    value={assDueAt}
                    onChange={(e) => setAssDueAt(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Assessment Title" required>
                <Input
                  type="text"
                  inputSize="lg"
                  required
                  value={assTitle}
                  onChange={(e) => setAssTitle(e.target.value)}
                  placeholder="HackerRank Backend Concurrency Challenge"
                />
              </FormField>

              <div className="grid grid-cols-3 gap-2.5">
                <FormField label="Score">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={assScore}
                    onChange={(e) => setAssScore(e.target.value)}
                    placeholder="90"
                    className="tabular-nums"
                  />
                </FormField>
                <FormField label="Max Score">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={assMaxScore}
                    onChange={(e) => setAssMaxScore(e.target.value)}
                    placeholder="100"
                    className="tabular-nums"
                  />
                </FormField>
                <FormField label="Result">
                  <Select
                    selectSize="lg"
                    value={assResult}
                    onChange={(e) =>
                      setAssResult(e.target.value as InterviewResult)
                    }
                  >
                    {INTERVIEW_RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {INTERVIEW_RESULT_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <FormField label="Notes & Evaluation Summary">
                <Textarea
                  rows={3}
                  value={assNotes}
                  onChange={(e) => setAssNotes(e.target.value)}
                  placeholder="Topics covered, test platform link, or submission notes..."
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full"
              >
                Save Assessment
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 4: Schedule New Interview */}
      {tab === "schedule" && (
        <Card padding="md" className="mx-auto max-w-3xl">
          <form onSubmit={handleScheduleInterview} className="space-y-4">
            <div>
              <h2 className="text-section-title text-foreground">
                Schedule New Interview Session
              </h2>
              <p className="text-muted-foreground">
                Record interview schedule, meeting link, interviewer details,
                and preparation notes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Application" required>
                <Select
                  required
                  selectSize="lg"
                  value={newAppId}
                  onChange={(e) => setNewAppId(e.target.value)}
                >
                  <option value="">Select application...</option>
                  {data.applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}: {a.jobTitle} at {a.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Interview Type" required>
                <Select
                  selectSize="lg"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as InterviewType)}
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INTERVIEW_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Date & Time"
                htmlFor="schedule-starts-at"
                required
              >
                <Input
                  id="schedule-starts-at"
                  type="datetime-local"
                  inputSize="lg"
                  required
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="Duration (Minutes)">
                <Input
                  type="number"
                  inputSize="lg"
                  min={10}
                  max={480}
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>

              <FormField label="Meeting Link (Google Meet / Zoom / Teams)">
                <Input
                  type="url"
                  inputSize="lg"
                  value={newMeetingUrl}
                  onChange={(e) => setNewMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                />
              </FormField>

              <FormField label="On-Site Location (If Applicable)">
                <Input
                  type="text"
                  inputSize="lg"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Office tower / floor"
                />
              </FormField>

              <FormField label="Interviewer Name">
                <Input
                  type="text"
                  inputSize="lg"
                  value={newInterviewerName}
                  onChange={(e) => setNewInterviewerName(e.target.value)}
                  placeholder="Andi Prasetyo"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Interviewer Position">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={newInterviewerPosition}
                    onChange={(e) => setNewInterviewerPosition(e.target.value)}
                    placeholder="VP of Engineering"
                  />
                </FormField>
                <FormField label="Interviewer Contact">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={newInterviewerContact}
                    onChange={(e) => setNewInterviewerContact(e.target.value)}
                    placeholder="email or LinkedIn"
                  />
                </FormField>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Candidate Preparation Notes">
                <Textarea
                  rows={3}
                  value={newPrepNotes}
                  onChange={(e) => setNewPrepNotes(e.target.value)}
                  placeholder="Architecture topics, STAR examples, company research..."
                />
              </FormField>

              <FormField label="Interview Questions (Expected & To Ask)">
                <Textarea
                  rows={3}
                  value={newQuestions}
                  onChange={(e) => setNewQuestions(e.target.value)}
                  placeholder="Questions asked by interviewer or questions to ask..."
                />
              </FormField>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
              >
                {isPending ? "Scheduling..." : "Save Interview Schedule"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteAssessmentId)}
        onOpenChange={(next) => !next && setDeleteAssessmentId(null)}
        title="Delete technical assessment?"
        description="This assessment record and any saved scores will be permanently removed."
        confirmLabel="Delete Assessment"
        pending={isPending}
        onConfirm={handleConfirmDeleteAssessment}
      />
    </div>
  );
}

function InterviewInspectorEditor({
  interview,
  timezone,
}: {
  interview: InterviewRow;
  timezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [interviewType, setInterviewType] = useState<InterviewType>(
    interview.interviewType as InterviewType,
  );
  const [startsAt, setStartsAt] = useState(
    interview.startsAt.toISOString().slice(0, 16),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(interview.durationMinutes),
  );
  const [meetingUrl, setMeetingUrl] = useState(interview.meetingUrl ?? "");
  const [location, setLocation] = useState(interview.location ?? "");
  const [interviewerName, setInterviewerName] = useState(
    interview.interviewerName ?? "",
  );
  const [interviewerPosition, setInterviewerPosition] = useState(
    interview.interviewerPosition ?? "",
  );
  const [interviewerContact, setInterviewerContact] = useState(
    interview.interviewerContact ?? "",
  );
  const [preparationNotes, setPreparationNotes] = useState(
    interview.preparationNotes ?? "",
  );
  const [questions, setQuestions] = useState(interview.questions ?? "");
  const [notes, setNotes] = useState(interview.notes ?? "");
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [status, setStatus] = useState<InterviewStatus>(
    interview.status as InterviewStatus,
  );
  const [result, setResult] = useState<InterviewResult>(
    interview.result as InterviewResult,
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateInterviewFullAction({
          interviewId: interview.id,
          interviewType,
          startsAt,
          durationMinutes: Number(durationMinutes) || 45,
          meetingUrl: meetingUrl || null,
          location: location || null,
          interviewerName: interviewerName || null,
          interviewerPosition: interviewerPosition || null,
          interviewerContact: interviewerContact || null,
          preparationNotes: preparationNotes || null,
          questions: questions || null,
          notes: notes || null,
          feedback: feedback || null,
          status,
          result,
        });
        toast.success("Interview record updated.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update");
      }
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteInterviewAction(interview.id);
        toast.success("Interview deleted.");
        setDeleteOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  return (
    <>
      <Card padding="md">
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="flex items-start justify-between gap-2 border-b border-border-subtle pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary">
                  {INTERVIEW_TYPE_LABELS[interviewType]}
                </Badge>
                <Link
                  href={`/applications/${interview.application.id}`}
                  className="font-mono font-semibold text-primary-text hover:underline"
                >
                  {interview.application.code}
                </Link>
              </div>
              <h3 className="mt-1 text-section-title text-foreground">
                {interview.application.jobTitle} at{" "}
                {interview.application.companyName}
              </h3>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Scheduled: {formatDateTime(interview.startsAt, timezone)}
              </p>
            </div>

            <Button
              variant="destructive"
              size="icon-sm"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete interview"
              title="Delete interview"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Interview Type">
              <Select
                selectSize="md"
                value={interviewType}
                onChange={(e) =>
                  setInterviewType(e.target.value as InterviewType)
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
                inputSize="md"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Status">
              <Select
                selectSize="md"
                value={status}
                onChange={(e) => setStatus(e.target.value as InterviewStatus)}
              >
                {INTERVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INTERVIEW_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Result">
              <Select
                selectSize="md"
                value={result}
                onChange={(e) => setResult(e.target.value as InterviewResult)}
              >
                {INTERVIEW_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {INTERVIEW_RESULT_LABELS[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Date & Time (UTC)">
              <Input
                type="datetime-local"
                inputSize="md"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Location / Room">
              <Input
                type="text"
                inputSize="md"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Meeting Link">
            <Input
              type="url"
              inputSize="md"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-3 gap-2">
            <FormField label="Interviewer Name">
              <Input
                type="text"
                inputSize="md"
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
              />
            </FormField>
            <FormField label="Position">
              <Input
                type="text"
                inputSize="md"
                value={interviewerPosition}
                onChange={(e) => setInterviewerPosition(e.target.value)}
              />
            </FormField>
            <FormField label="Contact">
              <Input
                type="text"
                inputSize="md"
                value={interviewerContact}
                onChange={(e) => setInterviewerContact(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Candidate Preparation Notes">
            <Textarea
              rows={2}
              value={preparationNotes}
              onChange={(e) => setPreparationNotes(e.target.value)}
            />
          </FormField>

          <FormField label="Interview Questions">
            <Textarea
              rows={2}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
            />
          </FormField>

          <FormField label="Interview Notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes taken during the interview..."
            />
          </FormField>

          <FormField label="Post-Interview Feedback">
            <Textarea
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Summary of feedback, strengths, and areas discussed..."
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save Interview Details"}
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this interview record?"
        description="This interview schedule and its preparation notes will be permanently removed."
        confirmLabel="Delete Interview"
        pending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
