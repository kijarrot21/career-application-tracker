import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/session";
import { renderGeneratedCvExportService } from "@/server/ai/services";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { analysisId } = await params;
  const formatParam = request.nextUrl.searchParams.get("format");
  const format =
    formatParam === "docx" ? "docx" : formatParam === "txt" ? "txt" : "pdf";

  try {
    const exported = await renderGeneratedCvExportService(user.id, {
      analysisId,
      format,
    });

    return new NextResponse(new Uint8Array(exported.buffer), {
      status: 200,
      headers: {
        "Content-Type": exported.mimeType,
        "Content-Disposition": `attachment; filename="${exported.filename.replace(/"/g, "")}"`,
        "Content-Length": String(exported.buffer.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Generated CV export failed.",
      },
      { status: 404 },
    );
  }
}
