import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/server/queries/dashboard";
import { getDashboardInsights } from "@/server/queries/dashboard-insights";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, insights] = await Promise.all([
    getDashboardData(user.id),
    getDashboardInsights(user.id),
  ]);

  return <DashboardClient user={user} data={data} insights={insights} />;
}
