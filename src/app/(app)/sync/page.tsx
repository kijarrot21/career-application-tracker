import { SyncCenterClient } from "@/components/sync/sync-center-client";
import { requireUser } from "@/lib/session";
import { getSyncDashboardDataForUser } from "@/server/queries/sync";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const user = await requireUser();
  const data = await getSyncDashboardDataForUser(user.id);

  return <SyncCenterClient data={data} />;
}
