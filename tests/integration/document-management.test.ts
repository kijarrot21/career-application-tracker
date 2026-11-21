import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { documentVersions } from "@/db/schema";
import {
  deleteDocumentService,
  getDocumentVersionFileForUserService,
  updateDocumentService,
  updateDocumentVersionService,
  uploadOrVersionDocumentService,
} from "@/server/services/career";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const pdf = (label: string) =>
  Buffer.from(`%PDF-1.7\nCV content ${label}`, "utf8");

describe("document management services", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, { id: "user_a", name: "A", email: "a@example.com" });
    await createTestUser(db, { id: "user_b", name: "B", email: "b@example.com" });
  });

  afterEach(async () => {
    await cleanup();
  });

  async function upload(label: string) {
    return uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: `Master CV ${label}`,
        versionLabel: "v1.0",
        linkRole: "cv",
      },
      file: { buffer: pdf(label), filename: `cv-${label}.pdf` },
    });
  }

  it("stores a new version with uploaded processing state", async () => {
    const { version } = await upload("one");
    expect(version.processingStatus).toBe("uploaded");
    expect(version.processingAttempts).toBe(0);
    expect(version.aiJobId).toBeNull();
  });

  it("renames a document, changes category and metadata for its owner only", async () => {
    const { documentId } = await upload("one");

    await updateDocumentService("user_a", {
      documentId,
      title: "Senior CV",
      category: "custom_cv",
      description: "Tailored copy",
    });

    const docs = await db.query.documents.findMany();
    const doc = docs.find((d) => d.id === documentId);
    expect(doc?.title).toBe("Senior CV");
    expect(doc?.category).toBe("custom_cv");
    expect(doc?.description).toBe("Tailored copy");

    await expect(
      updateDocumentService("user_b", {
        documentId,
        title: "Stolen",
        category: "master_cv",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("updates version label and notes for its owner only", async () => {
    const { version } = await upload("one");

    await updateDocumentVersionService("user_a", {
      versionId: version.id,
      label: "v1.1 revised",
      notes: "Corrected phone number",
    });

    const rows = await db.query.documentVersions.findMany();
    const updated = rows.find((v) => v.id === version.id);
    expect(updated?.label).toBe("v1.1 revised");
    expect(updated?.notes).toBe("Corrected phone number");

    await expect(
      updateDocumentVersionService("user_b", {
        versionId: version.id,
        label: "Hacked",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("keeps processing state independent when a CV file is replaced by a new version", async () => {
    const first = await upload("old");
    await db
      .update(documentVersions)
      .set({ processingStatus: "completed" })
      .where(eq(documentVersions.id, first.version.id));

    const replacement = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        documentId: first.documentId,
        category: "master_cv",
        title: "Master CV old",
        versionLabel: "v2.0",
        linkRole: "cv",
      },
      file: { buffer: pdf("new"), filename: "cv-new.pdf" },
    });

    expect(replacement.version.versionNo).toBe(2);
    expect(replacement.version.processingStatus).toBe("uploaded");
    expect(replacement.version.processingAttempts).toBe(0);
    const rows = await db.query.documentVersions.findMany();
    expect(rows.find((v) => v.id === first.version.id)?.processingStatus).toBe("completed");
  });

  it("downloads original bytes for owner and denies another user", async () => {
    const { version } = await upload("one");

    expect((await getDocumentVersionFileForUserService("user_a", version.id))?.buffer.equals(pdf("one"))).toBe(true);
    expect(await getDocumentVersionFileForUserService("user_b", version.id)).toBeNull();

    await deleteDocumentService("user_a", version.documentId);
    expect(await getDocumentVersionFileForUserService("user_a", version.id)).toBeNull();
  });

  it("rejects deletion of another user's document", async () => {
    const { documentId } = await upload("one");
    await expect(deleteDocumentService("user_b", documentId)).rejects.toThrow(/not found/i);
    expect((await db.query.documents.findMany()).find((d) => d.id === documentId)).toBeDefined();
  });
});
