# 10. AI Career Intelligence

**Phase:** 4 — AI Career Features  
**Status:** Implemented (Backend Services, Schemas, UI Panels, Automated Tests)  
**Routes:** `/cv-studio`, `/jobs/[id]`, `/profile` (Career Roadmap tab)

---

## 1. Overview & Grounding Rules

Phase 4 builds user-facing Career Intelligence services directly on top of the **Phase 3 Hybrid AI Engine** (`src/server/ai/`) and the **Phase 2 Master Career Profile** (`src/server/queries/career-profile.ts`):

1. **Provider-Independent & Privacy-Respecting:** Every call flows through `executeAiTask()` (`src/server/ai/router/ai-task-router.ts`), honoring `local_only`, `cloud_allowed`, and `ask_before_each` privacy modes and pausing at `awaiting_consent` when explicit consent is needed.
2. **Source Traceability:** All inputs (`career_profile`, `document_version`, `job_vacancy`, `application`, `raw_text`) are hashed and persisted in `ai_analysis_sources`.
3. **No Fabrication & No Overwrites:** Verified career tables are never modified silently by AI outputs. Analyses reside in `ai_career_analyses` and require explicit user confirmation before staging or applying changes.

---

## 2. Feature A — AI CV Parser

**Service:** `src/server/ai/services/cv-parser.service.ts`  
**Extractor:** `src/server/ai/extractors/document-text-extractor.ts`  
**Endpoint:** `POST /api/ai/cv-parse`  
**Schema:** `src/server/ai/schemas/cv-data.schema.ts` (`cvDataSchema`)

### Supported Formats & Capabilities
- **Formats:** PDF (`%PDF-` including uncompressed and `/FlateDecode` streams), DOCX (OOXML ZIP `word/document.xml`, headers/footers), `.txt`, `.md`, and raw text. Non-text binaries (e.g. PNG/JPEG or image-only scanned PDFs without a text layer) raise `UnsupportedDocumentFormatError` (HTTP `400`).
- **Extracted Sections:** Personal information, education, work experience, skills, certifications, projects, achievements, and spoken languages.
- **Uncertain Field Flagging:** Incomplete or ambiguous dates, credentials, or fields are listed in `uncertainFields` (`section`, `fieldPath`, `extractedValue`, `reason`) for manual verification. Missing values remain `null`.
- **Safe Staging Workflow:** `stageAiParsedCvToProfileService()` stages extracted sections into `career_profiles.pending_review_payload` for review on `/profile`, leaving all verified records intact.

---

## 3. Feature B — AI CV Evaluation

**Service:** `src/server/ai/services/cv-evaluator.service.ts`  
**Schema:** `src/server/ai/schemas/cv-analysis.schema.ts` (`cvEvaluationSchema`)

Evaluates an uploaded/stored CV version and/or verified Master Career Profile across **10 required criteria** (`CV_EVALUATION_CATEGORIES`):
1. `cv_structure`
2. `professional_summary`
3. `experience_relevance`
4. `achievement_quality`
5. `technical_skills`
6. `education`
7. `certifications`
8. `keyword_relevance`
9. `readability`
10. `ats_compatibility`

Returns `overallScore` (`0–100`), `categoryScores`, grounded `evidence`, `weaknesses`, `recommendations`, and `priorityActions`. Both the system prompts (`en` and `id`) and `cvEvaluationSchema.scoreDisclaimer` prohibit describing the evaluation score as a hiring probability.

---

## 4. Feature C — AI Job Matching

**Service:** `src/server/ai/services/job-matcher.service.ts`  
**Schema:** `src/server/ai/schemas/job-match.schema.ts` (`jobMatchSchema`)  
**UI Panel:** `src/components/jobs/job-match-ai-panel.tsx` on `/jobs/[id]`

Compares **both** the verified Master Career Profile and an optional selected `document_versions` CV (with binary PDF/DOCX/TXT extraction) against an untrusted `job_vacancies` description (wrapped in `<untrusted_data>` delimiters). Returns `overallMatchScore`, `matchingSkills`, `missingSkills`, `qualificationGaps`, `transferableSkills`, `recommendations`, and tailored pitch points.

---

## 5. Feature F — AI Career Roadmap

**Service:** `src/server/ai/services/career-roadmap.service.ts`  
**Schema:** `src/server/ai/schemas/career-roadmap.schema.ts` (`careerRoadmapSchema`)  
**UI Panel:** `src/components/profile/career-roadmap-panel.tsx` inside `/profile` (`AI Career Roadmap` tab)

Analyzes verified profile info, skills, experiences, career preferences, and factual application history (`loadApplicationHistoryContext` covering `applications`, `application_closure_records`, and `interviews`). Produces `careerStrengths`, `developmentGaps`, `targetRoles`, `recommendedSkills`, `learningPriorities`, `recommendedCertifications`, `sixMonthPlan`, and `twelveMonthPlan`.

- **Verified Facts vs. AI Inferences:** Outputs strictly separate `verifiedFacts` from advisory `aiInferences`.
- **Rejection Honesty Guarantee:** Employer rejection reasons are cited only when explicitly documented in closure notes or interview feedback; unrecorded rejection reasons are never fabricated.
