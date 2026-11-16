import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/session";
import { getDocumentVersionFileForUserService } from "@/server/services/career";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { versionId } = await params;
  const res = await getDocumentVersionFileForUserService(user.id, versionId);
  if (!res) {
    return NextResponse.json(
      { error: "Document file not found" },
      { status: 404 },
    );
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = res.version.filename || "document";

  return new NextResponse(new Uint8Array(res.buffer), {
    status: 200,
    headers: {
      "Content-Type": res.version.mimeType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(res.buffer.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
