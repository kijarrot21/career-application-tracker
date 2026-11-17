import { inflateRawSync, inflateSync } from "node:zlib";
import { validateDocumentBuffer, type AllowedDocumentMime } from "@/lib/storage";

export class UnsupportedDocumentFormatError extends Error {
  readonly mimeType?: string;

  constructor(message: string, mimeType?: string) {
    super(message);
    this.name = "UnsupportedDocumentFormatError";
    this.mimeType = mimeType;
  }
}

export interface ExtractedDocumentText {
  text: string;
  mimeType: AllowedDocumentMime;
  extractionMethod: "plain_utf8" | "docx_xml" | "pdf_text_stream";
  sizeBytes: number;
  sha256: string;
  sanitizedFilename: string;
  characterCount: number;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );
}

/**
 * Minimal pure-Node ZIP entry reader supporting Store (0) and Deflate (8)
 * compression using End-of-Central-Directory + Central Directory records.
 */
function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  // Locate End of Central Directory (PK\x05\x06) scanning backwards
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new UnsupportedDocumentFormatError(
      "Corrupted DOCX archive: ZIP End-of-Central-Directory record missing.",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries && cdOffset + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) {
      break;
    }
    const compressionMethod = buffer.readUInt16LE(cdOffset + 10);
    const compressedSize = buffer.readUInt32LE(cdOffset + 20);
    const fileNameLen = buffer.readUInt16LE(cdOffset + 28);
    const extraLen = buffer.readUInt16LE(cdOffset + 30);
    const commentLen = buffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(cdOffset + 42);

    const fileName = buffer
      .subarray(cdOffset + 46, cdOffset + 46 + fileNameLen)
      .toString("utf8");
    cdOffset += 46 + fileNameLen + extraLen + commentLen;

    if (
      localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
    ) {
      continue;
    }

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) continue;

    const compressedSlice = buffer.subarray(dataStart, dataEnd);
    if (compressionMethod === 0) {
      entries.set(fileName, compressedSlice);
    } else if (compressionMethod === 8) {
      try {
        entries.set(fileName, inflateRawSync(compressedSlice));
      } catch {
        // Ignore corrupted optional entries
      }
    }
  }

  return entries;
}

