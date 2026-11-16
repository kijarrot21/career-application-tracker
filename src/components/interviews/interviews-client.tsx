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
import { SampleBadge } from "@/components/ui/badges";
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
  // Monday = 0 ... Sunday = 6
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

  const filteredInterviews = data.interviews.filter((i) => {
    if (typeFilter !== "all" && i.interviewType !== typeFilter) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Interview & Technical Assessment Management
          </h1>
          <p className="mt-0.5 text-body-sm text-[#64748B]">
            Monitor upcoming interviews, calendar schedules, preparation notes, interview feedback, and technical assessments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("assessments")}
            className="btn-secondary h-9 px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Assessments ({data.assessments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("schedule")}
            className="btn-primary h-9 px-3.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Interview
          </button>
        </div>
      </div>

      {/* KPI Metric Tiles (Executive Precision 4-Column Grid) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-label-md uppercase text-[#64748B]">
            Scheduled Interviews
          </p>
          <p className="mt-2 text-metric-num text-[#0F172A] dark:text-slate-100">
            {data.metrics.scheduledCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#204CD3] dark:text-[#B7C4FF]">
            Upcoming in pipeline
          </p>
        </div>

        <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-label-md uppercase text-[#64748B]">
            Completed Rounds
          </p>
          <p className="mt-2 text-metric-num text-[#0F172A] dark:text-slate-100">
            {data.metrics.completedCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#10B981]">
            {data.metrics.passedCount} passed rounds
          </p>
        </div>

        <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-label-md uppercase text-[#64748B]">
            Interview Pass Rate
          </p>
          <p className="mt-2 text-metric-num text-[#0F172A] dark:text-slate-100">
            {data.metrics.passRate != null ? `${data.metrics.passRate}%` : "N/A"}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Across decided rounds
          </p>
        </div>

        <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-label-md uppercase text-[#64748B]">
            Pending Assessments
          </p>
          <p className="mt-2 text-metric-num text-[#0F172A] dark:text-slate-100">
            {data.metrics.pendingAssessmentsCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#B45309]">
            {data.assessments.length} total recorded tests
          </p>
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0] dark:border-slate-800">
        {(
          [
            {
              key: "calendar",
              label: "Calendar & Split Inspector",
              icon: CalendarIcon,
            },
            {
              key: "list",
              label: `All Interviews (${data.interviews.length})`,
              icon: ListFilter,
            },
            {
              key: "assessments",
              label: `Assessments & Technical Tests (${data.assessments.length})`,
              icon: ClipboardCheck,
            },
            {
              key: "schedule",
              label: "Schedule New Interview",
              icon: CalendarClock,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab === item.key
                  ? "border-[#204CD3] text-[#204CD3] dark:border-[#3B66F5] dark:text-[#B7C4FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Interactive Calendar + 60/40 Split Inspector */}
      {tab === "calendar" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 60% Left: Month Calendar Grid */}
          <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                  {MONTH_NAMES[calMonth]} {calYear}
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Click any interview on the calendar to open its preparation & feedback inspector.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  aria-label="Previous month"
                  className="btn-secondary h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalYear(initialYearMonth.year);
                    setCalMonth(initialYearMonth.month);
                  }}
                  className="btn-secondary h-8 px-2.5 text-xs"
                >
                  Current Month
                </button>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  aria-label="Next month"
                  className="btn-secondary h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
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
                      className="min-h-24 rounded-[6px] bg-[#F8FAFC]/60 dark:bg-slate-950/40"
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
                    className="min-h-24 rounded-[6px] border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 transition-colors hover:border-[#CBD5E1] dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="mb-1 text-right font-mono text-[11px] font-semibold text-[#64748B] tabular-nums">
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
                            className={`block w-full truncate rounded-[4px] px-1.5 py-0.5 text-left text-[10px] font-semibold transition-colors ${
                              isSelected
                                ? "bg-[#204CD3] text-white"
                                : intv.result === "passed"
                                  ? "bg-[#ECFDF5] text-[#047857]"
                                  : intv.status === "cancelled"
                                    ? "bg-[#FFF1F2] text-[#BE123C]"
                                    : "bg-[#EEF2FF] text-[#1D4ED8]"
                            }`}
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
                          className="block w-full truncate rounded-[4px] bg-[#FFFBEB] px-1.5 py-0.5 text-left text-[10px] font-semibold text-[#B45309]"
                        >
                          Test: {ass.application.companyName}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 40% Right: Contextual Interview Inspector & Editor */}
          <div className="lg:col-span-5">
            {selectedInterview ? (
              <InterviewInspectorEditor
                key={selectedInterview.id}
                interview={selectedInterview}
                timezone={data.timezone}
              />
            ) : (
              <div className="elevation-1 flex h-full flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <CalendarClock className="h-8 w-8 text-[#64748B]" />
                <p className="mt-2 text-title-md text-[#0F172A] dark:text-slate-100">
                  No interview selected
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Schedule your first interview or click any event on the calendar to inspect preparation notes and record feedback.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: All Interviews List */}
      {tab === "list" && (
        <div className="space-y-4">
          <div className="elevation-1 flex flex-wrap items-center gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <select
              aria-label="Filter by interview type"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as InterviewType | "all")
              }
              className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Interview Types</option>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INTERVIEW_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by interview status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as InterviewStatus | "all")
              }
              className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              {INTERVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INTERVIEW_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {filteredInterviews.length === 0 ? (
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] py-12 text-center text-[#64748B] dark:border-slate-800 dark:bg-slate-900">
              No interviews match the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInterviews.map((intv) => (
                <div
                  key={intv.id}
                  className="elevation-2 flex flex-col justify-between gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-[2px] text-[11px] font-semibold text-[#1D4ED8]">
                        {
                          INTERVIEW_TYPE_LABELS[
                            intv.interviewType as InterviewType
                          ]
                        }
                      </span>
                      <span className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                        {intv.application.jobTitle} at{" "}
                        {intv.application.companyName}
                      </span>
                      <Link
                        href={`/applications/${intv.application.id}`}
                        className="font-mono text-xs font-semibold text-[#204CD3] hover:underline"
                      >
                        ({intv.application.code})
                      </Link>
                      {intv.isSample && <SampleBadge />}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#64748B] tabular-nums">
                      <span>
                        When:{" "}
                        <strong className="text-[#0F172A] dark:text-slate-200">
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
                          className="inline-flex items-center gap-1 font-semibold text-[#204CD3] hover:underline"
                        >
                          Meeting Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#334155] dark:bg-slate-800 dark:text-slate-300">
                      {INTERVIEW_STATUS_LABELS[intv.status as InterviewStatus]}{" "}
                      ·{" "}
                      {INTERVIEW_RESULT_LABELS[intv.result as InterviewResult]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInterviewId(intv.id);
                        setTab("calendar");
                      }}
                      className="btn-secondary h-8 px-3 text-xs"
                    >
                      Inspect & Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Assessments & Technical Tests */}
      {tab === "assessments" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Technical Tests, Case Studies & Psychometric Assessments
              </h2>

              {data.assessments.length === 0 ? (
                <p className="py-6 text-[#64748B]">
                  No assessments recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.assessments.map((ass) => (
                    <div
                      key={ass.id}
                      className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-1.5 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
                            {
                              ASSESSMENT_TYPE_LABELS[
                                ass.assessmentType as AssessmentType
                              ]
                            }
                          </span>
                          <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                            {ass.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              await deleteAssessmentAction(ass.id);
                              toast.success("Assessment removed.");
                              router.refresh();
                            })
                          }
                          className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#FFF1F2] hover:text-[#BE123C]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="text-[#334155] dark:text-slate-300">
                        <Link
                          href={`/applications/${ass.application.id}`}
                          className="font-mono font-semibold text-[#204CD3] hover:underline"
                        >
                          {ass.application.code}
                        </Link>{" "}
                        · {ass.application.jobTitle} at{" "}
                        {ass.application.companyName}
                      </p>

                      <div className="flex flex-wrap gap-4 text-[11px] text-[#64748B] tabular-nums">
                        {ass.dueAt && (
                          <span>Due: {formatDate(ass.dueAt)}</span>
                        )}
                        {ass.score && (
                          <span>
                            Score:{" "}
                            <strong className="text-[#0F172A] dark:text-slate-100">
                              {ass.score}
                              {ass.maxScore ? ` / ${ass.maxScore}` : ""}
                            </strong>
                          </span>
                        )}
                        <span>
                          Result:{" "}
                          <strong>
                            {
                              INTERVIEW_RESULT_LABELS[
                                ass.result as InterviewResult
                              ]
                            }
                          </strong>
                        </span>
                      </div>

                      {ass.notes && (
                        <p className="text-[#64748B]">{ass.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveAssessment}
            className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3.5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Record Technical Test / Assessment
            </h3>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application *
              </label>
              <select
                required
                value={assAppId}
                onChange={(e) => setAssAppId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select application...</option>
                {data.applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}: {a.jobTitle} at {a.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Assessment Type
                </label>
                <select
                  value={assType}
                  onChange={(e) => setAssType(e.target.value as AssessmentType)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ASSESSMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Due Date
                </label>
                <input
                  type="date"
                  value={assDueAt}
                  onChange={(e) => setAssDueAt(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Assessment Title *
              </label>
              <input
                type="text"
                required
                value={assTitle}
                onChange={(e) => setAssTitle(e.target.value)}
                placeholder="HackerRank Backend Concurrency Challenge"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Score
                </label>
                <input
                  type="text"
                  value={assScore}
                  onChange={(e) => setAssScore(e.target.value)}
                  placeholder="90"
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Max Score
                </label>
                <input
                  type="text"
                  value={assMaxScore}
                  onChange={(e) => setAssMaxScore(e.target.value)}
                  placeholder="100"
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Result
                </label>
                <select
                  value={assResult}
                  onChange={(e) =>
                    setAssResult(e.target.value as InterviewResult)
                  }
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                >
                  {INTERVIEW_RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {INTERVIEW_RESULT_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Notes & Evaluation Summary
              </label>
              <textarea
                rows={3}
                value={assNotes}
                onChange={(e) => setAssNotes(e.target.value)}
                placeholder="Topics covered, test platform link, or submission notes..."
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary h-9 w-full text-xs disabled:opacity-50"
            >
              Save Assessment
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Schedule New Interview */}
      {tab === "schedule" && (
        <form
          onSubmit={handleScheduleInterview}
          className="elevation-1 mx-auto max-w-3xl rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Schedule New Interview Session
            </h2>
            <p className="text-[#64748B]">
              Record interview schedule, meeting link, interviewer details, and preparation notes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application *
              </label>
              <select
                required
                value={newAppId}
                onChange={(e) => setNewAppId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select application...</option>
                {data.applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}: {a.jobTitle} at {a.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Interview Type *
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as InterviewType)}
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
              <label
                htmlFor="schedule-starts-at"
                className="block font-semibold text-[#334155] dark:text-slate-300"
              >
                Date & Time *
              </label>
              <input
                id="schedule-starts-at"
                type="datetime-local"
                required
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={10}
                max={480}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Meeting Link (Google Meet / Zoom / Teams)
              </label>
              <input
                type="url"
                value={newMeetingUrl}
                onChange={(e) => setNewMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                On-Site Location (If Applicable)
              </label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Office tower / floor"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Interviewer Name
              </label>
              <input
                type="text"
                value={newInterviewerName}
                onChange={(e) => setNewInterviewerName(e.target.value)}
                placeholder="Andi Prasetyo"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Interviewer Position
                </label>
                <input
                  type="text"
                  value={newInterviewerPosition}
                  onChange={(e) => setNewInterviewerPosition(e.target.value)}
                  placeholder="VP of Engineering"
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#334155] dark:text-slate-300">
                  Interviewer Contact
                </label>
                <input
                  type="text"
                  value={newInterviewerContact}
                  onChange={(e) => setNewInterviewerContact(e.target.value)}
                  placeholder="email or LinkedIn"
                  className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Candidate Preparation Notes
              </label>
              <textarea
                rows={3}
                value={newPrepNotes}
                onChange={(e) => setNewPrepNotes(e.target.value)}
                placeholder="Architecture topics, STAR examples, company research..."
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Interview Questions (Expected & To Ask)
              </label>
              <textarea
                rows={3}
                value={newQuestions}
                onChange={(e) => setNewQuestions(e.target.value)}
                placeholder="Questions asked by interviewer or questions to ask..."
                className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary h-9 px-4 text-xs disabled:opacity-50"
            >
              {isPending ? "Scheduling..." : "Save Interview Schedule"}
            </button>
          </div>
        </form>
      )}
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

  function handleDelete() {
    if (!window.confirm("Delete this interview record?")) return;
    startTransition(async () => {
      await deleteInterviewAction(interview.id);
      toast.success("Interview deleted.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3.5 text-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
              {INTERVIEW_TYPE_LABELS[interviewType]}
            </span>
            <Link
              href={`/applications/${interview.application.id}`}
              className="font-mono font-semibold text-[#204CD3] hover:underline"
            >
              {interview.application.code}
            </Link>
          </div>
          <h3 className="mt-1 text-headline-sm text-[#0F172A] dark:text-slate-100">
            {interview.application.jobTitle} at{" "}
            {interview.application.companyName}
          </h3>
          <p className="text-[11px] text-[#64748B] tabular-nums">
            Scheduled: {formatDateTime(interview.startsAt, timezone)}
          </p>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          title="Delete interview"
          className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#FFF1F2] hover:text-[#BE123C]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Interview Type
          </label>
          <select
            value={interviewType}
            onChange={(e) => setInterviewType(e.target.value as InterviewType)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
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
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InterviewStatus)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          >
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERVIEW_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Result
          </label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as InterviewResult)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          >
            {INTERVIEW_RESULTS.map((r) => (
              <option key={r} value={r}>
                {INTERVIEW_RESULT_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Date & Time (UTC)
          </label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Location / Room
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Meeting Link
        </label>
        <input
          type="url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Interviewer Name
          </label>
          <input
            type="text"
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Position
          </label>
          <input
            type="text"
            value={interviewerPosition}
            onChange={(e) => setInterviewerPosition(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Contact
          </label>
          <input
            type="text"
            value={interviewerContact}
            onChange={(e) => setInterviewerContact(e.target.value)}
            className="mt-1 h-9 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Candidate Preparation Notes
        </label>
        <textarea
          rows={2}
          value={preparationNotes}
          onChange={(e) => setPreparationNotes(e.target.value)}
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Interview Questions
        </label>
        <textarea
          rows={2}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Interview Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes taken during the interview..."
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <div>
        <label className="block font-semibold text-[#334155] dark:text-slate-300">
          Post-Interview Feedback
        </label>
        <textarea
          rows={2}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Summary of feedback, strengths, and areas discussed..."
          className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary h-9 w-full text-xs disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save Interview Details"}
      </button>
    </form>
  );
}
