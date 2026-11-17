import { NextResponse, type NextRequest } from "next/server";
import { verifySignedDownloadToken } from "@/lib/crypto";
import { getDocumentVersionFileForUserService } from "@/server/services/career";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing required download token." },
      { status: 400 },
    );
  }

  const verified = verifySignedDownloadToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid, expired, or tampered download token." },
      { status: 403 },
    );
  }

  const res = await getDocumentVersionFileForUserService(
    verified.userId,
    verified.versionId,
  );
  if (!res) {
    return NextResponse.json(
      { error: "Document file not found." },
      { status: 404 },
    );
  }

  const isDownload = request.nextUrl.searchParams.get("download") !== "0";
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
    },
  });
}
