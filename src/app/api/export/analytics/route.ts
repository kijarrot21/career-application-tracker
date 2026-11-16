import { NextResponse, type NextRequest } from "next/server";
import { ensureDbReady } from "@/db";
import { writeAudit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { getOptionalUser } from "@/lib/session";
import { getAnalyticsData } from "@/server/queries/analytics";

export async function GET(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const sampleParam = sp.get("sampleMode");
  const sampleMode =
    sampleParam === "include" || sampleParam === "exclude"
      ? sampleParam
      : "auto";

  const data = await getAnalyticsData(user.id, {
    fromDate: sp.get("fromDate") || undefined,
    toDate: sp.get("toDate") || undefined,
    sampleMode,
  });

  const rows: (string | number | null)[][] = [
    ["SECTION", "METRIC / DIMENSION", "VALUE", "DETAILS / BREAKDOWN"],
    ["KPI Summary", "Total Jobs Discovered", data.kpi.totalJobsDiscovered, ""],
    [
      "KPI Summary",
      "Total Applications Submitted",
      data.kpi.totalApplicationsSubmitted,
      data.includeSample ? "Includes sample records" : "Real records only",
    ],
    ["KPI Summary", "Active Applications", data.kpi.activeApplications, ""],
    [
      "KPI Summary",
      "Applications Under Screening",
      data.kpi.applicationsUnderScreening,
      "",
    ],
    ["KPI Summary", "Interviews Scheduled", data.kpi.interviewsScheduled, ""],
    ["KPI Summary", "Offers Received", data.kpi.offersReceived, ""],
    [
      "KPI Summary",
      "Successful Applications (Hired)",
      data.kpi.successfulApplications,
      "",
    ],
    [
      "KPI Summary",
      "Rejected Applications",
      data.kpi.rejectedApplications,
      "",
    ],
    [
      "KPI Summary",
      "Withdrawn Applications",
      data.kpi.withdrawnApplications,
      "",
    ],
    [
      "KPI Summary",
      "No Response Applications",
      data.kpi.noResponseApplications,
      "",
    ],
    [
      "Conversion Rates",
      "Application-to-Interview Rate (%)",
      data.kpi.applicationToInterviewRate ?? "N/A",
      `${data.kpi.denominators.reachedInterviewCount} / ${data.kpi.denominators.eligibleForInterviewRate} eligible`,
    ],
    [
      "Conversion Rates",
      "Interview-to-Offer Rate (%)",
      data.kpi.interviewToOfferRate ?? "N/A",
      `${data.kpi.denominators.reachedOfferCount} / ${data.kpi.denominators.eligibleForOfferRate} eligible`,
    ],
    [
      "Conversion Rates",
      "Offer Acceptance Rate (%)",
      data.kpi.offerAcceptanceRate ?? "N/A",
      `${data.kpi.denominators.decidedOffersCount} decided offers`,
    ],
    [
      "Conversion Rates",
      "Overall Application Success Rate (%)",
      data.kpi.overallSuccessRate ?? "N/A",
      `${data.kpi.successfulApplications} / ${data.kpi.denominators.eligibleForSuccessRate} non-withdrawn`,
    ],
    [
      "Cycle Duration",
      "Average Time to First Response (days)",
      data.kpi.averageTimeToFirstResponseDays ?? "N/A",
      `${data.kpi.denominators.respondedApplicationsCount} responded`,
    ],
    [
      "Cycle Duration",
      "Average Time to Interview (days)",
      data.kpi.averageTimeToInterviewDays ?? "N/A",
      "",
    ],
    [
      "Cycle Duration",
      "Average Recruitment Cycle Duration (days)",
      data.kpi.averageRecruitmentCycleDays ?? "N/A",
      "Closed applications",
    ],
  ];

  for (const m of data.monthlyPerformance) {
    rows.push([
      "Monthly Performance",
      m.month,
      m.submitted,
      `Interviews: ${m.interviewsReached}, Offers: ${m.offersReached}, Hired: ${m.hired}, Interview Rate: ${m.interviewConversionRate ?? "N/A"}%`,
    ]);
  }

  for (const p of data.platformDistribution) {
    rows.push([
      "By Platform",
      p.platformName,
      p.applicationsCount,
      `Share: ${p.sharePercent ?? 0}%, Interviews: ${p.interviewsReached}, Conversion: ${p.interviewConversionRate ?? "N/A"}%`,
    ]);
  }

  for (const ind of data.industryDistribution) {
    rows.push([
      "By Industry",
      ind.industry,
      ind.applicationsCount,
      `Share: ${ind.sharePercent ?? 0}%, Interviews: ${ind.interviewsReached}, Hired: ${ind.hiredCount}`,
    ]);
  }

  for (const co of data.companyResponseRates) {
    rows.push([
      "By Company",
      co.companyName,
      co.submittedCount,
      `Responded: ${co.respondedCount}, Response Rate: ${co.responseRate ?? "N/A"}%, Avg Response Days: ${co.averageResponseDays ?? "N/A"}`,
    ]);
  }

  const db = await ensureDbReady();
  await writeAudit(db, {
    userId: user.id,
    entityType: "analytics_report_csv",
    entityId: user.id,
    action: "export",
    summary: "Exported recruitment activity & analytics report to CSV",
  });

  const csv = toCsv(
    ["Section", "Dimension / Metric", "Primary Value", "Breakdown & Notes"],
    rows.slice(1),
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recruitment-activity-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
