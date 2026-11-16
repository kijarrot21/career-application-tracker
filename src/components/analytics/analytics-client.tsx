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
import { getStageColorStyle } from "@/components/ui/badges";
import type { getAnalyticsData } from "@/server/queries/analytics";

type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

const OUTCOME_COLORS: Record<string, string> = {
  active: "#006a42",
  successful: "#008655",
  unsuccessful: "#ba1a1a",
  withdrawn: "#6e7a71",
  no_response: "#8f6f3b",
};

const PLATFORM_PALETTE = [
  "#006a42",
  "#008655",
  "#3f674f",
  "#745725",
  "#8f6f3b",
  "#6e7a71",
];

const FUNNEL_BAR_COLORS = [
  "bg-[#006a42]",
  "bg-[#008655]",
  "bg-[#3f674f]",
  "bg-[#8f6f3b]",
  "bg-[#745725]",
];

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
      {/* Header & Report Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#006a42] dark:bg-[#69dca0]" />
            <span>Analytics Engine · Performance Velocity</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
              Result & Career Performance Analytics
            </h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${
                data.includeSample
                  ? "border-[#e8c084] bg-[#ffdead]/80 text-[#5d4211]"
                  : "border-[#a5d1b4] bg-[#c0edcf] text-[#005232]"
              }`}
            >
              {data.includeSample
                ? "Dataset: Includes Sample Records"
                : "Dataset: Actual User Records Only"}
            </span>
          </div>
          <p className="mt-1 text-body-sm text-[#3f674f] dark:text-[#a5d1b4]">
            Conversion rates, recruitment cycle durations, and
            company/platform/industry performance calculated strictly from
            database records.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <a
            href={exportCsvHref}
            download
            className="btn-secondary h-10 px-4 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Activity Report (CSV)
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary h-10 px-4 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF Report
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <form
        onSubmit={applyFilters}
        className="no-print elevation-1 flex flex-wrap items-end gap-3 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 dark:border-[#24332a] dark:bg-[#111a15]"
      >
        <div>
          <label
            htmlFor="analytics-from-date"
            className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
          >
            From Date
          </label>
          <input
            id="analytics-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs text-[#171d19] tabular-nums focus:border-[#006a42] focus:bg-[#ffffff] dark:bg-[#17231c] dark:text-[#ecf3eb]"
          />
        </div>

        <div>
          <label
            htmlFor="analytics-to-date"
            className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
          >
            To Date
          </label>
          <input
            id="analytics-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs text-[#171d19] tabular-nums focus:border-[#006a42] focus:bg-[#ffffff] dark:bg-[#17231c] dark:text-[#ecf3eb]"
          />
        </div>

        <div>
          <label
            htmlFor="analytics-sample-mode"
            className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
          >
            Sample Records
          </label>
          <select
            id="analytics-sample-mode"
            value={sampleMode}
            onChange={(e) =>
              setSampleMode(e.target.value as "auto" | "include" | "exclude")
            }
            className="mt-1 h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
          >
            <option value="auto">
              Auto (Exclude once real applications exist)
            </option>
            <option value="exclude">Real User Records Only</option>
            <option value="include">Include Sample Demonstration Data</option>
          </select>
        </div>

        <button type="submit" className="btn-primary h-10 px-4 text-xs">
          <Filter className="h-3.5 w-3.5" />
          Apply Filters
        </button>

        {(fromDate || toDate || sampleMode !== "auto") && (
          <button
            type="button"
            onClick={resetFilters}
            className="btn-secondary h-10 px-3.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </form>

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
        <div className="elevation-1 flex flex-col items-center justify-center rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] py-14 text-center dark:border-[#24332a] dark:bg-[#111a15]">
          <BarChart3 className="h-8 w-8 text-[#3f674f]" />
          <p className="mt-2 text-title-md text-[#171d19] dark:text-[#ecf3eb]">
            No submitted applications in this dataset yet
          </p>
          <p className="mt-1 text-xs text-[#3f674f]">
            Record applications or adjust the date/sample filter to inspect
            recruitment funnel and conversion charts.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row 1: Pipeline Funnel (HTML 2 bar style), Applications by Stage, Application Outcomes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart 1: Application Pipeline Funnel */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                    Application Pipeline Funnel
                  </h2>
                  <p className="text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                    Cumulative progression across recruitment stages
                  </p>
                </div>
                <span className="rounded-full bg-[#eff5ee] px-2.5 py-1 text-[11px] font-semibold text-[#3f674f] dark:bg-[#17231c] dark:text-[#a5d1b4]">
                  {kpi.totalApplicationsSubmitted} leads
                </span>
              </div>
              <div className="space-y-3.5">
                {data.funnel.map((step, idx) => {
                  const pct = step.percentageOfSubmitted ?? 0;
                  const barColor =
                    FUNNEL_BAR_COLORS[idx % FUNNEL_BAR_COLORS.length];
                  return (
                    <div key={step.key} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {step.label}
                        </span>
                        <span className="font-mono text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                          {step.count}{" "}
                          <span className="font-bold text-[#171d19] dark:text-[#ecf3eb]">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex h-6 w-full overflow-hidden rounded-lg bg-[#eff5ee] dark:bg-[#17231c]">
                        <div
                          className={`flex h-full items-center justify-end rounded-lg px-2 font-mono text-[10px] font-bold text-white transition-all duration-500 ${barColor}`}
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
            </div>

            {/* Chart 2: Applications by Recruitment Stage */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Applications by Recruitment Stage
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
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
                      <span className="w-36 truncate font-medium text-[#171d19] dark:text-[#ecf3eb]">
                        {st.name}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eff5ee] dark:bg-[#17231c]">
                        <div
                          className={`h-full rounded-full ${style.dot}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
                        {st.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 3: Application Outcomes */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Application Outcomes
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                Active vs closed recruitment outcomes
              </p>
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
                        isAnimationActive={false}
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
                <div className="space-y-1.5">
                  {data.outcomeDistribution.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            OUTCOME_COLORS[item.key] ?? "#006a42",
                        }}
                      />
                      <span className="text-[#3e4a41] dark:text-[#b7c6ba]">
                        {item.name}:
                      </span>
                      <span className="font-mono font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Application Activity Over Time + Monthly Recruitment Performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 4 */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Application Activity Over Time
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                Monthly volume of submitted job applications
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="submitted"
                      name="Submitted Applications"
                      fill="#006a42"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5 */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Monthly Recruitment Performance
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                Submissions compared with interviews reached, offers, and hires
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="submitted"
                      name="Submitted"
                      fill="#006a42"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="interviewsReached"
                      name="Interviews"
                      fill="#008655"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="offersReached"
                      name="Offers"
                      fill="#8f6f3b"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="hired"
                      name="Hired"
                      fill="#005232"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 3: Interview Conversion Rate + Applications by Job Platform */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 6 */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Interview Conversion Rate Trend (%)
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                Share of eligible applications reaching interview or assessment
                per month
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyConversionTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="interviewRate"
                      name="Interview Conversion (%)"
                      stroke="#006a42"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#006a42" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 7 */}
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Applications by Job Platform
              </h2>
              <p className="mb-4 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
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
                    <Tooltip />
                    <Bar
                      dataKey="applicationsCount"
                      name="Applications"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={false}
                    >
                      {data.platformDistribution.map((entry, idx) => (
                        <Cell
                          key={entry.platformName}
                          fill={PLATFORM_PALETTE[idx % PLATFORM_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Breakdown Tables: Response Rate by Company, Platform & Industry */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Response Rate by Company */}
            <div className="elevation-1 overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 lg:col-span-7 dark:border-[#24332a] dark:bg-[#111a15]">
              <div className="mb-4">
                <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  Response Rate by Company
                </h2>
                <p className="text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                  Employer responsiveness and average days to first reply
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="rounded-xl bg-[#eff5ee]/80 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:bg-[#17231c] dark:text-[#a5d1b4]">
                      <th className="rounded-l-xl px-4 py-3">Company</th>
                      <th className="px-4 py-3 text-right">Submitted</th>
                      <th className="px-4 py-3 text-right">Responded</th>
                      <th className="px-4 py-3 text-right">Response Rate</th>
                      <th className="px-4 py-3 text-right">Avg Reply</th>
                      <th className="rounded-r-xl px-4 py-3 text-right">
                        Interviews
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3eae3]/70 dark:divide-[#24332a]">
                    {data.companyResponseRates.map((row) => (
                      <tr
                        key={row.companyName}
                        className="transition-colors hover:bg-[#eff5ee]/50 dark:hover:bg-[#17231c]/50"
                      >
                        <td className="px-4 py-3 font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {row.companyName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {row.submittedCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {row.respondedCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#006a42] tabular-nums dark:text-[#69dca0]">
                          {row.responseRate != null
                            ? `${row.responseRate}%`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                          {row.averageResponseDays != null
                            ? `${row.averageResponseDays}d`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#008655] tabular-nums dark:text-[#86f9ba]">
                          {row.interviewCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Platform & Industry Distributions */}
            <div className="space-y-6 lg:col-span-5">
              <div className="elevation-1 overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
                <h2 className="mb-3 text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  Application Distribution by Platform
                </h2>
                <div className="space-y-2.5">
                  {data.platformDistribution.map((p) => (
                    <div
                      key={p.platformName}
                      className="flex flex-col gap-1.5 rounded-xl bg-[#eff5ee] p-3 dark:bg-[#17231c]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                            {p.platformName}
                          </p>
                          <p className="text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                            {p.interviewsReached} interview(s) ·{" "}
                            {p.interviewConversionRate != null
                              ? `${p.interviewConversionRate}% conversion`
                              : "N/A"}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#c0edcf] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#005232] tabular-nums dark:bg-[#005232] dark:text-[#86f9ba]">
                          {p.applicationsCount} ({p.sharePercent ?? 0}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dde4dd] dark:bg-[#23342a]">
                        <div
                          className="h-full rounded-full bg-[#006a42] dark:bg-[#69dca0]"
                          style={{ width: `${p.sharePercent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="elevation-1 overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
                <h2 className="mb-3 text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  Application Distribution by Industry
                </h2>
                <div className="space-y-2">
                  {data.industryDistribution.map((ind) => (
                    <div
                      key={ind.industry}
                      className="flex items-center justify-between rounded-xl bg-[#eff5ee] p-3 dark:bg-[#17231c]"
                    >
                      <div>
                        <p className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {ind.industry}
                        </p>
                        <p className="text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                          {ind.interviewsReached} interview(s) ·{" "}
                          {ind.hiredCount} hired
                        </p>
                      </div>
                      <span className="rounded-full bg-[#dde4dd] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#171d19] tabular-nums dark:bg-[#23342a] dark:text-[#ecf3eb]">
                        {ind.applicationsCount} ({ind.sharePercent ?? 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
      ? "text-[#006a42] dark:text-[#69dca0]"
      : accent === "amber"
        ? "text-[#745725] dark:text-[#e8c084]"
        : accent === "rose"
          ? "text-[#ba1a1a] dark:text-rose-400"
          : "text-[#171d19] dark:text-[#ecf3eb]";

  return (
    <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-shadow hover:shadow-md dark:border-[#24332a] dark:bg-[#111a15]">
      <p className="text-label-xs uppercase text-[#3f674f] dark:text-[#a5d1b4]">
        {label}
      </p>
      <p className={`mt-2 text-metric-num ${valueColor}`}>{value}</p>
    </div>
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
    <div className="elevation-1 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 dark:border-[#24332a] dark:bg-[#111a15]">
      <p className="text-label-xs uppercase text-[#3f674f] dark:text-[#a5d1b4]">
        {label}
      </p>
      <p className="mt-1.5 font-display text-lg font-bold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
        {sub}
      </p>
    </div>
  );
}
