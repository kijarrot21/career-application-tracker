import { revalidatePath } from "next/cache";
import { after, NextResponse, type NextRequest } from "next/server";
import type { DocumentCategory } from "@/lib/constants";
import { DomainError } from "@/lib/errors";
import { getOptionalUser } from "@/lib/session";
import { uploadOrVersionDocumentService } from "@/server/services/career";
import {
  DuplicateCvExtractionError,
  markCvExtractionFailedService,
  startCvExtractionService,
} from "@/server/services/document-processing";

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

    const fileEntries = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter(
      (entry): entry is File =>
        Boolean(entry) && typeof entry === "object" && "arrayBuffer" in entry,
    );

    if (fileEntries.length > 1 && documentId) {
      return NextResponse.json(
        { error: "Multiple files cannot be added as versions of one document." },
        { status: 400 },
      );
    }

    const titles = formData.getAll("titles").map((v) => String(v).trim());
    const categories = formData.getAll("categories").map((v) => String(v).trim());

    const results: Array<{
      documentId: string;
      versionId: string;
      filename: string;
      error?: string;
    }> = [];
    const cvVersionIds: string[] = [];
    let firstSuccess: { documentId: string; version: unknown } | null = null;

    // Metadata-only versions remain supported (existing E2E flow and CV Studio).
    if (fileEntries.length === 0) {
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
        file: null,
      });
      firstSuccess = { documentId: res.documentId, version: res.version };
      results.push({
        documentId: res.documentId,
        versionId: res.version.id,
        filename: "Metadata only",
      });
    }

    for (const [index, file] of fileEntries.entries()) {
      const filename = file.name || "document";
      if (file.size === 0) {
        results.push({
          documentId: "",
          versionId: "",
          filename,
          error: "Uploaded file is empty.",
        });
        continue;
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileCategory = (categories[index] ?? category) as DocumentCategory;
        const fileTitle =
          titles[index] ||
          title ||
          filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
          "Document";
        const res = await uploadOrVersionDocumentService(user.id, {
          metadata: {
            documentId,
            category: fileCategory,
            title: fileTitle,
            description,
            versionLabel,
            notes,
            linkApplicationId,
            linkRole,
          },
          file: { buffer, filename },
        });
        firstSuccess ??= { documentId: res.documentId, version: res.version };
        if (fileCategory === "master_cv" || fileCategory === "custom_cv") {
          cvVersionIds.push(res.version.id);
        }
        results.push({
          documentId: res.documentId,
          versionId: res.version.id,
          filename,
        });
      } catch (err) {
        results.push({
          documentId: "",
          versionId: "",
          filename,
          error:
            err instanceof DomainError
              ? err.message
              : "Could not store this document.",
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No file was provided." },
        { status: 400 },
      );
    }

    revalidatePath("/documents");
    revalidatePath("/applications");
    if (linkApplicationId) {
      revalidatePath(`/applications/${linkApplicationId}`);
    }

    // Upload result is already committed. Extraction runs after the response;
    // no new queue or worker is introduced. AI failures stay on the version row.
    if (cvVersionIds.length > 0) {
      try {
        after(async () => {
          for (const versionId of cvVersionIds) {
            try {
              await startCvExtractionService(user.id, versionId);
            } catch (error) {
              if (error instanceof DuplicateCvExtractionError) continue;
              await markCvExtractionFailedService(
                user.id,
                versionId,
                "SCHEDULING_FAILED",
              );
            }
          }
        });
      } catch {
        for (const versionId of cvVersionIds) {
          await markCvExtractionFailedService(
            user.id,
            versionId,
            "SCHEDULING_FAILED",
          );
        }
      }
    }

    const failed = results.filter((r) => r.error).length;
    return NextResponse.json(
      {
        ...(firstSuccess ?? {}),
        results,
        uploaded: results.length - failed,
        failed,
      },
      { status: failed === results.length ? 400 : 201 },
    );
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
