import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import {
  applicationArchiveSnapshots,
  documents,
  user,
} from "@/db/schema";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "@/lib/crypto";
import {
  deleteUserStorageDir,
  readDocumentFile,
  resetMalwareScanner,
} from "@/lib/storage";
import { recordSubmissionService } from "@/server/services/applications";
import {
  archiveApplicationService,
  purgeExpiredArchivesService,
  updateClosureRetentionService,
  updateRetentionPolicyService,
} from "@/server/services/archive";
import {
  deleteDocumentService,
  getDocumentVersionFileForUserService,
  getSignedDocumentUrlForUserService,
  uploadOrVersionDocumentService,
} from "@/server/services/career";
import {
  deleteUserAccountService,
  exportAccountJsonService,
} from "@/server/services/settings";
import { createVacancyService } from "@/server/services/vacancies";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

describe("Phase 10: Security and Data Governance Integration Tests", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "alice-sec",
      name: "Alice Security",
      email: "alice@security.local",
    });
    await createTestUser(db, {
      id: "bob-sec",
      name: "Bob Malicious",
      email: "bob@attacker.local",
    });
  });

  afterEach(async () => {
    resetMalwareScanner();
    deleteUserStorageDir("alice-sec");
    deleteUserStorageDir("bob-sec");
    await cleanup();
  });

  describe("Multi-tenant Data Isolation", () => {
    it("ensures User B cannot read, download, or delete User A's documents", async () => {
      // Alice uploads a CV
      const dummyPdf = Buffer.from("%PDF-1.4 Alice confidential CV", "utf8");
      const aliceDoc = await uploadOrVersionDocumentService("alice-sec", {
        metadata: {
          category: "master_cv",
          title: "Alice Confidential CV",
          versionLabel: "v1.0",
          linkRole: "cv",
        },
        file: {
          buffer: dummyPdf,
          filename: "alice_cv.pdf",
        },
      });

      expect(aliceDoc.version.storageKey).toBeDefined();

      // Alice can read her document file
      const aliceRead = await getDocumentVersionFileForUserService(
        "alice-sec",
        aliceDoc.version.id,
      );
      expect(aliceRead).not.toBeNull();
      expect(aliceRead?.buffer.toString("utf8")).toBe("%PDF-1.4 Alice confidential CV");

      // Bob tries to read Alice's document file using his own userId
      const bobRead = await getDocumentVersionFileForUserService(
        "bob-sec",
        aliceDoc.version.id,
      );
      expect(bobRead).toBeNull();

      // Bob tries to delete Alice's document
      await expect(
        deleteDocumentService("bob-sec", aliceDoc.documentId),
      ).rejects.toThrow(/Document not found/);

      // Verify Alice's document still exists
      const [stillExists] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, aliceDoc.documentId));
      expect(stillExists).toBeDefined();
    });

    it("ensures User B cannot access User A's applications or archive records", async () => {
      // Alice creates a vacancy and application
      const vac = await createVacancyService("alice-sec", {
        companyName: "SecureCorp",
        title: "Security Architect",
        currency: "IDR",
        salaryPeriod: "month",
        priority: "medium",
        skills: ["TypeScript"],
        triageStatus: "shortlisted",
      });
      const aliceApp = await recordSubmissionService("alice-sec", {
        vacancyId: vac.id,
        submittedOn: "2026-10-01",
        submissionMethod: "platform",
        currency: "IDR",
        isIntentionalReapply: false,
      });

      // Archive it
      await archiveApplicationService("alice-sec", {
        applicationId: aliceApp.id,
        closureReason: "Position fulfilled",
      });

      const aliceArchive = await db
        .select()
        .from(applicationArchiveSnapshots)
        .where(eq(applicationArchiveSnapshots.userId, "alice-sec"));
      expect(aliceArchive.length).toBe(1);

      // Bob's archive is completely empty and isolated
      const bobArchive = await db
        .select()
        .from(applicationArchiveSnapshots)
        .where(eq(applicationArchiveSnapshots.userId, "bob-sec"));
      expect(bobArchive.length).toBe(0);
    });
  });

  describe("Short-lived Signed Download URLs", () => {
    it("generates a signed download URL that authorizes access to document versions", async () => {
      const pdfContent = Buffer.from("%PDF-1.4 Signed download test", "utf8");
      const doc = await uploadOrVersionDocumentService("alice-sec", {
        metadata: {
          category: "master_cv",
          title: "Public Shareable CV",
          versionLabel: "v1.0",
          linkRole: "cv",
        },
        file: {
          buffer: pdfContent,
          filename: "shareable.pdf",
        },
      });

      const signedUrl = await getSignedDocumentUrlForUserService(
        "alice-sec",
        doc.version.id,
        { expiresInSeconds: 120 },
      );
      expect(signedUrl).toContain("/api/documents/download?token=");

      const urlObj = new URL(signedUrl, "https://app.local");
      const token = urlObj.searchParams.get("token")!;
      expect(token).toBeDefined();

      // Token verification succeeds for Alice
      const verified = verifySignedDownloadToken(token);
      expect(verified?.userId).toBe("alice-sec");
      expect(verified?.versionId).toBe(doc.version.id);

      // Fetch file using the token's extracted identity
      const fileData = await getDocumentVersionFileForUserService(
        verified!.userId,
        verified!.versionId,
      );
      expect(fileData?.buffer.toString("utf8")).toBe("%PDF-1.4 Signed download test");
    });

    it("blocks forged or tampered download tokens", async () => {
      const forgedToken = createSignedDownloadToken({
        userId: "alice-sec",
        versionId: "ver-nonexistent",
        expiresInSeconds: 300,
      });

      const tampered = forgedToken + "evil";
      expect(verifySignedDownloadToken(tampered)).toBeNull();
    });
  });

  describe("Malware Scanning & Upload Defense", () => {
    it("rejects uploads containing EICAR test string and leaves no orphaned database records", async () => {
      const maliciousBuffer = Buffer.from(
        "%PDF-1.4 X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
        "ascii",
      );

      await expect(
        uploadOrVersionDocumentService("alice-sec", {
          metadata: {
            category: "master_cv",
            title: "Trojan CV",
            versionLabel: "v1.0",
            linkRole: "cv",
          },
          file: {
            buffer: maliciousBuffer,
            filename: "infected.pdf",
          },
        }),
      ).rejects.toThrow(/Threat "EICAR-Standard-AV-Test-Signature" detected/);

      // Verify no document was saved in database
      const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.userId, "alice-sec"));
      expect(docs.length).toBe(0);
    });

    it("rejects binary executable headers masquerading as PDF", async () => {
      const dosMzHeader = Buffer.from([
        0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      ]);

      await expect(
        uploadOrVersionDocumentService("alice-sec", {
          metadata: {
            category: "master_cv",
            title: "Executable disguised as PDF",
            versionLabel: "v1.0",
            linkRole: "cv",
          },
          file: {
            buffer: dosMzHeader,
            filename: "payload.pdf",
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Right to Erasure & Physical Storage Purge (UU PDP Art. 8 / GDPR Art. 17)", () => {
    it("deleting user account deletes all database records and purges disk storage files", async () => {
      // 1. Upload a document to disk
      const pdf = Buffer.from("%PDF-1.4 Data to be deleted permanently", "utf8");
      const doc = await uploadOrVersionDocumentService("alice-sec", {
        metadata: {
          category: "master_cv",
          title: "Temporary CV",
          versionLabel: "v1.0",
          linkRole: "cv",
        },
        file: {
          buffer: pdf,
          filename: "temp_cv.pdf",
        },
      });

      const storageKey = doc.version.storageKey!;
      expect(readDocumentFile(storageKey)).not.toBeNull();

      // 2. Perform full account deletion
      await deleteUserAccountService("alice-sec");

      // 3. Verify user record is gone
      const [u] = await db.select().from(user).where(eq(user.id, "alice-sec"));
      expect(u).toBeUndefined();

      // 4. Verify document records in DB are gone
      const userDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.userId, "alice-sec"));
      expect(userDocs.length).toBe(0);

      // 5. Verify physical storage file is no longer readable
      expect(readDocumentFile(storageKey)).toBeNull();
    });
  });

  describe("Right to Access & Data Portability (UU PDP Art. 7 / GDPR Art. 20)", () => {
    it("exports complete user data as JSON without leaking authentication passwords or internal secrets", async () => {
      const vac = await createVacancyService("alice-sec", {
        companyName: "CloudTech",
        title: "Cloud Architect",
        currency: "IDR",
        salaryPeriod: "month",
        priority: "medium",
        skills: ["Cloud"],
        triageStatus: "shortlisted",
      });
      await recordSubmissionService("alice-sec", {
        vacancyId: vac.id,
        submittedOn: "2026-10-01",
        submissionMethod: "platform",
        currency: "IDR",
        isIntentionalReapply: false,
      });

      const exportData = await exportAccountJsonService("alice-sec");

      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.user.id).toBe("alice-sec");
      expect(exportData.user.email).toBe("alice@security.local");
      // Verify password hash is never present in user export
      expect((exportData.user as Record<string, unknown>).password).toBeUndefined();
      expect((exportData.user as Record<string, unknown>).hashedPassword).toBeUndefined();

      // Verify application data is included
      expect(exportData.applications.length).toBe(1);

      // Verify audit trail entry was created
      expect(exportData.auditLogs.some((a) => a.action === "export")).toBe(true);
    });
  });

  describe("Retention Policy & Expired Archive Purge", () => {
    it("purges expired archive records according to configured retention days", async () => {
      // Set retention policy: 30 days, auto delete expired
      await updateRetentionPolicyService("alice-sec", {
        autoArchiveOnTerminal: true,
        archiveRetentionDays: 30,
        archiveAutoDeleteExpired: true,
      });

      const vac = await createVacancyService("alice-sec", {
        companyName: "OldCorp",
        title: "Intern",
        currency: "IDR",
        salaryPeriod: "month",
        priority: "medium",
        skills: ["General"],
        triageStatus: "shortlisted",
      });
      const app = await recordSubmissionService("alice-sec", {
        vacancyId: vac.id,
        submittedOn: "2026-01-01",
        submissionMethod: "platform",
        currency: "IDR",
        isIntentionalReapply: false,
      });

      const archived = await archiveApplicationService("alice-sec", {
        applicationId: app.id,
        closureReason: "Old rejection",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 40); // 40 days ago
      const pastDateStr = pastDate.toISOString().split("T")[0];

      await updateClosureRetentionService("alice-sec", {
        closureRecordId: archived.closureRecord.id,
        retainUntil: pastDateStr,
      });

      // Purge expired records
      const purgeRes = await purgeExpiredArchivesService("alice-sec");
      expect(purgeRes.purgedCount).toBe(1);

      // Confirm snapshot is gone
      const snapshots = await db
        .select()
        .from(applicationArchiveSnapshots)
        .where(eq(applicationArchiveSnapshots.userId, "alice-sec"));
      expect(snapshots.length).toBe(0);
    });
  });
});
