import { NextResponse, type NextRequest } from "next/server";
import type { AiLocale } from "@/lib/domain/ai";
import { getOptionalUser } from "@/lib/session";
import { MAX_DOCUMENT_BYTES } from "@/lib/storage";
import { UnsupportedDocumentFormatError } from "@/server/ai/extractors/document-text-extractor";
import { AiProviderError } from "@/server/ai/providers";
import { parseCvBufferWithAiService } from "@/server/ai/services";

export async function POST(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing uploaded CV file." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: "CV file must be between 1 byte and 10 MB." },
      { status: 400 },
    );
  }

  const localeRaw = formData.get("locale");
  const locale: AiLocale = localeRaw === "id" ? "id" : "en";
  const consentGranted = formData.get("consentGranted") === "true";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseCvBufferWithAiService(user.id, {
      buffer,
      filename: file.name,
      locale,
      consentGranted,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof UnsupportedDocumentFormatError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiProviderError) {
      const status =
        err.code === "PRIVACY_MODE_BLOCKED" || err.code === "CONSENT_REQUIRED"
          ? 403
          : err.code === "TIMEOUT"
            ? 504
            : 502;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse CV." },
      { status: 400 },
    );
  }
}
