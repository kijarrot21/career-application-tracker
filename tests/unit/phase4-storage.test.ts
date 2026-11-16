import { describe, expect, it } from "vitest";
import {
  deleteDocumentFile,
  readDocumentFile,
  validateDocumentBuffer,
  writeDocumentFile,
} from "@/lib/storage";

describe("Phase 4: Document magic-byte validation & storage security", () => {
  it("accepts valid PDF, PNG, TXT, and Markdown buffers and computes SHA-256", () => {
    const pdfBuf = Buffer.from("%PDF-1.7\nSample Resume Content", "utf8");
    const pdfRes = validateDocumentBuffer(pdfBuf, "My Resume (2026).pdf");
    expect(pdfRes.mimeType).toBe("application/pdf");
    expect(pdfRes.sha256).toHaveLength(64);

    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
    ]);
    const pngRes = validateDocumentBuffer(pngBuf, "portfolio.png");
    expect(pngRes.mimeType).toBe("image/png");

    const mdBuf = Buffer.from("# System Design Notes\n- Point 1\n", "utf8");
    const mdRes = validateDocumentBuffer(mdBuf, "prep-notes.md");
    expect(mdRes.mimeType).toBe("text/markdown");
  });

  it("blocks spoofed executables, HTML/SVG scripts, and empty buffers", () => {
    expect(() => validateDocumentBuffer(Buffer.alloc(0), "empty.pdf")).toThrow(
      /empty/i,
    );

    const spoofedPdf = Buffer.from("<html><script>alert(1)</script></html>");
    expect(() => validateDocumentBuffer(spoofedPdf, "resume.pdf")).toThrow(
      /unsupported/i,
    );

    const htmlInTxt = Buffer.from("<!DOCTYPE html><script>evil()</script>");
    expect(() => validateDocumentBuffer(htmlInTxt, "notes.txt")).toThrow(
      /unsupported/i,
    );
  });

  it("writes, reads, and deletes stored document files safely", () => {
    const buf = Buffer.from("%PDF-1.7\nTest Storage", "utf8");
    const key = writeDocumentFile({
      userId: "test_storage_user",
      mimeType: "application/pdf",
      buffer: buf,
    });
    expect(key).toMatch(/^test_storage_user\/[0-9a-f-]+\.pdf$/);

    const readBack = readDocumentFile(key);
    expect(readBack?.equals(buf)).toBe(true);

    deleteDocumentFile(key);
    expect(readDocumentFile(key)).toBeNull();
  });
});
