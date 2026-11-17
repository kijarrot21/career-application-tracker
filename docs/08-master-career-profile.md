# 08. Master Career Profile

**Phase:** 2: Master Career Profile  
**Status:** Implemented  
**Primary Route:** `/profile`

---

## 1. Purpose & Grounding Guarantee

The **Master Career Profile** establishes a structured, user-verified database of professional history, education, skills, certifications, and projects. It acts as the single factual source of truth for suitability evaluation and future AI services (CV tailoring, cover letters, gap analysis, interview prep).

Core rules enforced:
1. **No Silent AI Overwrites:** Verified career records (`verificationStatus = 'verified'`) cannot be modified or overwritten by automated or AI calls (`VerifiedCareerDataProtectedError`).
2. **Staging-First CV Import:** CV import integrations stage proposed updates in `career_profiles.pending_review_payload`, allowing the user to inspect, edit, selectively apply, or discard changes without touching verified data until confirmed.
3. **Per-User Tenant Isolation:** All 6 tables carry `user_id` (`ON DELETE CASCADE`) and child tables enforce composite foreign keys `(profile_id, user_id) -> career_profiles(id, user_id)`.
4. **Direct Suitability Matching (`getProfileForSuitabilityScoring`):** `createVacancyService` (`src/server/services/vacancies.ts`) and `getVacancyDetail` (`src/server/queries/vacancies.ts`) read skills, experience years, highest education qualification, salary expectation, preferred locations, and preferred work arrangements directly from `career_profiles`, verified `career_skills`, and `career_educations` (falling back to `user_settings` only if the Master Career Profile has not yet been populated).

---

## 2. Database Schema (`src/db/schema/career.ts`, Migration `0002_pretty_cloak.sql`)

| Table | Purpose | Key Constraints |
|---|---|---|
| `career_profiles` | 1:1 user professional info, career preferences, and CV import staging | `UNIQUE(user_id)`, `UNIQUE(id, user_id)`, salary & experience `CHECK`s, nullable `source_document_version_id` (`ON DELETE SET NULL`) |
| `career_experiences` | Work history with responsibilities and measurable `achievements[]` | Composite FK to `career_profiles`, date & `is_current` `CHECK`, idx `(user_id, profile_id, start_date)` |
| `career_educations` | Academic institutions, `education_level`, degree title, field of study, graduation year | Composite FK to `career_profiles`, `graduation_year` `CHECK (1950..2100)` |
| `career_skills` | Categorized skills, proficiency, years, grounded `evidence`, and `is_user_verified` | Composite FK to `career_profiles`, `UNIQUE(profile_id, normalized_name)` (alias deduplication via `normalizeSkill`) |
| `career_certifications` | Licenses, issuing organizations, issue/expiration dates, credential ID/URL | Composite FK to `career_profiles`, `expiration_date >= issue_date` `CHECK` |
| `career_projects` | Portfolio/work projects, role, dates, `achievements[]`, `technologies[]`, URL | Composite FK to `career_profiles`, date & `is_ongoing` `CHECK` |

---

## 3. Modules & Functional Scope

1. **Professional Information:** Full name, headline, summary, email, phone/WhatsApp, LinkedIn/Portfolio/GitHub URLs, city/location, country (default `Indonesia`), preferred language (`id-ID`, `en-US`, `bilingual`), career level, total experience years.
2. **Career Preferences:** Target positions, target industries, preferred locations, work arrangements (`onsite`, `hybrid`, `remote`), salary currency (`IDR`, `USD`, etc.), min/max salary, period.
3. **Work Experience:** Multiple records, employment type, start/end dates, current employment status (`isCurrent` enforces `endDate = null`), responsibilities, measurable achievements.
4. **Education:** Multiple records, institution, qualification level, degree title, field of study, graduation year, GPA, notes.
5. **Skills:** Categorized skills (`technical`, `framework`, `tool`, `language`, `domain`, `soft_skill`, `methodology`, `other`), proficiency (`beginner`–`expert`), years, evidence, explicit user verification toggle.
6. **Certifications:** Multiple certifications with issuer, dates, credential ID, and verified `http(s)` credential URL.
7. **Projects:** Multiple projects with organization, role, dates/ongoing flag, description, measurable achievements, technologies, and URL.
8. **CV Import Integration Point:** `stageCvImportReviewService`, `applyCvImportReviewService`, and `discardCvImportReviewService` allow linking a CV version from `/documents` and staging structured drafts for explicit review before applying. (AI parsing is intentionally deferred to a future phase.)

---

## 4. UI & Navigation

- Added `Career Profile` (`/profile`) to `AppSidebar` (`src/components/layout/app-sidebar.tsx`), `CommandMenu`, and `src/proxy.ts`.
- Integrated `/settings` (`src/components/settings/settings-client.tsx`) by removing the Candidate Profile & Preferences section completely from Settings; `/settings` now manages only workspace locale (`timezone`, `currency`), `searchStatus`, pipeline stages, follow-up rules, suitability weights, sample data, and UU PDP account actions while all career data and matching originate from `/profile`.
- Built `/profile` (`src/app/(app)/profile/page.tsx`, `src/components/profile/career-profile-client.tsx`, `profile-sections-modals.tsx`, `cv-import-review-modal.tsx`) with:
  - Profile completeness progress bar & 7-section checklist (`computeProfileCompletion`)
  - Pending CV import review alert & interactive review/correction modal
  - Tabbed CRUD forms for all 7 profile modules
- Added `careerProfile` and all 5 child collections to UU PDP full JSON account export (`exportAccountJsonService` in `src/server/services/settings.ts`).
