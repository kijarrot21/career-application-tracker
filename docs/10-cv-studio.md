# 10. AI CV Studio (CV Correction, Generation and Non-Destructive Export)

**Phase:** 4: AI Career Features
**Status:** Correction, generation, native PDF/DOCX export, approval gate and version save COMPLETE. Live cloud AI NOT TESTED.
**Primary Route:** `/cv-studio`
**Export Endpoint:** `GET /api/ai/cv-studio/[analysisId]/export?format=pdf|docx|txt`

---

## 1. CV Studio Workspace (`/cv-studio`)

`src/components/cv-studio/cv-studio-client.tsx` (`CvStudioClient`) unifies four document intelligence workflows while respecting active AI Privacy Modes (`AiConsentDialog` confirmation when `ask_before_each` or cloud consent is required):

1. **CV Parser & Safe Import** (Feature A)
2. **10-Dimension CV Evaluation** (Feature B)
3. **Before/After CV Correction & Approval** (Feature D)
4. **Grounded CV Generator & PDF/DOCX Exporter** (Feature E)

---

## 2. Feature D: AI CV Correction (`cv-correction.service.ts`)

- **7 Improvement Dimensions (`CV_CORRECTION_CATEGORIES`):**
  - `grammar`
  - `professional_wording`
  - `achievement_improvement`
  - `readability`
  - `keyword_alignment`
  - `section_hierarchy`
  - `repetition_reduction`
- **Before-and-After Comparisons:** Every suggestion returns `originalText`, `suggestedText`, `section`, `reason`, and `groundedInProfileFact`.
- **Mandatory User Approval:** `applyApprovedCvCorrectionsService()` rejects empty selections, records `ai_feedback` (`accepted` or `partially_accepted`) plus `audit_logs`, and writes approved revisions ONLY to a preview draft or a **new `document_versions` row**: never overwriting original CV uploads or verified Master Career Profile records.

---

## 3. Feature E: AI CV Generator & Exporter (`cv-generator.service.ts`)

- **Formats (`CV_FORMATS`):**
  - `indonesian_cv`: Indonesian Curriculum Vitae conventions and Bahasa Indonesia section headings.
  - `international_resume`: Concise global resume format and English headings.
- **Templates (`CV_TEMPLATE_STYLES`):**
  - `ats_friendly` (standard chronological ATS ordering)
  - `professional`
  - `executive`
  - `technical` (skills prioritized ahead of experience & projects)
  - `project_based` (projects & skills prioritized ahead of experience)
- **Job-Specific Customization:** Accepts an optional `vacancyId` or manual `targetRole` + `customInstructions` while strictly citing verified Master Career Profile entities in `groundedCitationIds` and including `fabricationSelfCheck`.
- **Pure-Node PDF & DOCX Export (`src/server/ai/exporters/cv-exporter.ts`):**
  - `exportCvToPdfBuffer()`: Generates multi-page PDF 1.4 documents with A4 layout and automatic line wrapping.
  - `exportCvToDocxBuffer()`: Generates OOXML `.docx` ZIP packages (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) via Node's built-in `zlib`.
- **Non-Destructive Versioning (`saveGeneratedCvAsDocumentVersionService`):** Saves exported PDF/DOCX/TXT outputs through `uploadOrVersionDocumentService()`, creating a new `document_versions` row (`versionNo + 1`) and preserving all prior versions untouched.

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| 7-dimension CV correction with before/after comparison | COMPLETE | `src/server/ai/services/cv-correction.service.ts`, schema `src/server/ai/schemas/correction-result.schema.ts`. |
| Mandatory approval gate before applying corrections | COMPLETE | `applyApprovedCvCorrectionsService()` writes only to a preview draft or a new `document_versions` row. |
| Grounded CV generation, 2 formats and 5 template styles | COMPLETE | `src/server/ai/services/cv-generator.service.ts`, `CV_FORMATS` and `CV_TEMPLATE_STYLES` in `src/server/ai/schemas/correction-result.schema.ts`. |
| Native PDF and OOXML DOCX exporters, no third-party deps | COMPLETE | `src/server/ai/exporters/cv-exporter.ts` uses Node `zlib` for DOCX and hand-built PDF 1.4 output. |
| Non-destructive version save | COMPLETE | `saveGeneratedCvAsDocumentVersionService()` via `uploadOrVersionDocumentService()`. |
| Live cloud AI generation and correction | NOT TESTED | Verified with mocked providers only. No cloud credentials were available. |

## Test evidence

- Unit: `tests/unit/phase4-ai-career.test.ts` covers Indonesian CV and International Resume template ordering, export schemas and the non-hiring-probability guard. `tests/unit/phase4-storage.test.ts` covers document magic-byte validation and safe file storage.
- Integration: `tests/integration/ai-career-features.test.ts` covers the required approval gate for Feature D and saving generated PDF/DOCX output as new versions without overwriting originals for Feature E.
- Suite totals: 125/125 Vitest tests pass across 25 files, 4/4 Playwright E2E tests pass, typecheck, lint and build are green, and CI is green on commit `2a9540c`.
