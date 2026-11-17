import { describe, expect, it } from "vitest";
import {
  convertInstantToTimeZoneParts,
  formatDate,
  formatDateTime,
  formatDisplayCurrencyConversion,
  formatMoney,
  formatNumber,
  formatSalaryRange,
} from "@/lib/format";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  findMissingTranslationKeys,
  getDefaultCvFormatForLocale,
  getLocalizedArchiveOutcomeLabel,
  getLocalizedErrorMessage,
  getLocalizedOutcomeLabel,
  getLocalizedStageTypeLabel,
  getSupportedCurrencyOptions,
  isValidIsoCurrencyCode,
  MARKET_CONFIGS,
  MESSAGE_CATALOGS,
  normalizeLocale,
  toAiLocale,
  translate,
} from "@/lib/i18n";
import {
  exportCvToDocxBuffer,
  exportCvToPdfBuffer,
  renderCvToPlainText,
} from "@/server/ai/exporters/cv-exporter";
import type { AiCvGenerationResult } from "@/server/ai/schemas";

const SAMPLE_CV_BASE: Omit<AiCvGenerationResult, "cvFormat"> = {
  templateStyle: "ats_friendly",
  targetRole: "Backend Engineer",
  candidateName: "Budi Santoso",
  tailoredHeadline: "Backend Platform Engineer",
  contactLine: "budi@example.com | Jakarta, Indonesia",
  tailoredSummary:
    "Experienced Go and TypeScript engineer building payment systems.",
  highlightedExperiences: [
    {
      experienceId: "exp-1",
      companyName: "PT Nusantara Tech",
      jobTitle: "Senior Backend Engineer",
      periodLabel: "2023 - Sekarang",
      location: "Jakarta",
      relevantBullets: ["Built high-throughput ledger pipelines."],
    },
  ],
  prioritizedSkills: ["TypeScript", "PostgreSQL", "Go"],
  educations: [
    {
      institution: "Institut Teknologi Bandung",
      qualificationLabel: "S1",
      fieldOfStudy: "Teknik Informatika",
      graduationYear: 2020,
    },
  ],
  certifications: [],
  projects: [
    {
      name: "Hybrid ATS",
      role: "Architect",
      organization: "Open Source",
      bullets: ["Designed modular PGlite + Postgres sync."],
      technologies: ["Next.js", "PostgreSQL"],
    },
  ],
  spokenLanguages: ["Indonesian (Native)", "English (Fluent)"],
  groundedCitationIds: ["exp-1", "edu-1", "proj-1"],
  fabricationSelfCheck: "All facts strictly grounded in verified profile.",
};

