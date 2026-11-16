import { AppShell } from "@/components/layout/app-shell";
import { SampleDataBanner } from "@/components/layout/sample-data-banner";
import { requireUser } from "@/lib/session";
import { getNotificationsSummary } from "@/server/queries/emails";
import { getSampleDataStatus } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [sampleStatus, notifSummary] = await Promise.all([
    getSampleDataStatus(user.id),
    getNotificationsSummary(user.id),
  ]);

  return (
    <AppShell
      user={user}
      notifications={notifSummary.items}
      banner={
        <SampleDataBanner
          hasSampleData={sampleStatus.hasSampleData}
          sampleAppsCount={sampleStatus.sampleAppsCount}
          sampleJobsCount={sampleStatus.sampleJobsCount}
          realAppsCount={sampleStatus.realAppsCount}
        />
      }
    >
      {children}
    </AppShell>
  );
}
