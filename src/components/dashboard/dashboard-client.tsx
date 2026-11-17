"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
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
  Badge,
  Button,
  Card,
  EmptyState,
  getStageColorStyle,
  SampleBadge,
  SectionHeader,
  Select,
  StageBadge,
} from "@/components/ui";
import {
  INTERVIEW_TYPE_LABELS,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  type InterviewType,
  type SearchStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { completeFollowUpTaskAction } from "@/server/actions/applications";
import {
  loadSampleDataAction,
  updateSearchStatusAction,
} from "@/server/actions/settings";
import type { getDashboardData } from "@/server/queries/dashboard";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const OUTCOME_COLORS: Record<string, string> = {
  active: "var(--primary)",
  successful: "var(--success)",
  unsuccessful: "var(--destructive)",
  withdrawn: "var(--subtle-foreground)",
  no_response: "var(--warning)",
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
      <Card
        padding="lg"
        className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-label-xs uppercase text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span>Pipeline Intelligence</span>
            <span>/</span>
            <span className="text-primary-text">Command Center</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title text-foreground">
              Welcome back, {user.name}
            </h1>
            <Select
              aria-label="Current job search status"
              selectSize="xs"
              wrapperClassName="w-auto"
              value={data.settings.searchStatus}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as SearchStatus)
              }
              className="rounded-full border-primary/25 bg-primary-soft pr-7 pl-3 font-semibold text-primary-on-soft"
            >
              {SEARCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SEARCH_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Executive Career Command Center. All metrics are calculated from
            your recorded applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="lg" asChild>
            <Link href="/jobs/new">
              <Plus className="h-3.5 w-3.5" />
              Add Job Vacancy
            </Link>
          </Button>
          <Button variant="primary" size="lg" asChild>
            <Link href="/applications?new=1">
              <Plus className="h-3.5 w-3.5" />
              Log Application
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/shortlist">
              <BookmarkCheck className="h-3.5 w-3.5" />
              Shortlist
            </Link>
          </Button>
          {kpi.totalApplicationsSubmitted === 0 &&
            kpi.totalJobsDiscovered === 0 &&
            !data.sampleStatus.hasSampleData && (
              <Button
                variant="outline"
                size="lg"
                disabled={isPending}
                onClick={handleLoadSample}
                className="border-warning-border bg-warning-soft text-warning-on-soft hover:bg-warning-soft/80"
              >
                <Database className="h-3.5 w-3.5" />
                Load Sample Data
              </Button>
            )}
        </div>
      </Card>

      {/* KPI SECTION: 4 Primary Executive Ribbon Tiles + 6 Secondary KPIs */}
      <section aria-label="Key Performance Indicators" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          <Card padding="md" className="group transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase text-muted-foreground">
                Total Applications
              </p>
              <span className="rounded-lg bg-surface-subtle p-1.5 text-primary-text transition-colors group-hover:bg-primary-soft">
                <FolderOpen className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-foreground tabular-nums">
              {kpi.totalApplicationsSubmitted}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-primary-text tabular-nums">
              From {kpi.totalJobsDiscovered} discovered vacancies
            </p>
          </Card>

          <Card padding="md" className="group transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase text-muted-foreground">
                Active Applications
              </p>
              <span className="rounded-lg bg-surface-subtle p-1.5 text-muted-foreground transition-colors group-hover:bg-primary-soft group-hover:text-primary-on-soft">
                <Hourglass className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-foreground tabular-nums">
              {kpi.activeApplications}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {kpi.applicationsUnderScreening} currently under CV screening
            </p>
          </Card>

          <Card padding="md" className="group transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase text-muted-foreground">
                Upcoming Interviews
              </p>
              <span className="rounded-lg bg-primary-soft p-1.5 text-primary-on-soft">
                <CalendarClock className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-primary-text tabular-nums">
              {kpi.interviewsScheduled}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-primary-text tabular-nums">
              Interview conversion:{" "}
              {kpi.applicationToInterviewRate != null
                ? `${kpi.applicationToInterviewRate}%`
                : "Not enough data"}
            </p>
          </Card>

          <Card
            padding="md"
            className="group relative overflow-hidden transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-label-sm uppercase text-warning-on-soft">
                Offers Received
              </p>
              <span className="rounded-lg bg-warning-soft p-1.5 text-warning-on-soft">
                <BadgeCheck className="h-4 w-4" />
              </span>
            </div>
            <p className="text-metric-num mt-2 text-warning-on-soft tabular-nums">
              {kpi.offersReceived}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-primary-text tabular-nums">
              {kpi.successfulApplications} accepted / hired
            </p>
          </Card>
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
        <Card padding="lg" className="lg:col-span-7">
          <SectionHeader
            title="Application Pipeline"
            description="Current count across standard HR recruitment stages"
            className="mb-5"
            actions={
              <Button variant="soft" size="sm" asChild>
                <Link href="/applications?view=board">
                  <Kanban className="h-3.5 w-3.5" />
                  Open Board
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            }
          />

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
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        style.dot,
                      )}
                    />
                    <span className="truncate font-medium text-foreground">
                      {st.name}
                    </span>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className={cn("h-full rounded-full", style.dot)}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs font-bold text-foreground tabular-nums">
                    {st.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right column: Upcoming Interviews + Pending Follow-ups */}
        <div className="space-y-6 lg:col-span-5">
          {/* Upcoming Interviews */}
          <Card padding="lg">
            <SectionHeader
              icon={CalendarClock}
              title="Upcoming Interviews"
              className="mb-3.5"
              actions={
                <Badge variant="primary" className="font-mono tabular-nums">
                  {data.upcomingInterviews.length}
                </Badge>
              }
            />

            {data.upcomingInterviews.length === 0 ? (
              <p className="py-4 text-[13px] text-muted-foreground">
                No scheduled interviews right now. Schedule interviews from any
                application detail page.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.upcomingInterviews.map((intv) => (
                  <Link
                    key={intv.id}
                    href={`/applications/${intv.applicationId}?tab=interviews`}
                    className="elevation-2 block rounded-xl border border-border bg-surface-subtle p-3.5 transition-all hover:bg-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {INTERVIEW_TYPE_LABELS[
                          intv.interviewType as InterviewType
                        ] ?? intv.interviewType}{" "}
                        at {intv.companyName}
                      </span>
                      {intv.isSample && <SampleBadge />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {intv.jobTitle} ({intv.appCode})
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] font-semibold text-primary-text tabular-nums">
                      {formatDateTime(intv.startsAt, data.settings.timezone)} (
                      {intv.durationMinutes} min)
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Pending Follow-ups */}
          <Card padding="lg">
            <SectionHeader
              title="Pending Follow-ups"
              className="mb-3.5"
              actions={
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {data.pendingFollowUps.length}
                </Badge>
              }
            />

            {data.pendingFollowUps.length === 0 ? (
              <p className="py-4 text-[13px] text-muted-foreground">
                All caught up! Automatic follow-up tasks are created when you
                record new applications.
              </p>
            ) : (
              <div className="space-y-2">
                {data.pendingFollowUps.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {task.isOverdue && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="h-3 w-3" />
                            OVERDUE
                          </Badge>
                        )}
                        <span className="font-semibold text-foreground">
                          {task.title}
                        </span>
                        {task.isSample && <SampleBadge />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        Due {formatDate(task.dueOn)}
                        {task.applicationId && task.appCode ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              href={`/applications/${task.applicationId}`}
                              className="font-mono font-semibold text-primary-text hover:underline"
                            >
                              {task.appCode}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={isPending}
                      onClick={() => handleCompleteTask(task.id)}
                      className="shrink-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Application Activity */}
      <Card padding="lg">
        <SectionHeader title="Recent Application Activity" className="mb-3" />
        {data.recentActivity.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No recruitment transitions recorded yet"
            description="Stage transitions and application submissions will appear here."
            className="border-0 shadow-none"
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/applications/${item.applicationId}`}
                    className="font-mono text-xs font-semibold text-primary-text tabular-nums hover:underline"
                  >
                    {item.app?.code}
                  </Link>
                  <span className="font-semibold text-foreground">
                    {item.app?.jobTitle}
                  </span>
                  <span className="text-muted-foreground">
                    at {item.app?.companyName}
                  </span>
                  {item.fromStageName && (
                    <span className="text-subtle-foreground">
                      {item.fromStageName} &rarr;
                    </span>
                  )}
                  <StageBadge
                    name={item.toStageName}
                    color={item.toStageColor}
                  />
                  {item.app?.isSample && <SampleBadge />}
                </div>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatDate(item.effectiveOn)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ANALYTICS SECTION */}
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
          <Card padding="lg">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-section-title text-foreground">
                Recruitment Conversion Funnel
              </h3>
              <TrendingUp className="h-4 w-4 text-primary-text" />
            </div>
            <p className="mb-4 text-caption text-muted-foreground">
              Cumulative progression across submitted applications
            </p>
            <div className="space-y-3">
              {data.funnel.map((step) => (
                <div key={step.key} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">
                      {step.label}
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {step.count} (
                      {step.percentageOfSubmitted != null
                        ? `${step.percentageOfSubmitted}%`
                        : "0%"}
                      )
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${step.percentageOfSubmitted ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Over Time */}
          <Card padding="lg">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-section-title text-foreground">
                Application Activity Over Time
              </h3>
              <Activity className="h-4 w-4 text-primary-text" />
            </div>
            <p className="mb-4 text-caption text-muted-foreground">
              Applications submitted by month
            </p>
            {data.activityOverTime.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No submission data yet
              </p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.activityOverTime}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        borderRadius: "0.75rem",
                        color: "var(--popover-foreground)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="applications"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Outcome Breakdown */}
          <Card padding="lg">
            <h3 className="text-section-title text-foreground">
              Application Outcomes
            </h3>
            <p className="mb-4 text-caption text-muted-foreground">
              Distribution of active and closed applications
            </p>
            {data.outcomeDistribution.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No application outcomes yet
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
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
                            fill={
                              OUTCOME_COLORS[entry.key] ?? "var(--primary)"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          borderColor: "var(--border)",
                          borderRadius: "0.75rem",
                          color: "var(--popover-foreground)",
                          fontSize: "12px",
                        }}
                      />
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
                            OUTCOME_COLORS[item.key] ?? "var(--primary)",
                        }}
                      />
                      <span className="text-muted-foreground">
                        {item.name}:
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm" className="px-4 py-3">
      <p className="truncate text-label-xs uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-foreground tabular-nums">
        {value}
      </p>
    </Card>
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
    <Card padding="sm">
      <p className="text-label-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-primary-text tabular-nums">
        {sub}
      </p>
    </Card>
  );
}
