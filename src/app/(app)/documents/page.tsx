import { DocumentsClient } from "@/components/documents/documents-client";
import { requireUser } from "@/lib/session";
import { getDocumentsModuleData } from "@/server/queries/career";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await requireUser();
  const data = await getDocumentsModuleData(user.id);

  return <DocumentsClient data={data} />;
}
