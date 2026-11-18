# 18. Master Career Profile

**Phase:** 2: Master Career Profile
**Status:** Implemented (audit label: COMPLETE)
**Primary Route:** `/profile`

> **Audit status (2026-11-18):** Verified against `src/db/schema/career.ts`, `src/server/services/vacancies.ts`, `src/server/queries/vacancies.ts`, `src/server/services/settings.ts`, the `/profile` components, and the passing test suite. Status labels: **COMPLETE**, **PARTIAL**, **BLOCKED**, **NOT TESTED**, **NOT IMPLEMENTED**. The database schema, verified data protections, per user tenant isolation, and UU PDP export integration are COMPLETE. AI parsing of CV imports is NOT IMPLEMENTED (deferred).

---

## 1. Purpose and Grounding Guarantee

The **Master Career Profile** establishes a structured, user verified database of professional history, education, skills, certifications, and projects. It acts as the single factual source of truth for suitability evaluation and future AI services (CV tailoring, cover letters, gap analysis, interview prep).

Core rules enforced:

1. **No Silent AI Overwrites:** Verified career records (`verificationStatus = 'verified'`) cannot be modified or overwritten by automated or AI calls (`VerifiedCareerDataProtectedError`). **COMPLETE.**
2. **Staging First CV Import:** CV import integrations stage proposed updates in `career_profiles.pending_review_payload`, allowing the user to inspect, edit, selectively apply, or discard changes without touching verified data until confirmed. **COMPLETE.**
3. **Per User Tenant Isolation:** All 6 tables carry `user_id` (`ON DELETE CASCADE`) and child tables enforce composite foreign keys `(profile_id, user_id) -> career_profiles(id, user_id)`. **COMPLETE.** Database RLS is not part of this module (see DEF-11-006 in `docs/14-security-and-data-governance.md`).
4. **Direct Suitability Matching (`getProfileForSuitabilityScoring`):** `createVacancyService` (`src/server/services/vacancies.ts`) and `getVacancyDetail` (`src/server/queries/vacancies.ts`) read skills, experience years, highest education qualification, salary expectation, preferred locations, and preferred work arrangements directly from `career_profiles`, verified `career_skills`, and `career_educations` (falling back to `user_settings` only if the Master Career Profile has not yet been populated). **COMPLETE.**

---

## 2. Database Schema (`src/db/schema/career.ts`, Migration `0002_pretty_cloak.sql`)

| Table | Purpose | Key Constraints |
|---|---|---|
| `career_profiles` | 1:1 user professional info, career preferences, and CV import staging | `UNIQUE(user_id)`, `UNIQUE(id, user_id)`, salary and experience `CHECK`s, nullable `source_document_version_id` (`ON DELETE SET NULL`) |
| `career_experiences` | Work history with responsibilities and measurable `achievements[]` | Composite FK to `career_profiles`, date and `is_current` `CHECK`, idx `(user_id, profile_id, start_date)` |
| `career_educations` | Academic institutions, `education_level`, degree title, field of study, graduation year | Composite FK to `career_profiles`, `graduation_year` `CHECK (1950..2100)` |
| `career_skills` | Categorized skills, proficiency, years, grounded `evidence`, and `is_user_verified` | Composite FK to `career_profiles`, `UNIQUE(profile_id, normalized_name)` (alias deduplication via `normalizeSkill`) |
| `career_certifications` | Licenses, issuing organizations, issue and expiration dates, credential ID or URL | Composite FK to `career_profiles`, `expiration_date >= issue_date` `CHECK` |
| `career_projects` | Portfolio or work projects, role, dates, `achievements[]`, `technologies[]`, URL | Composite FK to `career_profiles`, date and `is_ongoing` `CHECK` |

**Status: COMPLETE.**

---

## 3. Modules and Functional Scope

1. **Professional Information:** Full name, headline, summary, email, phone or WhatsApp, LinkedIn or Portfolio or GitHub URLs, city or location, country (default `Indonesia`), preferred language (`id-ID`, `en-US`, `bilingual`), career level, total experience years.
2. **Career Preferences:** Target positions, target industries, preferred locations, work arrangements (`onsite`, `hybrid`, `remote`), salary currency (`IDR`, `USD`, etc.), min and max salary, period.
3. **Work Experience:** Multiple records, employment type, start and end dates, current employment status (`isCurrent` enforces `endDate = null`), responsibilities, measurable achievements.
4. **Education:** Multiple records, institution, qualification level, degree title, field of study, graduation year, GPA, notes.
5. **Skills:** Categorized skills (`technical`, `framework`, `tool`, `language`, `domain`, `soft_skill`, `methodology`, `other`), proficiency (`beginner` to `expert`), years, evidence, explicit user verification toggle.
6. **Certifications:** Multiple certifications with issuer, dates, credential ID, and verified `http(s)` credential URL.
7. **Projects:** Multiple projects with organization, role, dates or ongoing flag, description, measurable achievements, technologies, and URL.
8. **CV Import Integration Point:** `stageCvImportReviewService`, `applyCvImportReviewService`, and `discardCvImportReviewService` allow linking a CV version from `/documents` and staging structured drafts for explicit review before applying. AI parsing is intentionally deferred to a future phase (**NOT IMPLEMENTED**).

**Status: COMPLETE** for modules 1 to 7 and the staging flow; **NOT IMPLEMENTED** for AI parsing of CV imports.

---

## 4. UI and Navigation

- Added `Career Profile` (`/profile`) to `AppSidebar` (`src/components/layout/app-sidebar.tsx`), `CommandMenu`, and `src/proxy.ts`.
- Integrated `/settings` (`src/components/settings/settings-client.tsx`) by removing the Candidate Profile and Preferences section completely from Settings; `/settings` now manages only workspace locale (`timezone`, `currency`), `searchStatus`, pipeline stages, follow up rules, suitability weights, sample data, and UU PDP account actions while all career data and matching originate from `/profile`.
- Built `/profile` (`src/app/(app)/profile/page.tsx`, `src/components/profile/career-profile-client.tsx`, `profile-sections-modals.tsx`, `cv-import-review-modal.tsx`) with:
  - Profile completeness progress bar and 7 section checklist (`computeProfileCompletion`)
  - Pending CV import review alert and interactive review and correction modal
  - Tabbed CRUD forms for all 7 profile modules
- Added `careerProfile` and all 5 child collections to UU PDP full JSON account export (`exportAccountJsonService` in `src/server/services/settings.ts`).

**Status: COMPLETE.**

---

## 5. Verification Notes

- The profile routes and forms are covered by the passing Vitest and Playwright suite (125/125 unit and integration tests, 4/4 E2E tests at time of audit).
- Verified record protection is enforced in application code; no automated or AI path overwrites a `verified` record.
- Live AI provider execution against career data is **BLOCKED / NOT TESTED** in this environment (no keys consumed). Consent gating is implemented and tested as a contract.
