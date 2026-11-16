import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/server/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  return <DashboardClient user={user} data={data} />;
}
