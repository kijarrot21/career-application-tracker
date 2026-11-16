"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Database,
  FolderOpen,
  Hourglass,
  Kanban,
  Plus,
  TrendingUp,
  BadgeCheck,
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
  active: "#006a42",
  successful: "#008655",
  unsuccessful: "#ba1a1a",
  withdrawn: "#6e7a71",
  no_response: "#8f6f3b",
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
      <section className="elevation-1 flex flex-col justify-between gap-4 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 sm:flex-row sm:items-center dark:border-[#24332a] dark:bg-[#111a15]">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#006a42] dark:bg-[#69dca0]" />
            <span>Pipeline Intelligence</span>
            <span>/</span>
            <span className="text-[#006a42] dark:text-[#69dca0]">
              Command Center
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
              Welcome back, {user.name}
            </h1>
            <select
              aria-label="Current job search status"
              value={data.settings.searchStatus}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as SearchStatus)
              }
              className="rounded-full border border-[#a5d1b4]/60 bg-[#c0edcf] px-3 py-1 text-[11px] font-semibold tracking-[0.02em] text-[#005232] outline-none dark:border-[#006a42]/40 dark:bg-[#006a42]/25 dark:text-[#86f9ba]"
            >
              {SEARCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SEARCH_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[13px] leading-[18px] text-[#3f674f] dark:text-[#a5d1b4]">
            Executive Career Command Center. All metrics are calculated from
            your recorded applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/jobs/new" className="btn-secondary h-10 px-4 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Job Vacancy
          </Link>
          <Link
            href="/applications?new=1"
            className="btn-primary h-10 px-4 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Application
          </Link>
          <Link href="/shortlist" className="btn-secondary h-10 px-4 text-xs">
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
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#e8c084] bg-[#ffdead]/60 px-4 text-xs font-semibold text-[#5d4211] transition-colors hover:bg-[#ffdead] dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <Database className="h-3.5 w-3.5" />
                Load Sample Data
              </button>
            )}
        </div>
      </section>

      {/* KPI SECTION: 4 Primary Executive Ribbon Tiles + 6 Secondary KPIs */}
      <section aria-label="Key Performance Indicators" className="space-y-4">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 xl:grid-cols-4 xl:gap-5">
          <div className="elevation-1 group min-w-[230px] shrink-0 snap-start rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-shadow hover:shadow-md md:min-w-0 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
                Total Applications
              </p>
              <span className="rounded-lg bg-[#eff5ee] p-1.5 text-[#006a42] transition-colors group-hover:bg-[#c0edcf] dark:bg-[#17231c] dark:text-[#69dca0]">
                <FolderOpen className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
              {kpi.totalApplicationsSubmitted}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
              From {kpi.totalJobsDiscovered} discovered vacancies
            </p>
          </div>

          <div className="elevation-1 group min-w-[230px] shrink-0 snap-start rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-shadow hover:shadow-md md:min-w-0 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
                Active Applications
              </p>
              <span className="rounded-lg bg-[#eff5ee] p-1.5 text-[#3f674f] transition-colors group-hover:bg-[#c0edcf] dark:bg-[#17231c] dark:text-[#a5d1b4]">
                <Hourglass className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
              {kpi.activeApplications}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
              {kpi.applicationsUnderScreening} currently under CV screening
            </p>
          </div>

          <div className="elevation-1 group min-w-[230px] shrink-0 snap-start rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-shadow hover:shadow-md md:min-w-0 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
                Upcoming Interviews
              </p>
              <span className="rounded-lg bg-[#c0edcf] p-1.5 text-[#005232] dark:bg-[#005232] dark:text-[#86f9ba]">
                <CalendarClock className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-[#006a42] tabular-nums dark:text-[#69dca0]">
              {kpi.interviewsScheduled}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#008655] tabular-nums dark:text-[#86f9ba]">
              Interview conversion:{" "}
              {kpi.applicationToInterviewRate != null
                ? `${kpi.applicationToInterviewRate}%`
                : "Not enough data"}
            </p>
          </div>

          <div className="elevation-1 group relative min-w-[230px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-shadow hover:shadow-md md:min-w-0 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="pointer-events-none absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-[#ffdead]/40 blur-xl dark:bg-[#745725]/20" />
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase tracking-wider text-[#745725] dark:text-[#e8c084]">
                Offers Received
              </p>
              <span className="rounded-lg bg-[#ffdead] p-1.5 text-[#5d4211] dark:bg-[#5d4211] dark:text-[#ffdead]">
                <BadgeCheck className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-[#745725] tabular-nums dark:text-[#e8c084]">
              {kpi.offersReceived}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
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

      {/* MAIN SECTION: Pipeline, Upcoming Interviews, Pending Follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Application Pipeline */}
        <section className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 lg:col-span-7 dark:border-[#24332a] dark:bg-[#111a15]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Application Pipeline
              </h2>
              <p className="text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
                Current count across standard HR recruitment stages
              </p>
            </div>
            <Link
              href="/applications?view=board"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#eff5ee] px-3 py-1.5 text-xs font-semibold text-[#006a42] transition-colors hover:bg-[#c0edcf] dark:bg-[#17231c] dark:text-[#69dca0]"
            >
              <Kanban className="h-3.5 w-3.5" />
              Open Board
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
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
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                    />
                    <span className="truncate font-medium text-[#171d19] dark:text-[#ecf3eb]">
                      {st.name}
                    </span>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eff5ee] dark:bg-[#17231c]">
                    <div
                      className={`h-full rounded-full ${style.dot}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
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
          <section className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#006a42] dark:text-[#69dca0]" />
                <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  Upcoming Interviews
                </h2>
              </div>
              <span className="rounded-full bg-[#c0edcf] px-2.5 py-0.5 font-mono text-xs font-bold text-[#005232] tabular-nums dark:bg-[#005232] dark:text-[#86f9ba]">
                {data.upcomingInterviews.length}
              </span>
            </div>

            {data.upcomingInterviews.length === 0 ? (
              <p className="py-4 text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
                No scheduled interviews right now. Schedule interviews from any
                application detail page.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.upcomingInterviews.map((intv) => (
                  <Link
                    key={intv.id}
                    href={`/applications/${intv.applicationId}?tab=interviews`}
                    className="elevation-2 block rounded-xl border border-[#bdcabf]/40 bg-[#eff5ee]/70 p-3.5 transition-all hover:bg-[#ffffff] dark:border-[#24332a] dark:bg-[#17231c]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                        {INTERVIEW_TYPE_LABELS[
                          intv.interviewType as InterviewType
                        ] ?? intv.interviewType}{" "}
                        at {intv.companyName}
                      </span>
                      {intv.isSample && <SampleBadge />}
                    </div>
                    <p className="mt-0.5 text-xs text-[#3e4a41] dark:text-[#b7c6ba]">
                      {intv.jobTitle} ({intv.appCode})
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
                      {formatDateTime(intv.startsAt, data.settings.timezone)} (
                      {intv.durationMinutes} min)
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Pending Follow-ups */}
          <section className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Pending Follow-ups
              </h2>
              <span className="rounded-full bg-[#eff5ee] px-2.5 py-0.5 font-mono text-xs font-bold text-[#3e4a41] tabular-nums dark:bg-[#17231c] dark:text-[#b7c6ba]">
                {data.pendingFollowUps.length}
              </span>
            </div>

            {data.pendingFollowUps.length === 0 ? (
              <p className="py-4 text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
                All caught up! Automatic follow-up tasks are created when you
                record new applications.
              </p>
            ) : (
              <div className="space-y-2">
                {data.pendingFollowUps.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-[#bdcabf]/40 bg-[#eff5ee]/60 p-3 text-xs dark:border-[#24332a] dark:bg-[#17231c]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {task.isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-[#93000a] dark:bg-rose-950 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            OVERDUE
                          </span>
                        )}
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {task.title}
                        </span>
                        {task.isSample && <SampleBadge />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                        Due {formatDate(task.dueOn)}
                        {task.applicationId && task.appCode ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              href={`/applications/${task.applicationId}`}
                              className="font-mono font-semibold text-[#006a42] hover:underline dark:text-[#69dca0]"
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
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#bdcabf] bg-[#ffffff] px-2.5 py-1 text-[11px] font-semibold text-[#171d19] transition-colors hover:border-[#006a42] hover:bg-[#c0edcf] hover:text-[#005232] dark:border-[#2d3d33] dark:bg-[#111a15] dark:text-[#ecf3eb]"
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
      <section className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
        <h2 className="text-headline-sm mb-3 text-[#171d19] dark:text-[#ecf3eb]">
          Recent Application Activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Briefcase className="h-6 w-6 text-[#3f674f]" />
            <p className="mt-2 text-xs text-[#3f674f]">
              No recruitment transitions recorded yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e3eae3] dark:divide-[#24332a]">
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/applications/${item.applicationId}`}
                    className="font-mono text-xs font-semibold text-[#006a42] tabular-nums hover:underline dark:text-[#69dca0]"
                  >
                    {item.app?.code}
                  </Link>
                  <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                    {item.app?.jobTitle}
                  </span>
                  <span className="text-[#3f674f] dark:text-[#a5d1b4]">
                    at {item.app?.companyName}
                  </span>
                  {item.fromStageName && (
                    <span className="text-[#6e7a71]">
                      {item.fromStageName} &rarr;
                    </span>
                  )}
                  <StageBadge
                    name={item.toStageName}
                    color={item.toStageColor}
                  />
                  {item.app?.isSample && <SampleBadge />}
                </div>
                <span className="font-mono text-xs text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
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
          <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Recruitment Conversion Funnel
              </h3>
              <TrendingUp className="h-4 w-4 text-[#006a42] dark:text-[#69dca0]" />
            </div>
            <p className="mb-4 text-xs text-[#3f674f] dark:text-[#a5d1b4]">
              Cumulative progression across submitted applications
            </p>
            <div className="space-y-3">
              {data.funnel.map((step) => (
                <div key={step.key} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                      {step.label}
                    </span>
                    <span className="font-mono text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                      {step.count} (
                      {step.percentageOfSubmitted != null
                        ? `${step.percentageOfSubmitted}%`
                        : "0%"}
                      )
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eff5ee] dark:bg-[#17231c]">
                    <div
                      className="h-full rounded-full bg-[#006a42] dark:bg-[#008655]"
                      style={{ width: `${step.percentageOfSubmitted ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Over Time */}
          <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Application Activity Over Time
              </h3>
              <Activity className="h-4 w-4 text-[#006a42] dark:text-[#69dca0]" />
            </div>
            <p className="mb-4 text-xs text-[#3f674f] dark:text-[#a5d1b4]">
              Applications submitted by month
            </p>
            {data.activityOverTime.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#3f674f]">
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
                      fill="#006a42"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Outcome Breakdown */}
          <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
            <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
              Application Outcomes
            </h3>
            <p className="mb-4 text-xs text-[#3f674f] dark:text-[#a5d1b4]">
              Distribution of active and closed applications
            </p>
            {data.outcomeDistribution.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#3f674f]">
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
                            fill={OUTCOME_COLORS[entry.key] ?? "#006a42"}
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
                            OUTCOME_COLORS[item.key] ?? "#006a42",
                        }}
                      />
                      <span className="text-[#3e4a41] dark:text-[#b7c6ba]">
                        {item.name}:
                      </span>
                      <span className="font-mono font-semibold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
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
    <div className="elevation-1 rounded-xl border border-[#bdcabf]/40 bg-[#ffffff] px-4 py-3 dark:border-[#24332a] dark:bg-[#111a15]">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f674f] dark:text-[#a5d1b4]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
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
    <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 dark:border-[#24332a] dark:bg-[#111a15]">
      <p className="text-label-xs uppercase text-[#3f674f] dark:text-[#a5d1b4]">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
        {sub}
      </p>
    </div>
  );
}
