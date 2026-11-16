import { InterviewsClient } from "@/components/interviews/interviews-client";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { requireUser } from "@/lib/session";
import { getInterviewsModuleData } from "@/server/queries/career";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const user = await requireUser();
  const data = await getInterviewsModuleData(user.id);

  // Use the month of the earliest scheduled interview, or today's month
  const firstScheduled = data.interviews.find((i) => i.status === "scheduled");
  const anchorIso = firstScheduled
    ? firstScheduled.startsAt.toISOString().slice(0, 10)
    : todayInTimeZone(data.timezone);
  const [yearStr, monthStr] = anchorIso.split("-");

  return (
    <InterviewsClient
      data={data}
      initialYearMonth={{
        year: Number(yearStr) || 2026,
        month: (Number(monthStr) || 11) - 1,
      }}
    />
  );
}
