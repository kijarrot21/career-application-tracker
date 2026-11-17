"use client";

import {
  BarChart3,
  Download,
  Filter,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Button,
  Card,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
  EmptyState,
  FormField,
  getStageColorStyle,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { getAnalyticsData } from "@/server/queries/analytics";

type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

const OUTCOME_COLORS: Record<string, string> = {
  active: "var(--primary)",
  successful: "var(--success)",
  unsuccessful: "var(--destructive)",
  withdrawn: "var(--subtle-foreground)",
  no_response: "var(--warning)",
};

const PLATFORM_PALETTE = [
  "var(--primary)",
  "var(--success)",
  "var(--info)",
  "var(--warning)",
  "var(--destructive)",
  "var(--subtle-foreground)",
];

const FUNNEL_BAR_COLORS = [
  "bg-primary",
  "bg-success",
  "bg-info",
  "bg-warning",
  "bg-subtle-foreground",
];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  borderColor: "var(--border)",
  borderRadius: "0.75rem",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(data.filters.fromDate);
  const [toDate, setToDate] = useState(data.filters.toDate);
  const [sampleMode, setSampleMode] = useState<"auto" | "include" | "exclude">(
    data.filters.sampleMode,
  );

  const { kpi } = data;

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (fromDate) sp.set("fromDate", fromDate);
    if (toDate) sp.set("toDate", toDate);
    if (sampleMode !== "auto") sp.set("sampleMode", sampleMode);
    const qs = sp.toString();
    router.push(qs ? `/analytics?${qs}` : "/analytics");
  }

  function resetFilters() {
    setFromDate("");
    setToDate("");
    setSampleMode("auto");
    router.push("/analytics");
  }

  const exportParams = new URLSearchParams();
  if (fromDate) exportParams.set("fromDate", fromDate);
  if (toDate) exportParams.set("toDate", toDate);
  if (sampleMode !== "auto") exportParams.set("sampleMode", sampleMode);
  const exportCsvHref = `/api/export/analytics${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  const maxStageCount = Math.max(
    1,
    ...data.applicationsByStage.map((s) => s.count),
  );

  const monthlyConversionTrend = data.monthlyPerformance.map((m) => ({
    month: m.month,
    interviewRate: m.interviewConversionRate ?? 0,
    submitted: m.submitted,
    interviewsReached: m.interviewsReached,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-xs">
      <PageHeader
        breadcrumbs={[
          { label: "Analytics Engine" },
          { label: "Performance Velocity" },
        ]}
        title="Result & Career Performance Analytics"
        badge={
          <Badge variant={data.includeSample ? "warning" : "primary"}>
            {data.includeSample
              ? "Dataset: Includes Sample Records"
              : "Dataset: Actual User Records Only"}
          </Badge>
        }
        description="Conversion rates, recruitment cycle durations, and company/platform/industry performance calculated strictly from database records."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="lg" asChild>
              <a href={exportCsvHref} download>
                <Download className="h-3.5 w-3.5" />
                Export Activity Report (CSV)
              </a>
            </Button>

            <Button
              variant="primary"
              size="lg"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF Report
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <Card padding="sm" className="no-print">
        <form
          onSubmit={applyFilters}
          className="flex flex-wrap items-end gap-3"
        >
          <FormField label="From Date" htmlFor="analytics-from-date">
            <Input
              id="analytics-from-date"
              type="date"
              inputSize="lg"
              tone="subtle"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField label="To Date" htmlFor="analytics-to-date">
            <Input
              id="analytics-to-date"
              type="date"
              inputSize="lg"
              tone="subtle"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Sample Records" htmlFor="analytics-sample-mode">
            <Select
              id="analytics-sample-mode"
              selectSize="lg"
              tone="subtle"
              value={sampleMode}
              onChange={(e) =>
                setSampleMode(e.target.value as "auto" | "include" | "exclude")
              }
            >
              <option value="auto">
                Auto (Exclude once real applications exist)
              </option>
              <option value="exclude">Real User Records Only</option>
              <option value="include">Include Sample Demonstration Data</option>
            </Select>
          </FormField>

          <Button type="submit" variant="primary" size="lg">
            <Filter className="h-3.5 w-3.5" />
            Apply Filters
          </Button>

          {(fromDate || toDate || sampleMode !== "auto") && (
            <Button variant="secondary" size="lg" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </form>
      </Card>

      {/* Primary 10 KPIs */}
      <section aria-label="All 10 Key Performance Indicators" className="space-y-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiTile
            label="1. Jobs Discovered"
            value={kpi.totalJobsDiscovered}
            accent="neutral"
          />
          <KpiTile
            label="2. Apps Submitted"
            value={kpi.totalApplicationsSubmitted}
            accent="emerald"
          />
          <KpiTile
            label="3. Active Applications"
            value={kpi.activeApplications}
            accent="emerald"
          />
          <KpiTile
            label="4. Under Screening"
            value={kpi.applicationsUnderScreening}
            accent="amber"
          />
          <KpiTile
            label="5. Interviews Scheduled"
            value={kpi.interviewsScheduled}
            accent="emerald"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiTile
            label="6. Offers Received"
            value={kpi.offersReceived}
            accent="amber"
          />
          <KpiTile
            label="7. Successful (Hired)"
            value={kpi.successfulApplications}
            accent="emerald"
          />
          <KpiTile
            label="8. Rejected"
            value={kpi.rejectedApplications}
            accent="rose"
          />
          <KpiTile
            label="9. Withdrawn"
            value={kpi.withdrawnApplications}
            accent="neutral"
          />
          <KpiTile
            label="10. No Response"
            value={kpi.noResponseApplications}
            accent="amber"
          />
        </div>
      </section>

      {/* Conversion Rates & Cycle Duration Metrics */}
      <section aria-label="Conversion and Cycle Speed Metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <MetricShell
            label="App to Interview"
            value={
              kpi.applicationToInterviewRate != null
                ? `${kpi.applicationToInterviewRate}%`
                : "Not enough data"
            }
            sub={`${kpi.denominators.reachedInterviewCount} / ${kpi.denominators.eligibleForInterviewRate} eligible`}
          />
          <MetricShell
            label="Interview to Offer"
            value={
              kpi.interviewToOfferRate != null
                ? `${kpi.interviewToOfferRate}%`
                : "Not enough data"
            }
            sub={`${kpi.denominators.reachedOfferCount} / ${kpi.denominators.eligibleForOfferRate} eligible`}
          />
          <MetricShell
            label="Offer Acceptance"
            value={
              kpi.offerAcceptanceRate != null
                ? `${kpi.offerAcceptanceRate}%`
                : "Not enough data"
            }
            sub={`${kpi.denominators.decidedOffersCount} decided offer(s)`}
          />
          <MetricShell
            label="Overall Success"
            value={
              kpi.overallSuccessRate != null
                ? `${kpi.overallSuccessRate}%`
                : "Not enough data"
            }
            sub={`${kpi.successfulApplications} / ${kpi.denominators.eligibleForSuccessRate} non-withdrawn`}
          />
          <MetricShell
            label="Avg First Response"
            value={
              kpi.averageTimeToFirstResponseDays != null
                ? `${kpi.averageTimeToFirstResponseDays}d`
                : "Not enough data"
            }
            sub={`${kpi.denominators.respondedApplicationsCount} responded`}
          />
          <MetricShell
            label="Avg Time to Interview"
            value={
              kpi.averageTimeToInterviewDays != null
                ? `${kpi.averageTimeToInterviewDays}d`
                : "Not enough data"
            }
            sub="Submission to 1st interview"
          />
          <MetricShell
            label="Avg Cycle Duration"
            value={
              kpi.averageRecruitmentCycleDays != null
                ? `${kpi.averageRecruitmentCycleDays}d`
                : "Not enough data"
            }
            sub="Submission to close"
          />
        </div>
      </section>

      {kpi.totalApplicationsSubmitted === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No submitted applications in this dataset yet"
          description="Record applications or adjust the date/sample filter to inspect recruitment funnel and conversion charts."
        />
      ) : (
        <>
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart 1: Application Pipeline Funnel */}
            <Card padding="lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-section-title text-foreground">
                    Application Pipeline Funnel
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Cumulative progression across recruitment stages
                  </p>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {kpi.totalApplicationsSubmitted} leads
                </Badge>
              </div>
              <div className="space-y-3.5">
                {data.funnel.map((step, idx) => {
                  const pct = step.percentageOfSubmitted ?? 0;
                  const barColor =
                    FUNNEL_BAR_COLORS[idx % FUNNEL_BAR_COLORS.length];
                  return (
                    <div key={step.key} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-foreground">
                          {step.label}
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {step.count}{" "}
                          <span className="font-bold text-foreground">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex h-6 w-full overflow-hidden rounded-lg bg-surface-subtle">
                        <div
                          className={cn(
                            "flex h-full items-center justify-end rounded-lg px-2 font-mono text-[10px] font-bold text-white transition-all duration-500",
                            barColor,
                          )}
                          style={{
                            width: `${pct}%`,
                            minWidth: step.count > 0 ? "26px" : "0px",
                          }}
                        >
                          {step.count > 0 ? step.count : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Chart 2: Applications by Recruitment Stage */}
            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Applications by Recruitment Stage
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Current snapshot across active and terminal stages
              </p>
              <div className="space-y-2.5">
                {data.applicationsByStage.map((st) => {
                  const style = getStageColorStyle(st.color, st.name);
                  const widthPct = Math.max(
                    st.count > 0 ? 6 : 0,
                    Math.round((st.count / maxStageCount) * 100),
                  );
                  return (
                    <div
                      key={st.id}
                      className="flex items-center gap-2.5 text-[11px]"
                    >
                      <span className="w-36 truncate font-medium text-foreground">
                        {st.name}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                        <div
                          className={cn("h-full rounded-full", style.dot)}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono font-bold text-foreground tabular-nums">
                        {st.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Chart 3: Application Outcomes */}
            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Application Outcomes
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Active vs closed recruitment outcomes
              </p>
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
                        isAnimationActive={false}
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
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {data.outcomeDistribution.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            OUTCOME_COLORS[item.key] ?? "var(--primary)",
                        }}
                      />
                      <span className="text-muted-foreground">
                        {item.name}:
                      </span>
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Application Activity Over Time
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Monthly volume of submitted job applications
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar
                      dataKey="submitted"
                      name="Submitted Applications"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Monthly Recruitment Performance
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Submissions compared with interviews reached, offers, and hires
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="submitted"
                      name="Submitted"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="interviewsReached"
                      name="Interviews"
                      fill="var(--info)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="offersReached"
                      name="Offers"
                      fill="var(--warning)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="hired"
                      name="Hired"
                      fill="var(--success)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Interview Conversion Rate Trend (%)
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Share of eligible applications reaching interview or assessment
                per month
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyConversionTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="interviewRate"
                      name="Interview Conversion (%)"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--primary)" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="text-section-title text-foreground">
                Applications by Job Platform
              </h2>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Application distribution and interview yield across channels
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.platformDistribution}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="platformName"
                      width={110}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar
                      dataKey="applicationsCount"
                      name="Applications"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={false}
                    >
                      {data.platformDistribution.map((entry, idx) => (
                        <Cell
                          key={entry.platformName}
                          fill={
                            PLATFORM_PALETTE[idx % PLATFORM_PALETTE.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card padding="lg" className="overflow-hidden lg:col-span-7">
              <div className="mb-4">
                <h2 className="text-section-title text-foreground">
                  Response Rate by Company
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Employer responsiveness and average days to first reply
                </p>
              </div>
              <DataTableContainer className="border-0 shadow-none">
                <DataTableRoot className="text-xs">
                  <DataTableHeader>
                    <tr>
                      <DataTableHead>Company</DataTableHead>
                      <DataTableHead className="text-right">
                        Submitted
                      </DataTableHead>
                      <DataTableHead className="text-right">
                        Responded
                      </DataTableHead>
                      <DataTableHead className="text-right">
                        Response Rate
                      </DataTableHead>
                      <DataTableHead className="text-right">
                        Avg Reply
                      </DataTableHead>
                      <DataTableHead className="text-right">
                        Interviews
                      </DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {data.companyResponseRates.map((row) => (
                      <DataTableRow key={row.companyName}>
                        <DataTableCell className="py-3 font-semibold text-foreground">
                          {row.companyName}
                        </DataTableCell>
                        <DataTableCell className="py-3 text-right font-mono tabular-nums">
                          {row.submittedCount}
                        </DataTableCell>
                        <DataTableCell className="py-3 text-right font-mono tabular-nums">
                          {row.respondedCount}
                        </DataTableCell>
                        <DataTableCell className="py-3 text-right font-mono font-bold text-primary-text tabular-nums">
                          {row.responseRate != null
                            ? `${row.responseRate}%`
                            : "N/A"}
                        </DataTableCell>
                        <DataTableCell className="py-3 text-right font-mono text-muted-foreground tabular-nums">
                          {row.averageResponseDays != null
                            ? `${row.averageResponseDays}d`
                            : "-"}
                        </DataTableCell>
                        <DataTableCell className="py-3 text-right font-mono font-semibold text-primary-text tabular-nums">
                          {row.interviewCount}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTableRoot>
              </DataTableContainer>
            </Card>

            {/* Platform & Industry Distributions */}
            <div className="space-y-6 lg:col-span-5">
              <Card padding="lg" className="overflow-hidden">
                <h2 className="mb-3 text-section-title text-foreground">
                  Application Distribution by Platform
                </h2>
                <div className="space-y-2.5">
                  {data.platformDistribution.map((p) => (
                    <div
                      key={p.platformName}
                      className="flex flex-col gap-1.5 rounded-xl bg-surface-subtle p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {p.platformName}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {p.interviewsReached} interview(s) ·{" "}
                            {p.interviewConversionRate != null
                              ? `${p.interviewConversionRate}% conversion`
                              : "N/A"}
                          </p>
                        </div>
                        <Badge
                          variant="primary"
                          className="font-mono tabular-nums"
                        >
                          {p.applicationsCount} ({p.sharePercent ?? 0}%)
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.sharePercent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="lg" className="overflow-hidden">
                <h2 className="mb-3 text-section-title text-foreground">
                  Application Distribution by Industry
                </h2>
                <div className="space-y-2">
                  {data.industryDistribution.map((ind) => (
                    <div
                      key={ind.industry}
                      className="flex items-center justify-between rounded-xl bg-surface-subtle p-3"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {ind.industry}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {ind.interviewsReached} interview(s) ·{" "}
                          {ind.hiredCount} hired
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="font-mono tabular-nums"
                      >
                        {ind.applicationsCount} ({ind.sharePercent ?? 0}%)
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "neutral" | "blue" | "emerald" | "amber" | "rose";
}) {
  const valueColor =
    accent === "blue" || accent === "emerald"
      ? "text-primary-text"
      : accent === "amber"
        ? "text-warning-on-soft"
        : accent === "rose"
          ? "text-destructive-on-soft"
          : "text-foreground";

  return (
    <Card padding="md" className="transition-shadow hover:shadow-md">
      <p className="text-label-xs uppercase text-muted-foreground">{label}</p>
      <p className={cn("text-metric-num mt-2", valueColor)}>{value}</p>
    </Card>
  );
}

function MetricShell({
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
      <p className="mt-1.5 font-display text-lg font-bold text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
        {sub}
      </p>
    </Card>
  );
}
