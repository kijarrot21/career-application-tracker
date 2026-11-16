"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Database,
  Kanban,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  getStageColorStyle,
  SampleBadge,
  StageBadge,
} from "@/components/ui/badges";
import {
  INTERVIEW_TYPE_LABELS,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  type InterviewType,
  type SearchStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { completeFollowUpTaskAction } from "@/server/actions/applications";
import {
  loadSampleDataAction,
  updateSearchStatusAction,
} from "@/server/actions/settings";
import type { getDashboardData } from "@/server/queries/dashboard";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const OUTCOME_COLORS: Record<string, string> = {
  active: "#204CD3",
  successful: "#10B981",
  unsuccessful: "#F43F5E",
  withdrawn: "#64748B",
  no_response: "#F59E0B",
};

export function DashboardClient({
  user,
  data,
}: {
  user: { name: string; email: string };
  data: DashboardData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { kpi } = data;

  function handleStatusChange(next: SearchStatus) {
    startTransition(async () => {
      try {
        await updateSearchStatusAction(next);
        toast.success(
          `Job search status updated to "${SEARCH_STATUS_LABELS[next]}".`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update status",
        );
      }
    });
  }

  function handleLoadSample() {
    startTransition(async () => {
      try {
        await loadSampleDataAction();
        toast.success("Sample demonstration data loaded.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load sample data",
        );
      }
    });
  }

  function handleCompleteTask(taskId: string) {
    startTransition(async () => {
      try {
        await completeFollowUpTaskAction(taskId, true);
        toast.success("Follow-up marked complete.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not complete task",
        );
      }
    });
  }

  const maxStageCount = Math.max(1, ...data.stageBreakdown.map((s) => s.count));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* TOP SECTION: Welcome, Search Status, Quick Actions */}
      <section className="elevation-1 flex flex-col justify-between gap-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
              Welcome back, {user.name}
            </h1>
            <select
              aria-label="Current job search status"
              value={data.settings.searchStatus}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as SearchStatus)
              }
              className="rounded-full border border-[#204CD3]/25 bg-[#EEF2FF] px-3 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[#1D4ED8] outline-none dark:border-[#204CD3]/40 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]"
            >
              {SEARCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SEARCH_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[13px] leading-[18px] text-[#64748B] dark:text-slate-400">
            Executive Career Command Center. All metrics are calculated from
            your recorded applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/jobs/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Job Vacancy
          </Link>
          <Link
            href="/applications?new=1"
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Application
          </Link>
          <Link
            href="/shortlist"
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#334155] transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            Shortlist
          </Link>
          {kpi.totalApplicationsSubmitted === 0 &&
            kpi.totalJobsDiscovered === 0 &&
            !data.sampleStatus.hasSampleData && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleLoadSample}
                className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 text-xs font-semibold text-[#B45309] hover:bg-[#FEF3C7] dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <Database className="h-3.5 w-3.5" />
                Load Sample Data
              </button>
            )}
        </div>
      </section>

      {/* KPI SECTION: 4 Primary Metric/KPI Tiles + 6 Secondary KPIs */}
      <section aria-label="Key Performance Indicators" className="space-y-4">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 xl:grid-cols-4 xl:gap-6">
          <div className="elevation-1 min-w-[230px] shrink-0 snap-start rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 md:min-w-0 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-label-md uppercase text-[#64748B] dark:text-slate-400">
              Total Applications
            </p>
            <p className="text-metric-num mt-2 text-[#0F172A] tabular-nums dark:text-slate-100">
              {kpi.totalApplicationsSubmitted}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
              From {kpi.totalJobsDiscovered} discovered vacancies
            </p>
          </div>

          <div className="elevation-1 min-w-[230px] shrink-0 snap-start rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 md:min-w-0 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-label-md uppercase text-[#64748B] dark:text-slate-400">
              Active Applications
            </p>
            <p className="text-metric-num mt-2 text-[#0F172A] tabular-nums dark:text-slate-100">
              {kpi.activeApplications}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
              {kpi.applicationsUnderScreening} currently under CV screening
            </p>
          </div>

          <div className="elevation-1 min-w-[230px] shrink-0 snap-start rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 md:min-w-0 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-label-md uppercase text-[#64748B] dark:text-slate-400">
              Upcoming Interviews
            </p>
            <p className="text-metric-num mt-2 text-[#0F172A] tabular-nums dark:text-slate-100">
              {kpi.interviewsScheduled}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#10B981] tabular-nums">
              Interview conversion:{" "}
              {kpi.applicationToInterviewRate != null
                ? `${kpi.applicationToInterviewRate}%`
                : "Not enough data"}
            </p>
          </div>

          <div className="elevation-1 min-w-[230px] shrink-0 snap-start rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 md:min-w-0 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-label-md uppercase text-[#64748B] dark:text-slate-400">
              Offers Received
            </p>
            <p className="text-metric-num mt-2 text-[#0F172A] tabular-nums dark:text-slate-100">
              {kpi.offersReceived}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#10B981] tabular-nums">
              {kpi.successfulApplications} accepted / hired
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Jobs Discovered" value={kpi.totalJobsDiscovered} />
          <MiniStat
            label="Under Screening"
            value={kpi.applicationsUnderScreening}
          />
          <MiniStat
            label="Hired / Successful"
            value={kpi.successfulApplications}
          />
          <MiniStat label="Rejected" value={kpi.rejectedApplications} />
          <MiniStat label="Withdrawn" value={kpi.withdrawnApplications} />
          <MiniStat label="No Response" value={kpi.noResponseApplications} />
        </div>
      </section>

      {/* MAIN SECTION: Pipeline, Upcoming Interviews, Recent Activity, Pending Follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Application Pipeline */}
        <section className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Application Pipeline
              </h2>
              <p className="text-[13px] text-[#64748B]">
                Current count across standard HR recruitment stages
              </p>
            </div>
            <Link
              href="/applications?view=board"
              className="inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-semibold text-[#204CD3] transition-colors hover:bg-[#EEF2FF] dark:text-[#B7C4FF]"
            >
              <Kanban className="h-3.5 w-3.5" />
              Open Board
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.stageBreakdown.map((st) => {
              const style = getStageColorStyle(st.color, st.name);
              const widthPct = Math.max(
                st.count > 0 ? 6 : 0,
                Math.round((st.count / maxStageCount) * 100),
              );
              return (
                <div
                  key={st.id}
                  className="flex items-center gap-3 text-[13px]"
                >
                  <div className="flex w-44 shrink-0 items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                    />
                    <span className="truncate font-medium text-[#334155] dark:text-slate-300">
                      {st.name}
                    </span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${style.dot}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs font-semibold text-[#0F172A] tabular-nums dark:text-slate-300">
                    {st.count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right column: Upcoming Interviews + Pending Follow-ups */}
        <div className="space-y-6 lg:col-span-5">
          {/* Upcoming Interviews */}
          <section className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#10B981]" />
                <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                  Upcoming Interviews
                </h2>
              </div>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
                {data.upcomingInterviews.length}
              </span>
            </div>

            {data.upcomingInterviews.length === 0 ? (
              <p className="py-4 text-[13px] text-[#64748B]">
                No scheduled interviews right now. Schedule interviews from any
                application detail page.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.upcomingInterviews.map((intv) => (
                  <Link
                    key={intv.id}
                    href={`/applications/${intv.applicationId}?tab=interviews`}
                    className="elevation-2 block rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
                        {INTERVIEW_TYPE_LABELS[
                          intv.interviewType as InterviewType
                        ] ?? intv.interviewType}{" "}
                        at {intv.companyName}
                      </span>
                      {intv.isSample && <SampleBadge />}
                    </div>
                    <p className="mt-0.5 text-xs text-[#334155] dark:text-slate-400">
                      {intv.jobTitle} ({intv.appCode})
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
                      {formatDateTime(intv.startsAt, data.settings.timezone)} (
                      {intv.durationMinutes} min)
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Pending Follow-ups */}
          <section className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Pending Follow-ups
              </h2>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
                {data.pendingFollowUps.length}
              </span>
            </div>

            {data.pendingFollowUps.length === 0 ? (
              <p className="py-4 text-[13px] text-[#64748B]">
                All caught up! Automatic follow-up tasks are created when you
                record new applications.
              </p>
            ) : (
              <div className="space-y-2">
                {data.pendingFollowUps.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {task.isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#BE123C] dark:bg-rose-950 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            OVERDUE
                          </span>
                        )}
                        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {task.title}
                        </span>
                        {task.isSample && <SampleBadge />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#64748B] tabular-nums">
                        Due {formatDate(task.dueOn)}
                        {task.applicationId && task.appCode ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              href={`/applications/${task.applicationId}`}
                              className="font-mono font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
                            >
                              {task.appCode}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCompleteTask(task.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] transition-colors hover:border-[#10B981] hover:bg-[#ECFDF5] hover:text-[#047857] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Recent Application Activity */}
      <section className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-headline-sm mb-3 text-[#0F172A] dark:text-slate-100">
          Recent Application Activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Briefcase className="h-6 w-6 text-[#64748B]" />
            <p className="mt-2 text-xs text-[#64748B]">
              No recruitment transitions recorded yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/applications/${item.applicationId}`}
                    className="font-mono text-xs font-semibold text-[#204CD3] tabular-nums hover:underline dark:text-[#B7C4FF]"
                  >
                    {item.app?.code}
                  </Link>
                  <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                    {item.app?.jobTitle}
                  </span>
                  <span className="text-[#64748B]">
                    at {item.app?.companyName}
                  </span>
                  {item.fromStageName && (
                    <span className="text-[#64748B]">
                      {item.fromStageName} &rarr;
                    </span>
                  )}
                  <StageBadge
                    name={item.toStageName}
                    color={item.toStageColor}
                  />
                  {item.app?.isSample && <SampleBadge />}
                </div>
                <span className="font-mono text-xs text-[#64748B] tabular-nums">
                  {formatDate(item.effectiveOn)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ANALYTICS SECTION: Performance Metrics, Funnel, Activity Over Time, Outcomes */}
      <section
        aria-label="Recruitment Performance Analytics"
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="App to Interview Rate"
            value={
              kpi.applicationToInterviewRate != null
                ? `${kpi.applicationToInterviewRate}%`
                : "N/A"
            }
            sub={`${kpi.denominators.reachedInterviewCount} / ${kpi.denominators.eligibleForInterviewRate} eligible`}
          />
          <MetricCard
            label="Interview to Offer Rate"
            value={
              kpi.interviewToOfferRate != null
                ? `${kpi.interviewToOfferRate}%`
                : "N/A"
            }
            sub={`${kpi.denominators.reachedOfferCount} / ${kpi.denominators.eligibleForOfferRate} interviewed`}
          />
          <MetricCard
            label="Offer Acceptance Rate"
            value={
              kpi.offerAcceptanceRate != null
                ? `${kpi.offerAcceptanceRate}%`
                : "N/A"
            }
            sub={`${kpi.denominators.decidedOffersCount} decided offers`}
          />
          <MetricCard
            label="Overall Success Rate"
            value={
              kpi.overallSuccessRate != null
                ? `${kpi.overallSuccessRate}%`
                : "N/A"
            }
            sub="Excludes withdrawn"
          />
          <MetricCard
            label="Avg Time to Response"
            value={
              kpi.averageTimeToFirstResponseDays != null
                ? `${kpi.averageTimeToFirstResponseDays}d`
                : "N/A"
            }
            sub={`${kpi.denominators.respondedApplicationsCount} responded`}
          />
          <MetricCard
            label="Avg Cycle Duration"
            value={
              kpi.averageRecruitmentCycleDays != null
                ? `${kpi.averageRecruitmentCycleDays}d`
                : "N/A"
            }
            sub="Closed applications"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Funnel */}
          <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Recruitment Conversion Funnel
            </h3>
            <p className="mb-4 text-xs text-[#64748B]">
              Cumulative progression across submitted applications
            </p>
            <div className="space-y-3">
              {data.funnel.map((step) => (
                <div key={step.key} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-[#334155] dark:text-slate-300">
                      {step.label}
                    </span>
                    <span className="font-mono text-[#64748B] tabular-nums">
                      {step.count} (
                      {step.percentageOfSubmitted != null
                        ? `${step.percentageOfSubmitted}%`
                        : "0%"}
                      )
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-[#204CD3]"
                      style={{ width: `${step.percentageOfSubmitted ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Over Time */}
          <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Application Activity Over Time
            </h3>
            <p className="mb-4 text-xs text-[#64748B]">
              Applications submitted by month
            </p>
            {data.activityOverTime.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#64748B]">
                No submission data yet
              </p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.activityOverTime}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="applications"
                      fill="#204CD3"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Outcome Breakdown */}
          <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Application Outcomes
            </h3>
            <p className="mb-4 text-xs text-[#64748B]">
              Distribution of active and closed applications
            </p>
            {data.outcomeDistribution.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#64748B]">
                No application outcomes yet
              </p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.outcomeDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={38}
                        outerRadius={68}
                        paddingAngle={2}
                      >
                        {data.outcomeDistribution.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={OUTCOME_COLORS[entry.key] ?? "#204CD3"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 text-xs">
                  {data.outcomeDistribution.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            OUTCOME_COLORS[item.key] ?? "#204CD3",
                        }}
                      />
                      <span className="text-[#334155] dark:text-slate-300">
                        {item.name}:
                      </span>
                      <span className="font-mono font-semibold text-[#0F172A] tabular-nums dark:text-slate-100">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="elevation-1 rounded-[4px] border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B] dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-bold text-[#0F172A] tabular-nums dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-label-sm uppercase text-[#64748B] dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 font-display text-xl font-bold text-[#0F172A] tabular-nums dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
        {sub}
      </p>
    </div>
  );
}
