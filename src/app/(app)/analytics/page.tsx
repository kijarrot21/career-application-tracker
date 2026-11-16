import { AnalyticsClient } from "@/components/analytics/analytics-client";
import { requireUser } from "@/lib/session";
import { getAnalyticsData } from "@/server/queries/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    fromDate?: string;
    toDate?: string;
    sampleMode?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const sampleMode =
    sp.sampleMode === "include" || sp.sampleMode === "exclude"
      ? sp.sampleMode
      : "auto";

  const data = await getAnalyticsData(user.id, {
    fromDate: sp.fromDate || undefined,
    toDate: sp.toDate || undefined,
    sampleMode,
  });

  return <AnalyticsClient data={data} />;
}
