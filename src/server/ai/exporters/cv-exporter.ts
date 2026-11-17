import { deflateRawSync } from "node:zlib";
import { getMessages } from "@/lib/i18n";
import type { AiCvGenerationResult } from "../schemas";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeAsciiForPdf(text: string): string {
  return text
    .replace(/[•–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\r/g, "");
}

function escapePdfLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface CvSectionBlock {
  heading: string;
  lines: string[];
}

function buildStructuredCvSections(cv: AiCvGenerationResult): {
  title: string;
  subtitle: string;
  contactLine: string;
  sections: CvSectionBlock[];
} {
  const isIndo = cv.cvFormat === "indonesian_cv";
  const headings = getMessages(isIndo ? "id-ID" : "en-US").cv.sections;

  const sections: CvSectionBlock[] = [];

  if (cv.tailoredSummary) {
    sections.push({
      heading: headings.summary,
      lines: [cv.tailoredSummary],
    });
  }

  const orderedByTemplate: CvSectionBlock[] = [];

  const experienceBlock: CvSectionBlock | null =
    cv.highlightedExperiences.length > 0
      ? {
          heading: headings.experience,
          lines: cv.highlightedExperiences.flatMap((exp) => [
            `${exp.jobTitle} - ${exp.companyName}${exp.periodLabel ? ` (${exp.periodLabel})` : ""}${exp.location ? ` | ${exp.location}` : ""}`,
            ...exp.relevantBullets.map((b) => `- ${b}`),
          ]),
        }
      : null;

  const projectBlock: CvSectionBlock | null =
    cv.projects.length > 0
      ? {
          heading: headings.projects,
          lines: cv.projects.flatMap((p) => [
            `${p.name}${p.role ? ` - ${p.role}` : ""}${p.organization ? ` (${p.organization})` : ""}`,
            ...p.bullets.map((b) => `- ${b}`),
            ...(p.technologies.length > 0
              ? [`${headings.technologiesPrefix}: ${p.technologies.join(", ")}`]
              : []),
          ]),
        }
      : null;

  const skillsBlock: CvSectionBlock | null =
    cv.prioritizedSkills.length > 0
      ? {
          heading: headings.skills,
          lines: [cv.prioritizedSkills.join(" | ")],
        }
      : null;

  const eduBlock: CvSectionBlock | null =
    cv.educations.length > 0
      ? {
          heading: headings.education,
          lines: cv.educations.map(
            (ed) =>
              `${ed.institution} - ${ed.qualificationLabel}${ed.fieldOfStudy ? `, ${ed.fieldOfStudy}` : ""}${ed.graduationYear ? ` (${ed.graduationYear})` : ""}`,
          ),
        }
      : null;

  const certBlock: CvSectionBlock | null =
    cv.certifications.length > 0
      ? {
          heading: headings.certifications,
          lines: cv.certifications.map(
            (c) =>
              `${c.name} - ${c.issuingOrganization}${c.issueDate ? ` (${c.issueDate})` : ""}`,
          ),
        }
      : null;

  const langBlock: CvSectionBlock | null =
    cv.spokenLanguages.length > 0
      ? {
          heading: headings.languages,
          lines: [cv.spokenLanguages.join(", ")],
        }
      : null;

  if (cv.templateStyle === "project_based") {
    if (projectBlock) orderedByTemplate.push(projectBlock);
    if (skillsBlock) orderedByTemplate.push(skillsBlock);
    if (experienceBlock) orderedByTemplate.push(experienceBlock);
    if (eduBlock) orderedByTemplate.push(eduBlock);
    if (certBlock) orderedByTemplate.push(certBlock);
    if (langBlock) orderedByTemplate.push(langBlock);
  } else if (cv.templateStyle === "technical") {
    if (skillsBlock) orderedByTemplate.push(skillsBlock);
    if (experienceBlock) orderedByTemplate.push(experienceBlock);
    if (projectBlock) orderedByTemplate.push(projectBlock);
    if (certBlock) orderedByTemplate.push(certBlock);
    if (eduBlock) orderedByTemplate.push(eduBlock);
    if (langBlock) orderedByTemplate.push(langBlock);
  } else {
    if (experienceBlock) orderedByTemplate.push(experienceBlock);
    if (skillsBlock) orderedByTemplate.push(skillsBlock);
    if (eduBlock) orderedByTemplate.push(eduBlock);
    if (projectBlock) orderedByTemplate.push(projectBlock);
    if (certBlock) orderedByTemplate.push(certBlock);
    if (langBlock) orderedByTemplate.push(langBlock);
  }

  sections.push(...orderedByTemplate);

  if (cv.coverLetterDraft) {
    sections.push({
      heading: headings.coverLetter,
      lines: cv.coverLetterDraft.split(/\n+/).filter(Boolean),
    });
  }

  return {
    title: cv.candidateName || cv.targetRole,
    subtitle: cv.tailoredHeadline,
    contactLine: cv.contactLine || "",
    sections,
  };
}

export function renderCvToPlainText(cv: AiCvGenerationResult): string {
  const doc = buildStructuredCvSections(cv);
  const out: string[] = [doc.title, doc.subtitle];
  if (doc.contactLine) out.push(doc.contactLine);
  out.push("");
  for (const sec of doc.sections) {
    out.push(sec.heading);
    out.push(...sec.lines);
    out.push("");
  }
  return out.join("\n").trim();
}

/**
 * Generates a standards-compliant multi-page PDF 1.4 buffer directly in Node.js
 * with clean margins, Helvetica/Helvetica-Bold fonts, and automatic wrapping.
 */
export function exportCvToPdfBuffer(cv: AiCvGenerationResult): Buffer {
  const doc = buildStructuredCvSections(cv);

  type PdfLine = { text: string; bold: boolean; size: number; spacingAfter: number };
  const layoutLines: PdfLine[] = [];

  layoutLines.push({
    text: normalizeAsciiForPdf(doc.title),
    bold: true,
    size: 16,
    spacingAfter: 6,
  });
  for (const wrapped of wrapLine(normalizeAsciiForPdf(doc.subtitle), 78)) {
    layoutLines.push({ text: wrapped, bold: true, size: 11, spacingAfter: 4 });
  }
  if (doc.contactLine) {
    for (const wrapped of wrapLine(normalizeAsciiForPdf(doc.contactLine), 90)) {
      layoutLines.push({
        text: wrapped,
        bold: false,
        size: 9.5,
        spacingAfter: 4,
      });
    }
  }
  layoutLines.push({ text: "", bold: false, size: 10, spacingAfter: 8 });

  for (const section of doc.sections) {
    layoutLines.push({
      text: normalizeAsciiForPdf(section.heading),
      bold: true,
      size: 11,
      spacingAfter: 5,
    });
    for (const rawLine of section.lines) {
      const wrappedList = wrapLine(normalizeAsciiForPdf(rawLine), 88);
      for (let i = 0; i < wrappedList.length; i++) {
        layoutLines.push({
          text: wrappedList[i],
          bold: false,
          size: 10,
          spacingAfter: i === wrappedList.length - 1 ? 5 : 3,
        });
      }
    }
    layoutLines.push({ text: "", bold: false, size: 10, spacingAfter: 6 });
  }

  // Paginate onto A4 (595 x 842 pt) pages
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 50;
  const topY = 792;
  const bottomY = 50;

  const pages: string[] = [];
  let cmds: string[] = [];
  let y = topY;

  for (const line of layoutLines) {
    const step = line.size + line.spacingAfter;
    if (y - step < bottomY && cmds.length > 0) {
      pages.push(cmds.join("\n"));
      cmds = [];
      y = topY;
    }
    if (line.text) {
      const fontKey = line.bold ? "/F2" : "/F1";
      cmds.push(
        `BT ${fontKey} ${line.size} Tf 1 0 0 1 ${marginX} ${y} Tm (${escapePdfLiteral(line.text)}) Tj ET`,
      );
    }
    y -= step;
  }
  if (cmds.length > 0 || pages.length === 0) {
    pages.push(cmds.join("\n"));
  }

  // Assemble PDF objects:
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, then pairs of Page + Content Stream
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const pageObjectIds: number[] = [];
  let nextObjId = 5;
  const pageObjects: string[] = [];

  for (const streamBody of pages) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageObjectIds.push(pageObjId);

    const contentBytes = Buffer.byteLength(streamBody, "latin1");
    pageObjects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`,
    );
    pageObjects.push(
      `${contentObjId} 0 obj\n<< /Length ${contentBytes} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    );
  }

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>\nendobj\n`,
  );
  objects.push(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );
  objects.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  );
  objects.push(...pageObjects);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

// ---------------------------------------------------------------------------
// Minimal Pure-Node OOXML (.docx) ZIP Writer
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipArchive(files: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const uncompressed = file.content;
    const compressed = deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // deflate
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function paragraphXml(
  text: string,
  options?: { bold?: boolean; sizeHalfPt?: number; spaceAfter?: number },
): string {
  const rPrParts: string[] = [];
  if (options?.bold) rPrParts.push("<w:b/>");
  if (options?.sizeHalfPt) {
    rPrParts.push(
      `<w:sz w:val="${options.sizeHalfPt}"/><w:szCs w:val="${options.sizeHalfPt}"/>`,
    );
  }
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
  const pPr =
    options?.spaceAfter != null
      ? `<w:pPr><w:spacing w:after="${options.spaceAfter}"/></w:pPr>`
      : "";
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Generates a valid OOXML `.docx` ZIP package containing the tailored CV.
 */
export function exportCvToDocxBuffer(cv: AiCvGenerationResult): Buffer {
  const doc = buildStructuredCvSections(cv);
  const paragraphs: string[] = [
    paragraphXml(doc.title, { bold: true, sizeHalfPt: 32, spaceAfter: 80 }),
    paragraphXml(doc.subtitle, { bold: true, sizeHalfPt: 22, spaceAfter: 80 }),
  ];
  if (doc.contactLine) {
    paragraphs.push(
      paragraphXml(doc.contactLine, { sizeHalfPt: 18, spaceAfter: 140 }),
    );
  }
  for (const section of doc.sections) {
    paragraphs.push(
      paragraphXml(section.heading, {
        bold: true,
        sizeHalfPt: 22,
        spaceAfter: 60,
      }),
    );
    for (const line of section.lines) {
      paragraphs.push(
        paragraphXml(line, { sizeHalfPt: 20, spaceAfter: 60 }),
      );
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n    ")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildZipArchive([
    {
      name: "[Content_Types].xml",
      content: Buffer.from(contentTypesXml, "utf8"),
    },
    { name: "_rels/.rels", content: Buffer.from(relsXml, "utf8") },
    { name: "word/document.xml", content: Buffer.from(documentXml, "utf8") },
  ]);
}
