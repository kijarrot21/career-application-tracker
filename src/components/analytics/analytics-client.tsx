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
  active: "#204CD3",
  successful: "#10B981",
  unsuccessful: "#F43F5E",
  withdrawn: "#64748B",
  no_response: "#F59E0B",
};

const PLATFORM_PALETTE = [
  "#204CD3",
  "#10B981",
  "#F59E0B",
  "#485AA2",
  "#F43F5E",
  "#64748B",
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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
              Result & Career Performance Analytics
            </h1>
            <span
              className={`rounded-full border px-2.5 py-[2px] text-[11px] font-semibold ${
                data.includeSample
                  ? "border-[#F59E0B]/40 bg-[#FFFBEB] text-[#B45309]"
                  : "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
              }`}
            >
              {data.includeSample
                ? "Dataset: Includes Sample Records"
                : "Dataset: Actual User Records Only"}
            </span>
          </div>
          <p className="mt-0.5 text-body-sm text-[#64748B]">
            Conversion rates, recruitment cycle durations, and company/platform/industry performance calculated strictly from database records.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <a
            href={exportCsvHref}
            download
            className="btn-secondary h-9 px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export Activity Report (CSV)
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary h-9 px-3.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF Report
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <form
        onSubmit={applyFilters}
        className="no-print elevation-1 flex flex-wrap items-end gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <label
            htmlFor="analytics-from-date"
            className="block font-semibold text-[#334155] dark:text-slate-300"
          >
            From Date
          </label>
          <input
            id="analytics-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="analytics-to-date"
            className="block font-semibold text-[#334155] dark:text-slate-300"
          >
            To Date
          </label>
          <input
            id="analytics-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="analytics-sample-mode"
            className="block font-semibold text-[#334155] dark:text-slate-300"
          >
            Sample Records
          </label>
          <select
            id="analytics-sample-mode"
            value={sampleMode}
            onChange={(e) =>
              setSampleMode(e.target.value as "auto" | "include" | "exclude")
            }
            className="mt-1 h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="auto">
              Auto (Exclude once real applications exist)
            </option>
            <option value="exclude">Real User Records Only</option>
            <option value="include">Include Sample Demonstration Data</option>
          </select>
        </div>

        <button type="submit" className="btn-primary h-9 px-3.5 text-xs">
          <Filter className="h-3.5 w-3.5" />
          Apply Filters
        </button>

        {(fromDate || toDate || sampleMode !== "auto") && (
          <button
            type="button"
            onClick={resetFilters}
            className="btn-secondary h-9 px-3 text-xs"
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
            accent="blue"
          />
          <KpiTile
            label="3. Active Applications"
            value={kpi.activeApplications}
            accent="blue"
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
            accent="emerald"
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

      {/* Conversion Rates & Cycle Duration Metrics (with explicit denominators) */}
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
        <div className="elevation-1 flex flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <BarChart3 className="h-8 w-8 text-[#64748B]" />
          <p className="mt-2 text-title-md text-[#0F172A] dark:text-slate-100">
            No submitted applications in this dataset yet
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Record applications or adjust the date/sample filter to inspect recruitment funnel and conversion charts.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row 1: Pipeline Funnel, Applications by Stage, Application Outcomes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart 1: Application Pipeline Funnel */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Application Pipeline Funnel
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
                Cumulative progression across recruitment stages
              </p>
              <div className="space-y-3">
                {data.funnel.map((step) => (
                  <div key={step.key} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#334155] dark:text-slate-300">
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
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[#204CD3]"
                        style={{ width: `${step.percentageOfSubmitted ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Applications by Recruitment Stage */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Applications by Recruitment Stage
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
                Current snapshot across active and terminal stages
              </p>
              <div className="space-y-2">
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
                      <span className="w-36 truncate font-medium text-[#334155] dark:text-slate-300">
                        {st.name}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${style.dot}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono font-semibold text-[#0F172A] tabular-nums dark:text-slate-200">
                        {st.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 3: Application Outcomes */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Application Outcomes
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
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
                            fill={OUTCOME_COLORS[entry.key] ?? "#204CD3"}
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
            </div>
          </div>

          {/* Charts Row 2: Application Activity Over Time + Monthly Recruitment Performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 4: Application Activity Over Time */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Application Activity Over Time
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
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
                      fill="#204CD3"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Monthly Recruitment Performance */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Monthly Recruitment Performance
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
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
                      fill="#204CD3"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="interviewsReached"
                      name="Interviews"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="offersReached"
                      name="Offers"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="hired"
                      name="Hired"
                      fill="#047857"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 3: Interview Conversion Rate + Applications by Job Platform */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 6: Interview Conversion Rate */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Interview Conversion Rate Trend (%)
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
                Share of eligible applications reaching interview or assessment per month
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
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10B981" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 7: Applications by Job Platform */}
            <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                Applications by Job Platform
              </h2>
              <p className="mb-4 text-[11px] text-[#64748B]">
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
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
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
                      radius={[0, 4, 4, 0]}
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
            <div className="elevation-1 overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-[#E2E8F0] px-5 py-3.5 dark:border-slate-800">
                <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                  Response Rate by Company
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Employer responsiveness and average days to first reply
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B] dark:border-slate-800 dark:bg-slate-950">
                      <th className="px-4 py-2.5">Company</th>
                      <th className="px-4 py-2.5 text-right">Submitted</th>
                      <th className="px-4 py-2.5 text-right">Responded</th>
                      <th className="px-4 py-2.5 text-right">Response Rate</th>
                      <th className="px-4 py-2.5 text-right">Avg Reply</th>
                      <th className="px-4 py-2.5 text-right">Interviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {data.companyResponseRates.map((row) => (
                      <tr key={row.companyName}>
                        <td className="px-4 py-2.5 font-semibold text-[#0F172A] dark:text-slate-100">
                          {row.companyName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {row.submittedCount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {row.respondedCount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
                          {row.responseRate != null
                            ? `${row.responseRate}%`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#64748B] tabular-nums">
                          {row.averageResponseDays != null
                            ? `${row.averageResponseDays}d`
                            : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#047857] tabular-nums dark:text-emerald-400">
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
              <div className="elevation-1 overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-[#E2E8F0] px-5 py-3 dark:border-slate-800">
                  <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                    Application Distribution by Platform
                  </h2>
                </div>
                <div className="divide-y divide-[#E2E8F0] px-5 dark:divide-slate-800">
                  {data.platformDistribution.map((p) => (
                    <div
                      key={p.platformName}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {p.platformName}
                        </p>
                        <p className="text-[11px] text-[#64748B] tabular-nums">
                          {p.interviewsReached} interview(s) ·{" "}
                          {p.interviewConversionRate != null
                            ? `${p.interviewConversionRate}% conversion`
                            : "N/A"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#1D4ED8] tabular-nums">
                        {p.applicationsCount} ({p.sharePercent ?? 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="elevation-1 overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-[#E2E8F0] px-5 py-3 dark:border-slate-800">
                  <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                    Application Distribution by Industry
                  </h2>
                </div>
                <div className="divide-y divide-[#E2E8F0] px-5 dark:divide-slate-800">
                  {data.industryDistribution.map((ind) => (
                    <div
                      key={ind.industry}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {ind.industry}
                        </p>
                        <p className="text-[11px] text-[#64748B] tabular-nums">
                          {ind.interviewsReached} interview(s) · {ind.hiredCount}{" "}
                          hired
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
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
    accent === "blue"
      ? "text-[#204CD3] dark:text-[#B7C4FF]"
      : accent === "emerald"
        ? "text-[#047857] dark:text-emerald-400"
        : accent === "amber"
          ? "text-[#B45309] dark:text-amber-300"
          : accent === "rose"
            ? "text-[#BE123C] dark:text-rose-400"
            : "text-[#0F172A] dark:text-slate-100";

  return (
    <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-label-sm uppercase text-[#64748B]">{label}</p>
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
    <div className="elevation-1 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-label-sm uppercase text-[#64748B]">{label}</p>
      <p className="mt-1.5 font-display text-lg font-bold text-[#0F172A] tabular-nums dark:text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#64748B] tabular-nums">{sub}</p>
    </div>
  );
}
