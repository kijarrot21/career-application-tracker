import { notFound } from "next/navigation";
import { ArchiveDetailClient } from "@/components/archive/archive-detail-client";
import { requireUser } from "@/lib/session";
import { getArchivedApplicationDetail } from "@/server/queries/archive";
import { getUserSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [detail, settings] = await Promise.all([
    getArchivedApplicationDetail(user.id, id),
    getUserSettings(user.id),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <ArchiveDetailClient data={detail} defaultCurrency={settings.currency} />
  );
}
