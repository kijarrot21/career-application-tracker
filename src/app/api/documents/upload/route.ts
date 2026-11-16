import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { DocumentCategory } from "@/lib/constants";
import { getOptionalUser } from "@/lib/session";
import { uploadOrVersionDocumentService } from "@/server/services/career";

export async function POST(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not upload document.",
      },
      { status: 400 },
    );
  }
}
