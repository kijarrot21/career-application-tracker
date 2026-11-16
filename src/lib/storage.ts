import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export type AllowedDocumentMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown";

const EXT_FOR_MIME: Record<AllowedDocumentMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

function startsWithBytes(buf: Buffer, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false;
  return prefix.every((b, idx) => buf[idx] === b);
}

/**
 * Inspects file magic bytes and size to prevent spoofing and block active
 * content (such as HTML/SVG/executables).
 */
export function validateDocumentBuffer(
  buffer: Buffer,
  filename: string,
): {
  mimeType: AllowedDocumentMime;
  sizeBytes: number;
  sha256: string;
  sanitizedFilename: string;
} {
  if (buffer.length === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error("File exceeds maximum allowed size of 10 MB.");
  }

  const sanitizedFilename =
    filename
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .trim()
      .slice(0, 140) || "document";
  const lower = sanitizedFilename.toLowerCase();

  let detectedMime: AllowedDocumentMime | null = null;

  // 1. PDF (%PDF-)
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    detectedMime = "application/pdf";
  }
  // 2. PNG
  else if (
    startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    detectedMime = "image/png";
  }
  // 3. JPEG
  else if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    detectedMime = "image/jpeg";
  }
  // 4. WebP (RIFF....WEBP)
  else if (
    buffer.length >= 12 &&
    startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    detectedMime = "image/webp";
  }
  // 5. DOCX (ZIP container with .docx extension)
  else if (
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
    lower.endsWith(".docx")
  ) {
    detectedMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  // 6. Plain text or Markdown (only when .txt or .md and contains no null bytes or HTML/script tags)
  else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const hasNull = buffer.includes(0x00);
    const sampleText = buffer.subarray(0, 2048).toString("utf8");
    const looksLikeHtmlOrSvg = /<\s*(?:!doctype|html|script|svg|iframe)\b/i.test(
      sampleText,
    );
    if (!hasNull && !looksLikeHtmlOrSvg) {
      detectedMime = lower.endsWith(".md") ? "text/markdown" : "text/plain";
    }
  }

  if (!detectedMime) {
    throw new Error(
      "Unsupported or invalid file format. Allowed formats: PDF, PNG, JPEG, WebP, DOCX, TXT, and Markdown (.md).",
    );
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    mimeType: detectedMime,
    sizeBytes: buffer.length,
    sha256,
    sanitizedFilename,
  };
}

function getStorageRoot(): string {
  return resolve(/*turbopackIgnore: true*/ process.cwd(), "storage/documents");
}

function resolveSafeStoragePath(storageKey: string): string {
  const root = getStorageRoot();
  const cleaned = storageKey.replace(/^\/+/, "");
  if (cleaned.includes("..")) {
    throw new Error("Invalid storage key.");
  }
  const full = resolve(/*turbopackIgnore: true*/ root, cleaned);
  if (!full.startsWith(root)) {
    throw new Error("Storage path traversal blocked.");
  }
  return full;
}

export function writeDocumentFile(params: {
  userId: string;
  mimeType: AllowedDocumentMime;
  buffer: Buffer;
}): string {
  const ext = EXT_FOR_MIME[params.mimeType];
  const safeUserDir = params.userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storageKey = `${safeUserDir}/${randomUUID()}.${ext}`;
  const fullPath = resolveSafeStoragePath(storageKey);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, params.buffer);
  return storageKey;
}

export function readDocumentFile(storageKey: string): Buffer | null {
  const fullPath = resolveSafeStoragePath(storageKey);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath);
}

export function deleteDocumentFile(storageKey: string | null | undefined): void {
  if (!storageKey) return;
  try {
    const fullPath = resolveSafeStoragePath(storageKey);
    rmSync(fullPath, { force: true });
  } catch {
    // Ignore missing file on cleanup
  }
}
