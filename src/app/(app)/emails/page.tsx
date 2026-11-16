import { EmailCenterClient } from "@/components/emails/email-center-client";
import { requireUser } from "@/lib/session";
import { getEmailCenterData } from "@/server/queries/emails";

export const dynamic = "force-dynamic";

export default async function EmailCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ oauthError?: string; connected?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const data = await getEmailCenterData(user.id);

  return (
    <EmailCenterClient
      data={data}
      oauthError={sp.oauthError ?? null}
      connectedProvider={sp.connected ?? null}
    />
  );
}
