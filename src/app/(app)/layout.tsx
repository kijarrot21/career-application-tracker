import { LocaleProvider } from "@/components/i18n/locale-provider";
import { AppShell } from "@/components/layout/app-shell";
import { SampleDataBanner } from "@/components/layout/sample-data-banner";
import { requireUser } from "@/lib/session";
import { getNotificationsSummary } from "@/server/queries/emails";
import {
  getSampleDataStatus,
  getUserSettings,
} from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [settings, sampleStatus, notifSummary] = await Promise.all([
    getUserSettings(user.id),
    getSampleDataStatus(user.id),
    getNotificationsSummary(user.id),
  ]);

  return (
    <LocaleProvider
      locale={settings.preferredLocale}
      timezone={settings.timezone}
      currency={settings.currency}
    >
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
    </LocaleProvider>
  );
}