function extractTextFromWordXml(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t");

  const segments: string[] = [];
  let cursor = 0;
  while (cursor < withBreaks.length) {
    const nextNewline = withBreaks.indexOf("\n", cursor);
    const lineEnd = nextNewline === -1 ? withBreaks.length : nextNewline;
    const line = withBreaks.slice(cursor, lineEnd);

    const textMatches = [...line.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
    if (textMatches.length > 0) {
      const joined = textMatches
        .map((m) => decodeXmlEntities(m[1]))
        .join("");
      segments.push(joined);
    } else if (line.includes("\t")) {
      segments.push("");
    }
    cursor = lineEnd + 1;
  }

  return segments
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTextFromDocxBuffer(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const docXml = entries.get("word/document.xml");
  if (!docXml) {
    throw new UnsupportedDocumentFormatError(
      "Invalid DOCX file: missing word/document.xml.",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }

  const orderedXmlNames = [
    ...Array.from(entries.keys())
      .filter((k) => /^word\/header\d*\.xml$/i.test(k))
      .sort(),
    "word/document.xml",
    ...Array.from(entries.keys())
      .filter((k) => /^word\/footer\d*\.xml$/i.test(k))
      .sort(),
  ];

  const blocks: string[] = [];
  for (const name of orderedXmlNames) {
    const xmlBuf = entries.get(name);
    if (!xmlBuf) continue;
    const text = extractTextFromWordXml(xmlBuf.toString("utf8"));
    if (text) blocks.push(text);
  }

  const combined = blocks.join("\n\n").trim();
  if (!combined) {
    throw new UnsupportedDocumentFormatError(
      "No readable text was found inside the DOCX file.",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }
  return combined;
}

function unescapePdfString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    i++;
    if (i >= raw.length) break;
    const esc = raw[i];
    switch (esc) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        out += esc;
        break;
      case "\n":
      case "\r":
        break;
      default: {
        if (/[0-7]/.test(esc)) {
          let oct = esc;
          if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
          if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += esc;
        }
      }
    }
  }
  return out;
}

function decodePdfLiteralStrings(content: string): string[] {
  const lines: string[] = [];
  const btBlocks = [...content.matchAll(/BT([\s\S]*?)ET/g)];
  const targets = btBlocks.length > 0 ? btBlocks.map((m) => m[1]) : [content];

  for (const block of targets) {
    let currentLine = "";
    let i = 0;
    while (i < block.length) {
      if (block[i] === "(") {
        let depth = 1;
        let literal = "";
        i++;
        while (i < block.length && depth > 0) {
          const c = block[i];
          if (c === "\\") {
            literal += c + (block[i + 1] ?? "");
            i += 2;
            continue;
          }
          if (c === "(") depth++;
          else if (c === ")") depth--;
          if (depth > 0) literal += c;
          i++;
        }
        const decoded = unescapePdfString(literal);
        if (decoded) currentLine += decoded;
      } else if (
        block.startsWith("Td", i) ||
        block.startsWith("TD", i) ||
        block.startsWith("T*", i) ||
        block.startsWith("'\n", i)
      ) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = "";
        }
        i += 2;
      } else {
        i++;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }
  return lines;
}

export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const rawLatin = buffer.toString("latin1");
  if (!rawLatin.startsWith("%PDF-")) {
    throw new UnsupportedDocumentFormatError(
      "Invalid PDF header.",
      "application/pdf",
    );
  }

  const collectedLines: string[] = [];

  // Scan stream ... endstream sections, decompressing FlateDecode where present
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;
  let foundStreams = false;

  while ((match = streamRegex.exec(rawLatin)) !== null) {
    foundStreams = true;
    const dictStart = Math.max(0, match.index - 280);
    const dictSlice = rawLatin.slice(dictStart, match.index);
    const isFlate = /\/FlateDecode\b/.test(dictSlice);

    const streamStart =
      rawLatin.indexOf("\n", match.index) + 1;
    const rawEnd = match.index + match[0].length - "endstream".length;
    const trimmedEnd =
      rawLatin[rawEnd - 1] === "\n"
        ? rawLatin[rawEnd - 2] === "\r"
          ? rawEnd - 2
          : rawEnd - 1
        : rawEnd;

    if (trimmedEnd <= streamStart) continue;
    const streamBytes = buffer.subarray(streamStart, trimmedEnd);

    let decodedContent = "";
    if (isFlate) {
      try {
        decodedContent = inflateSync(streamBytes).toString("latin1");
      } catch {
        continue;
      }
    } else {
      decodedContent = streamBytes.toString("latin1");
    }

    const lines = decodePdfLiteralStrings(decodedContent);
    collectedLines.push(...lines);
  }

  if (!foundStreams) {
    collectedLines.push(...decodePdfLiteralStrings(rawLatin));
  }

  const cleaned = collectedLines
    .join("\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    throw new UnsupportedDocumentFormatError(
      "No extractable text layer found in PDF (scanned/image-only PDFs require OCR or pasting extracted text).",
      "application/pdf",
    );
  }

  return cleaned;
}

/**
 * Validates file magic bytes & extracts readable text from PDF, DOCX, TXT, or MD
 * CV uploads and stored document versions. Rejects image/unsupported formats cleanly.
 */
export function extractTextFromDocumentBuffer(
  buffer: Buffer,
  filename: string,
): ExtractedDocumentText {
  const validated = validateDocumentBuffer(buffer, filename);

  switch (validated.mimeType) {
    case "text/plain":
    case "text/markdown": {
      const text = buffer.toString("utf8").trim();
      if (!text) {
        throw new UnsupportedDocumentFormatError(
          "Document file contains no readable text.",
          validated.mimeType,
        );
      }
      return {
        ...validated,
        text,
        extractionMethod: "plain_utf8",
        characterCount: text.length,
      };
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const text = extractTextFromDocxBuffer(buffer);
      return {
        ...validated,
        text,
        extractionMethod: "docx_xml",
        characterCount: text.length,
      };
    }

    case "application/pdf": {
      const text = extractTextFromPdfBuffer(buffer);
      return {
        ...validated,
        text,
        extractionMethod: "pdf_text_stream",
        characterCount: text.length,
      };
    }

    default:
      throw new UnsupportedDocumentFormatError(
        `Unsupported document format for AI text extraction (${validated.mimeType}). Supported formats: PDF, DOCX, TXT, Markdown (.md).`,
        validated.mimeType,
      );
  }
}
