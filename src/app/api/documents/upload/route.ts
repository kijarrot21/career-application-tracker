import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { DocumentCategory } from "@/lib/constants";
import { DomainError } from "@/lib/errors";
import { getOptionalUser } from "@/lib/session";
import { uploadOrVersionDocumentService } from "@/server/services/career";

/** Multipart body ceiling: 10 MB file limit + ~1 MB field/boundary overhead. */
const MAX_UPLOAD_BODY_BYTES = 10 * 1024 * 1024 + 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // DEF-11-008: reject oversized bodies before buffering them into memory.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BODY_BYTES) {
    return NextResponse.json(
      { error: "Document upload exceeds the maximum allowed size." },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const documentId = String(formData.get("documentId") ?? "").trim() || null;
    const category = String(
      formData.get("category") ?? "master_cv",
    ).trim() as DocumentCategory;
    const title = String(formData.get("title") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const versionLabel = String(formData.get("versionLabel") ?? "v1.0").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const linkApplicationId =
      String(formData.get("linkApplicationId") ?? "").trim() || null;
    const linkRole = (String(formData.get("linkRole") ?? "cv").trim() ||
      "cv") as "cv" | "cover_letter" | "other";

    const fileEntry = formData.get("file");
    let filePayload: { buffer: Buffer; filename: string } | null = null;

    if (fileEntry && typeof fileEntry === "object" && "arrayBuffer" in fileEntry) {
      const f = fileEntry as File;
      if (f.size > 0) {
        const arr = await f.arrayBuffer();
        filePayload = {
          buffer: Buffer.from(arr),
          filename: f.name || "document",
        };
      }
    }

    const res = await uploadOrVersionDocumentService(user.id, {
      metadata: {
        documentId,
        category,
        title,
        description,
        versionLabel,
        notes,
        linkApplicationId,
        linkRole,
      },
      file: filePayload,
    });

    revalidatePath("/documents");
    revalidatePath("/applications");
    if (linkApplicationId) {
      revalidatePath(`/applications/${linkApplicationId}`);
    }

    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    // DEF-11-008: only expected domain errors surface their message; internal
    // errors are logged server-side and sanitized for the client.
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[documents/upload] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not upload document." },
      { status: 500 },
    );
  }
}
