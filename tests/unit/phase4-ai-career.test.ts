import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  exportCvToDocxBuffer,
  exportCvToPdfBuffer,
  renderCvToPlainText,
} from "@/server/ai/exporters/cv-exporter";
import {
  UnsupportedDocumentFormatError,
  extractTextFromDocumentBuffer,
  extractTextFromDocxBuffer,
  extractTextFromPdfBuffer,
} from "@/server/ai/extractors/document-text-extractor";
import {
  CV_EVALUATION_CATEGORIES,
  correctionResultSchema,
  cvDataSchema,
  cvEvaluationSchema,
  cvGenerationSchema,
} from "@/server/ai/schemas";

function buildTestPdfBuffer(text: string, compressed: boolean): Buffer {
  const streamContent = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const streamBytes = compressed
    ? deflateSync(Buffer.from(streamContent, "latin1"))
    : Buffer.from(streamContent, "latin1");
  const filterPart = compressed ? " /Filter /FlateDecode" : "";
  const header = `%PDF-1.4\n1 0 obj\n<< /Length ${streamBytes.length}${filterPart} >>\nstream\n`;
  const footer = "\nendstream\nendobj\n%%EOF\n";
  return Buffer.concat([
    Buffer.from(header, "latin1"),
    streamBytes,
    Buffer.from(footer, "latin1"),
  ]);
}

