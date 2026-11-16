import { NextResponse, type NextRequest } from "next/server";
import { ensureDbReady } from "@/db";
import { writeAudit } from "@/lib/audit";
import { OUTCOME_LABELS } from "@/lib/domain/stages";
import { SUBMISSIONS_EXPORT_HEADERS } from "@/lib/export-headers";
import { toCsv } from "@/lib/csv";
import { getOptionalUser } from "@/lib/session";
import { listApplications } from "@/server/queries/applications";
import type { Outcome } from "@/lib/domain/stages";

export async function GET(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const rows = await listApplications(user.id, {
    search: sp.get("search") ?? undefined,
    stageId: sp.get("stageId") ?? undefined,
    outcome: (sp.get("outcome") as Outcome | "all" | null) ?? undefined,
    platformSourceId: sp.get("platformSourceId") ?? undefined,
    fromDate: sp.get("fromDate") ?? undefined,
    toDate: sp.get("toDate") ?? undefined,
  });

  const csvRows = rows.map((r) => [
    r.code,
    r.company.name,
    r.vacancy.title,
    r.jobCategory ?? r.vacancy.department ?? "",
    r.submittedOn,
    r.platform?.name ?? "",
    r.submissionMethod,
    r.stage.name,
    OUTCOME_LABELS[r.outcome],
    r.expectedSalary ?? "",
    r.currency,
    r.cvVersionLabel ?? "",
    r.coverLetterVersionLabel ?? "",
    r.recruiterName ?? "",
    r.recruiterEmail ?? "",
    r.recruiterContact ?? "",
    r.applicationUrl ?? r.vacancy.url ?? "",
    r.externalReferenceId ?? "",
    r.confirmationReference ?? "",
    r.nextFollowUpOn ?? "",
    r.isSample ? "Yes" : "No",
    r.notes ?? "",
  ]);

  const db = await ensureDbReady();
  await writeAudit(db, {
    userId: user.id,
    entityType: "applications_csv",
    entityId: user.id,
    action: "export",
    summary: `Exported ${csvRows.length} applications to CSV`,
  });

  const csv = toCsv(SUBMISSIONS_EXPORT_HEADERS, csvRows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="career-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