describe("Phase 9 Unit — Localization & Global Readiness", () => {
  it("uses id-ID, IDR, and Asia/Jakarta defaults cleanly", () => {
    expect(DEFAULT_LOCALE).toBe("id-ID");
    expect(DEFAULT_CURRENCY).toBe("IDR");
    expect(DEFAULT_TIMEZONE).toBe("Asia/Jakarta");

    expect(normalizeLocale(undefined)).toBe("id-ID");
    expect(normalizeLocale("id")).toBe("id-ID");
    expect(normalizeLocale("en")).toBe("en-US");
    expect(normalizeLocale("en-GB")).toBe("en-US");
    expect(toAiLocale("id-ID")).toBe("id");
    expect(toAiLocale("en-US")).toBe("en");
    expect(getDefaultCvFormatForLocale("id-ID")).toBe("indonesian_cv");
    expect(getDefaultCvFormatForLocale("en-US")).toBe("international_resume");
    expect(MARKET_CONFIGS["id-ID"].defaultCurrency).toBe("IDR");
  });

  it("verifies 100% translation completeness across id-ID and en-US with zero missing keys", () => {
    const idDict = MESSAGE_CATALOGS["id-ID"] as unknown as Record<
      string,
      unknown
    >;
    const enDict = MESSAGE_CATALOGS["en-US"] as unknown as Record<
      string,
      unknown
    >;

    expect(findMissingTranslationKeys(enDict, idDict)).toEqual([]);
    expect(findMissingTranslationKeys(idDict, enDict)).toEqual([]);
  });

  it("detects missing translations cleanly and applies fallback safely", () => {
    const missingCalls: Array<{ locale: string; key: string }> = [];
    const resolved = translate("id-ID", "nonexistent.nested.key", {
      fallback: "Fallback Copy",
      onMissing: (loc, key) => missingCalls.push({ locale: loc, key }),
    });

    expect(resolved).toBe("Fallback Copy");
    expect(missingCalls).toEqual([
      { locale: "id-ID", key: "nonexistent.nested.key" },
    ]);
  });

  it("formats dates and converts timestamps accurately across Asia/Jakarta, New York, and UTC", () => {
    const utcInstant = "2026-06-15T20:30:00.000Z";

    const jakartaParts = convertInstantToTimeZoneParts(
      utcInstant,
      "Asia/Jakarta",
    );
    expect(jakartaParts).toEqual({
      year: 2026,
      month: 6,
      day: 16,
      hour: 3,
      minute: 30,
      timeZone: "Asia/Jakarta",
    });

    const nyParts = convertInstantToTimeZoneParts(
      utcInstant,
      "America/New_York",
    );
    expect(nyParts.year).toBe(2026);
    expect(nyParts.month).toBe(6);
    expect(nyParts.day).toBe(15);
    expect(nyParts.hour).toBe(16);

    const formattedId = formatDateTime(utcInstant, "Asia/Jakarta", "id-ID");
    const formattedEn = formatDateTime(utcInstant, "America/New_York", "en-US");
    expect(formattedId).toContain("16");
    expect(formattedEn).toContain("15");

    expect(formatDate(null, "Asia/Jakarta", "id-ID")).toBe("Belum diatur");
    expect(formatDate(null, "UTC", "en-US")).toBe("Not set");
  });

  it("formats currencies, numbers, salary ranges, and indicative display conversion cleanly", () => {
    const idrFormatted = formatMoney(15000000, "IDR", false, "id-ID");
    expect(idrFormatted).toContain("Rp");
    expect(idrFormatted).toContain("15.000.000");

    const usdFormatted = formatMoney(2500.5, "USD", false, "en-US");
    expect(usdFormatted).toContain("$2,500.50");

    expect(formatNumber(1234567, "id-ID")).toBe("1.234.567");
    expect(formatNumber(1234567, "en-US")).toBe("1,234,567");

    expect(formatSalaryRange(null, null, "IDR", "month", "id-ID")).toBe(
      "Tidak diungkapkan",
    );
    expect(formatSalaryRange(null, null, "USD", "year", "en-US")).toBe(
      "Undisclosed",
    );

    expect(isValidIsoCurrencyCode("SGD")).toBe(true);
    expect(isValidIsoCurrencyCode("CHF")).toBe(true);
    expect(isValidIsoCurrencyCode("INVALID")).toBe(false);
    expect(
      getSupportedCurrencyOptions("id-ID", [
        {
          code: "CHF",
          symbol: "CHF",
          nameId: "Franc Swiss",
          nameEn: "Swiss Franc",
          minorUnits: 2,
          defaultFormattingLocale: "en-US",
        },
      ]).some((c) => c.code === "CHF"),
    ).toBe(true);

    const preview = formatDisplayCurrencyConversion({
      amount: 16000000,
      sourceCurrency: "IDR",
      displayCurrency: "USD",
      exchangeRate: 1 / 16000,
      locale: "en-US",
    });
    expect(preview.isIndicativeDisplay).toBe(true);
    expect(preview.isFinancialSettlement).toBe(false);
    expect(preview.displayAmount).toBeCloseTo(1000);
    expect(preview.formattedDisplay).toContain("$1,000");
  });

  it("returns localized application statuses and validation/API error messages", () => {
    expect(getLocalizedOutcomeLabel("active", "id-ID")).toBe("Aktif");
    expect(getLocalizedOutcomeLabel("active", "en-US")).toBe("Active");
    expect(getLocalizedStageTypeLabel("interview", "id-ID")).toBe("Wawancara");
    expect(getLocalizedArchiveOutcomeLabel("rejected", "id-ID")).toBe("Ditolak");
    expect(getLocalizedErrorMessage("INSUFFICIENT_CREDITS", "id-ID")).toContain(
      "kredit",
    );
    expect(getLocalizedErrorMessage("INSUFFICIENT_CREDITS", "en-US")).toContain(
      "credit",
    );
  });

  it("exports distinct Indonesian CV and International Resume templates cleanly", () => {
    const indoText = renderCvToPlainText({
      ...SAMPLE_CV_BASE,
      cvFormat: "indonesian_cv",
    });
    expect(indoText).toContain("RINGKASAN PROFESIONAL");
    expect(indoText).toContain("PENGALAMAN KERJA");
    expect(indoText).toContain("Teknologi: Next.js, PostgreSQL");

    const intlText = renderCvToPlainText({
      ...SAMPLE_CV_BASE,
      cvFormat: "international_resume",
    });
    expect(intlText).toContain("PROFESSIONAL SUMMARY");
    expect(intlText).toContain("WORK EXPERIENCE");
    expect(intlText).toContain("Technologies: Next.js, PostgreSQL");

    const pdfBuf = exportCvToPdfBuffer({
      ...SAMPLE_CV_BASE,
      cvFormat: "indonesian_cv",
    });
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const docxBuf = exportCvToDocxBuffer({
      ...SAMPLE_CV_BASE,
      cvFormat: "international_resume",
    });
    expect(docxBuf.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