describe("Phase 4 AI Career Features unit tests - binary extractors, exporters & schemas", () => {
  it("extracts text cleanly from generated DOCX, TXT/MD, uncompressed PDF, and FlateDecode PDF buffers", () => {
    const sampleCv = cvGenerationSchema.parse({
      cvFormat: "international_resume",
      templateStyle: "ats_friendly",
      targetRole: "Backend Engineer",
      candidateName: "Budi Santoso",
      contactLine: "Jakarta, Indonesia | budi@example.com",
      tailoredHeadline: "Senior Backend Engineer (Go & PostgreSQL)",
      tailoredSummary: "Built resilient payment settlement services in Indonesia.",
      highlightedExperiences: [
        {
          companyName: "PT Pay Indonesia",
          jobTitle: "Backend Engineer",
          periodLabel: "2022 - Present",
          relevantBullets: ["Reduced API p99 latency by 35%"],
        },
      ],
      prioritizedSkills: ["Go", "PostgreSQL", "Docker"],
      educations: [
        {
          institution: "Institut Teknologi Bandung",
          qualificationLabel: "S1 Teknik Informatika",
          graduationYear: 2019,
        },
      ],
      projects: [],
      certifications: [],
      spokenLanguages: ["Indonesian", "English"],
      groundedCitationIds: ["exp-1"],
      fabricationSelfCheck: "All details verified against Master Career Profile.",
    });

    // Real DOCX ZIP round-trip
    const docxBuffer = exportCvToDocxBuffer(sampleCv);
    const extractedDocx = extractTextFromDocumentBuffer(docxBuffer, "budi-cv.docx");
    expect(extractedDocx.extractionMethod).toBe("docx_xml");
    expect(extractedDocx.text).toContain("Budi Santoso");
    expect(extractedDocx.text).toContain("PT Pay Indonesia");
    expect(extractedDocx.text).toContain("Reduced API p99 latency by 35%");

    // Plain uncompressed & FlateDecode PDF extraction
    const plainPdf = buildTestPdfBuffer("Alice Pratama Senior Engineer Go PostgreSQL", false);
    expect(extractTextFromPdfBuffer(plainPdf)).toContain("Alice Pratama");

    const flatePdf = buildTestPdfBuffer("Siti Rahma Backend Lead TypeScript", true);
    const flateRes = extractTextFromDocumentBuffer(flatePdf, "siti.pdf");
    expect(flateRes.extractionMethod).toBe("pdf_text_stream");
    expect(flateRes.text).toContain("Siti Rahma Backend Lead TypeScript");

    // Generated PDF buffer validity check
    const generatedPdf = exportCvToPdfBuffer(sampleCv);
    const pdfLatin = generatedPdf.toString("latin1");
    expect(pdfLatin.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfLatin).toContain("%%EOF");
    expect(extractTextFromPdfBuffer(generatedPdf)).toContain("Budi Santoso");
  });

  it("rejects unsupported image formats, scanned image-only PDFs, corrupted headers, and HTML disguised as text", () => {
    // Valid PNG magic bytes -> supported upload for Document Vault, NOT supported for AI text extraction
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(() => extractTextFromDocumentBuffer(pngBuf, "scan.png")).toThrow(
      UnsupportedDocumentFormatError,
    );

    // Scanned image-only PDF (valid PDF header but no BT/ET text operators)
    const emptyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", "latin1");
    expect(() => extractTextFromDocumentBuffer(emptyPdf, "scanned.pdf")).toThrow(
      UnsupportedDocumentFormatError,
    );

    // Corrupted DOCX ZIP
    const fakeDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(() => extractTextFromDocxBuffer(fakeDocx)).toThrow(
      UnsupportedDocumentFormatError,
    );

    // HTML disguised as .txt
    const htmlTxt = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    expect(() => extractTextFromDocumentBuffer(htmlTxt, "evil.txt")).toThrow(
      /Unsupported or invalid file format/,
    );
  });

  it("supports Indonesian CV & International Resume template ordering and validates non-hiring-probability guard", () => {
    const indoProjectCv = cvGenerationSchema.parse({
      cvFormat: "indonesian_cv",
      templateStyle: "project_based",
      targetRole: "Frontend Architect",
      candidateName: "Dewi Lestari",
      tailoredHeadline: "Frontend Architect - React & Design Systems",
      tailoredSummary: "Memimpin pengembangan sistem desain lintas tim.",
      highlightedExperiences: [
        {
          companyName: "PT Karya Digital",
          jobTitle: "Lead Frontend",
          relevantBullets: ["Mempercepat build aplikasi 45%"],
        },
      ],
      prioritizedSkills: ["React", "TypeScript"],
      educations: [],
      projects: [
        {
          name: "Design System v2",
          role: "Lead Maintainer",
          bullets: ["Digunakan oleh 12 squad produk"],
          technologies: ["React", "Tailwind"],
        },
      ],
      certifications: [],
      spokenLanguages: ["Bahasa Indonesia", "English"],
      groundedCitationIds: ["proj-1"],
      fabricationSelfCheck: "Hanya menggunakan data terverifikasi.",
    });

    const rendered = renderCvToPlainText(indoProjectCv);
    expect(rendered).toContain("RINGKASAN PROFESIONAL");
    expect(rendered).toContain("PROYEK TERKAIT");
    expect(rendered.indexOf("PROYEK TERKAIT")).toBeLessThan(
      rendered.indexOf("PENGALAMAN KERJA"),
    );

    // Hiring probability phrase must be rejected by scoreDisclaimer refinement
    const badEval = cvEvaluationSchema.safeParse({
      overallScore: 82,
      scoreDisclaimer: "Your hiring probability is 82%.",
      summary: "Strong CV",
    });
    expect(badEval.success).toBe(false);

    // All 10 categories accepted cleanly
    const goodEval = cvEvaluationSchema.safeParse({
      overallScore: 82,
      summary: "Strong CV clarity.",
      categoryScores: CV_EVALUATION_CATEGORIES.map((category) => ({
        category,
        score: 82,
        evidence: "Verified profile evidence.",
        feedback: "Solid alignment.",
      })),
    });
    expect(goodEval.success).toBe(true);

    // Uncertain fields & 7 correction categories validate
    expect(
      cvDataSchema.safeParse({
        profile: { fullName: "Dewi" },
        uncertainFields: [
          {
            section: "experiences",
            fieldPath: "experiences[0].endDate",
            extractedValue: "2023",
            reason: "Month omitted in original PDF; needs user verification.",
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      correctionResultSchema.safeParse({
        overallScore: 79,
        summary: "Actionable wording edits.",
        suggestions: [
          {
            section: "experience_bullet",
            originalText: "Responsible for backend APIs",
            suggestedText: "Engineered payment APIs serving 50k daily requests",
            reason: "Stronger verb and verified scale.",
            category: "achievement_improvement",
            groundedInProfileFact: "Experience metric from PT Karya Digital",
          },
        ],
      }).success,
    ).toBe(true);
  });
});
