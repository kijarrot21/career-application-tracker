import { NextResponse, type NextRequest } from "next/server";
import { verifySignedDownloadToken } from "@/lib/crypto";
import { getOptionalUser } from "@/lib/session";
import { getDocumentVersionFileForUserService } from "@/server/services/career";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  let userId: string | null = null;

  if (token) {
    const verified = verifySignedDownloadToken(token);
    if (!verified || verified.versionId !== versionId) {
      return NextResponse.json(
        { error: "Invalid, expired, or mismatched download token." },
        { status: 403 },
      );
    }
    userId = verified.userId;
  } else {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  const res = await getDocumentVersionFileForUserService(userId, versionId);
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
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      // DEF-11-002: sandbox inline-served documents (PDF/text/images) so a
      // malicious file cannot execute scripts or access the app origin.
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
