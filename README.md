# Career Application Tracker (Personal ATS)

[![CI](https://github.com/kijarrot21/career-application-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/kijarrot21/career-application-tracker/actions/workflows/ci.yml)

**Career Application Tracker** is a web-based **Personal Applicant Tracking System (ATS)** built to help job seekers manage their entire job search in a structured way. It covers the full cycle: discovering and evaluating job fit, tracking applications through a 13-stage HR pipeline, scheduling interviews and follow-ups, classifying recruiter emails, managing CV and portfolio document versions, and analyzing application conversion based on real data.

> **License:** free for personal, non-commercial use only. Commercial use, sale, and resale require prior written approval from the author. See [LICENSE](LICENSE). This is a **source-available** license, not an OSI-approved open source license.

## Project Status (as of November 2026)

| Area | Status |
|---|---|
| Phases 0 to 2 (Foundation, Core ATS, Archive, Career Profile) | Complete |
| Phases 3 to 4 (Hybrid AI Engine, AI Career Features, CV Studio) | Complete |
| Phases 5 to 6 (Credits and Midtrans/Stripe Payments) | Complete |
| Phases 7 to 8 (Local-Cloud Sync and REST API v1) | Complete |
| Phase 9 (id-ID/en-US localization, IDR/USD) | Complete |
| Phase 10 (Security and UU PDP data governance) | Complete |
| Phase 11 (QA and Testing) | Complete, with one accepted exception (PostgreSQL RLS, deferred to a cloud hardening phase) |

**Verified quality gates:** 125/125 unit and integration tests (Vitest), 4/4 E2E tests (Playwright: core journey and accessibility suite), typecheck, lint, and production build. All gates also run automatically through [GitHub Actions CI](.github/workflows/ci.yml) on every push and pull request.

## Background and Context

Job hunting in the modern era often feels messy and exhausting because of several recurring problems:

1. **Information is scattered across platforms**  
   Candidates apply through LinkedIn, JobStreet, Glints, Kalibrr, Indeed, company career sites, and referrals. Without a personal data hub, it is hard to remember when you applied, which role you applied for, which CV version you sent, and who the recruiter contact was.
2. **Spreadsheets quickly become ineffective**  
   Manual notes in Excel or Google Sheets usually have no stage-transition history (audit trail), no automatic follow-up reminders based on business days, no duplicate job URL detection, and no calendar for interviews and technical tests.
3. **Metrics are biased and overly optimistic or pessimistic**  
   Many applicants struggle to measure success honestly. They often mix trial data with real data, or treat unanswered applications as "rejected." This app follows **honest metrics** principles: sample data is automatically separated from real applications, and *No Response* is only assigned after user confirmation once a threshold of days has passed (default 30 days).
4. **Career data privacy (UU PDP)**  
   Job search data (CVs, salary expectations, HR correspondence, recruiter contact details) is private and sensitive. The app is built with a *privacy-first* approach that follows **UU No. 27 Year 2022 on Personal Data Protection (UU PDP)**. It supports strict per-user data isolation, zero-setup local storage with PGlite, no scraping of job portals, no automatic emails sent on the user's behalf, and full rights to export (JSON/CSV) and permanently delete the account.

## Target Market

| User Segment | Characteristics | Primary Needs Met |
|---|---|---|
| **Active Job Seekers** | Applying to 5 to 30+ positions per month across platforms (LinkedIn, JobStreet, Glints, Kalibrr, Indeed, career pages) | One unified workspace (Kanban and Table), unique application codes (`APP-0001`), automatic follow-up reminders, duplicate application prevention, and interview/assessment tracking. |
| **Passive Candidates** | Already employed, occasionally evaluating new opportunities | Job Shortlist and a **Suitability Score (0 to 100%)** calculator based on profile (skills, experience, education, salary, location, growth potential) before deciding to apply. |
| **Fresh Graduates and Career Switchers** | Need the structure of an HR recruitment process and management of many CV/portfolio versions | Standard 13-stage HR pipeline, versioned document management (CV, cover letter, certificates) linked to each application, and response-rate analytics by industry and platform. |
| **Privacy-Conscious Professionals and Self-Hosters** | Want full ownership of career data without vendor lock-in or third-party tracking | Can run 100% locally (embedded PGlite with no PostgreSQL/Docker installation) or self-hosted on PostgreSQL/Supabase, with encrypted OAuth tokens and full data export. |

## Key Features

- **Dashboard and Command Menu (`⌘K` / `Ctrl+K`)**  
  Job search KPI summary, performance charts, upcoming interview schedule, due and overdue follow-ups, and quick navigation through the command menu.
- **Find Jobs and Suitability Evaluation**  
  Save vacancies with automatic platform detection from the URL (LinkedIn, JobStreet, Indeed, Glints, Kalibrr, Greenhouse, Lever, Workday, and others, without scraping) plus duplicate warnings. Includes a **6-criteria** fit evaluation (Skills, Experience, Education, Salary, Location, Career Growth) with customizable weights.
- **Job Shortlist**  
  Group vacancies by triage status: Interested, Shortlisted, Not Interested, or Archived, before actually submitting.
- **Applications (Kanban Drag and Drop and Data Table)**  
  - Standard **13-stage HR pipeline**: `Sourced` -> `Interested` -> `Applied` -> `CV Screening` -> `HR Interview` -> `User Interview` -> `Assessment / Technical Test` -> `Final Interview` -> `Offer` -> `Hired` / `Rejected` / `Withdrawn` / `No Response`.
  - Customizable in settings (rename, recolor, reorder, add in-progress stages, or hide stages).
  - Supports skipping stages and records append-only history in `application_status_history`.
  - Full application detail with 7 tabs: Overview, Timeline, Communications, Interviews, Follow-ups, Documents, and Offer.
- **Interviews, Assessments, and Job Offers**  
  Interview calendar and schedule list, technical test/assessment tracking with deadlines, and recording and comparison of job offer details.
- **Email Center (Manual Log and Optional Gmail/Outlook OAuth)**  
  Deterministic classification of recruitment correspondence (supports Indonesian and English terms) to match emails to related applications and recommend stage updates (always requiring user confirmation). Supports optional read-only sync through Google/Microsoft OAuth with AES-256-GCM encrypted tokens.
- **Document Repository (Versioning)**  
  Upload and manage CVs, cover letters, certificates, and other files (magic-byte validation up to 10 MB for PDF, DOCX, PNG, JPG, WEBP, TXT, MD) with per-user access isolation and document version linking to each application.
- **Analytics and Reports**  
  Recruitment funnel, response rates by platform and company, industry distribution, monthly trends, date-range filters, automatic separation of sample data (sample mode), and analytics report export.
- **Settings and Data Rights (UU PDP)**  
  Candidate profile configuration, time zone (default `Asia/Jakarta`), currency (default `IDR`), Indonesian national holiday presets for business-day follow-up calculations, pipeline customization, load/clear sample data, export of all account data (JSON) or application list (CSV safe from formula injection), and permanent account deletion.
- **Application Archive**  
  Snapshot archiving of closed applications (Rejected/Withdrawn/No Response) with closure notes, automatic retention purge, and prevention of reapplications without confirmation.
- **Master Career Profile**  
  A master career profile (skills, experience, education, certifications) that serves as the verified data source for Suitability Score, skill-gap analysis, and AI generation. Verified data is protected from automatic overwrites by AI.
- **Hybrid AI Engine (Ollama / OpenAI / Gemini)**  
  A provider-agnostic AI router that runs locally (Ollama) or in the cloud (OpenAI/Gemini) with an explicit consent gate, prompt-injection defense, and deterministic fallback. It handles: CV extraction, CV evaluation, CV correction, CV/cover letter generation, job match analysis, skill-gap analysis, and career roadmap.
- **CV Studio**  
  An AI-assisted CV editing and generation studio with preview, version control, and human-in-the-loop principles (every AI output requires confirmation).
- **Credits and Payments**  
  A server-authoritative credit wallet (atomic: `FOR UPDATE` + CAS + idempotency keys) for purchasing AI feature quotas, with payments through **Midtrans** (SHA-512 signature verification) and **Stripe** (HMAC webhooks), including a ledger, credit reservations, and refunds.
- **Hybrid Local-Cloud Sync**  
  Outbox pattern for pushing local changes to cloud storage, pulling remote changes, version-based conflict detection with explicit resolution, and safe replay.
- **REST API v1**  
  Versioned API (`/api/v1/*`) with session/API-key authentication, Zod validation, rate limiting, and idempotency keys for external clients and synchronization.
- **Global Localization**  
  Support for two markets: **Indonesia** (id-ID, IDR, Asia/Jakarta time zone) and **Global** (en-US, USD), with a matching document `lang` attribute and automatic date/currency formatting.

## Usage

### 1. Local Installation and Setup

Make sure **Node.js** (v20+ recommended) and `npm` are installed.

```bash
# 1. Install dependencies
npm install

# 2. Generate secrets in .env.local and run migrations + system seed (local PGlite)
npm run setup

# 3. Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

> **Important operational rule:** never run `npm run setup` or `npm run db:migrate` while `next dev` is running. Concurrent access to `./.data/pglite` can permanently corrupt the data directory (upstream PGlite bug [#884](https://github.com/electric-sql/pglite/issues/884)). Stop the dev server first.

#### Database Modes
- **Local (default):** if `DATABASE_URL` in `.env.local` is left empty, the app automatically uses **PGlite** (embedded PostgreSQL) stored in `./.data/pglite`. No PostgreSQL or Docker installation is required.
- **Cloud / Production (PostgreSQL / Supabase):** set `DATABASE_URL=postgres://...` in `.env.local`, then run `npm run db:migrate`.
- **Optional Email OAuth (Phase 3):** see `.env.example` for `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Gmail API) and `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` (Microsoft Graph) configuration.

### 2. Registration and Initial Onboarding

1. Open `http://localhost:3000` and choose **Sign Up** to create an account (minimum 10-character password).
2. The system automatically initializes default settings and the 13-stage HR pipeline for your account.
3. On the initial **Dashboard**, you can choose to:
   - **Load sample data** to explore the Kanban view, analytics, and application details using demo data (removable at any time and automatically excluded from analytics once you have real applications).
   - **Complete your profile** in **Settings** (skills, years of experience, education, salary expectations, preferred locations) so the Suitability Score gives accurate recommendations.

### 3. Daily Workflow

1. **Discover and evaluate jobs (`Find Jobs` and `Job Shortlist`)**
   - Click **Add job**, paste the job URL (platform and external ID are detected automatically without scraping), then fill in company, position, salary, skills, and deadline.
   - Open the job detail page to view suggested scores in the **Suitability** panel, adjust scores or notes, and mark the triage status (**Interested** / **Shortlisted**).
2. **Record an application submission (`Record Submission`)**
   - From the job detail page (or drag a card directly to the **Applied** column on the Kanban board, or use the **Log application** button), record the submission date, application method, CV version, and recruiter contact.
   - The system creates a unique code (`APP-0001`, etc.), records the initial stage history, and schedules the first follow-up reminder (default 5 business days).
3. **Monitor and move through selection stages (`Applications`)**
   - Use the **Kanban** view to drag and drop cards between stages, or the **Table** view to filter, sort, and download CSV.
   - Click an application to open its details: record communications in the *Communications* tab, schedule interviews in the *Interviews* tab, manage tasks in the *Follow-ups* tab, link a CV version in the *Documents* tab, or record a salary offer in the *Offer* tab.
   - If reapplying to a previously closed vacancy (*Rejected/Withdrawn/No Response*), check the *intentional re-application* option and provide a reason.
4. **Manage schedules, email, and documents**
   - Track all interview schedules and assessment deadlines in the **Interviews** menu.
   - Connect an email account or log correspondence in the **Email Center** to get classification suggestions and application matching.
   - Store master CVs, cover letters, and certificates per version in the **Documents** menu.
5. **Review analytics and manage data (`Analytics` and `Settings`)**
   - Open **Analytics** to evaluate the conversion funnel, the most effective platforms, and company response rates.
   - Open **Settings** to customize pipeline stages, export all data (JSON/CSV), clear sample data, or permanently delete the account.

## Tech Stack

- **Framework**: Next.js 16.4.6 (App Router, Server Components, Server Actions, Turbopack), React 19, TypeScript (strict)
- **Styling and UI**: Tailwind CSS v4, Radix UI primitives, Lucide icons, Geist and Plus Jakarta Sans fonts
- **Database and ORM**: Drizzle ORM 0.45 with PGlite (local) / PostgreSQL (production)
- **Authentication and Security**: Better Auth 1.7 (database sessions, scrypt hashing, rate limiting), Zod validation, AES-256-GCM (OAuth tokens), PKCE + HMAC state, global CSP, magic-byte upload validation, malware scan hooks, signed download tokens
- **AI**: Ollama (local) / OpenAI / Gemini (cloud) behind a provider-agnostic router with a consent gate and prompt-injection defense
- **Payments**: Midtrans (SHA-512) and Stripe (HMAC webhooks), atomic server-authoritative credit wallet
- **Interaction and Visualization**: `@dnd-kit` (Kanban), `recharts` (Analytics), `react-hook-form`, `cmdk`, `sonner`
- **Testing**: Vitest 5 (125 unit and integration tests on in-memory PGlite) and Playwright (E2E: core journey plus accessibility/keyboard suite)

## Scripts

- `npm run setup`: Generates `.env.local` secrets and runs migrations plus system seed. **Stop `next dev` first; never run this concurrently with the dev server (see the warning above).**
- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Creates a production build.
- `npm run start`: Runs the production build.
- `npm run typecheck`: Validates TypeScript (`tsc --noEmit`).
- `npm run lint`: Runs ESLint.
- `npm run test`: Runs all unit and integration tests (Vitest, isolated in-memory PGlite).
- `npm run test:e2e`: Runs end-to-end and accessibility tests (Playwright, in-memory PGlite on port 3105).
- `npm run db:generate`: Generates a new Drizzle migration from the schema.
- `npm run db:migrate`: Runs database migrations. **Same rule applies: never run this while the dev server is active.**
- `npm run usage`: Reports local OpenCode token usage for this project (reads the local OpenCode database in read-only mode).

## Security and Data Governance

- **Strict tenant isolation** per user in every query and service (explicit `userId` filters plus composite foreign keys).
- **OAuth tokens** (Gmail/Microsoft) are encrypted with **AES-256-GCM**; the authorization flow uses **PKCE (S256)** and an HMAC-signed state with replay protection (10-minute TTL, timing-safe comparison).
- **Document uploads**: magic-byte validation, a 10 MB limit with a 413 pre-check, sandboxed CSP on inline document responses, malware scan hooks, and signed download tokens.
- **Environment-aware global CSP** (`next.config.ts`); account deletion and full data export comply with **UU PDP No. 27/2022**.
- **Accepted exception:** PostgreSQL Row-Level Security (RLS) for cloud mode is not yet implemented. It is documented as DEF-11-006 and deferred to a cloud hardening phase.

## Architecture and Design Documentation

### Phase Specifications (01 to 18)
- [01. Requirements Analysis](docs/01-requirements-analysis.md)
- [02. User Journeys](docs/02-user-journeys.md)
- [03. Architecture](docs/03-architecture.md)
- [04. Database Schema](docs/04-database-schema.md)
- [05. UI/UX Wireframes](docs/05-wireframes.md)
- [06. Privacy and Security (UU PDP)](docs/06-privacy-and-security.md)
- [07. Application Archive](docs/07-application-archive.md)
- [08. Master Career Profile](docs/08-master-career-profile.md)
- [09. AI Architecture](docs/09-ai-architecture.md)
- [10. AI Career Intelligence](docs/10-ai-career-intelligence.md)
- [11. CV Studio](docs/11-cv-studio.md)
- [12. Credit System](docs/12-credit-system.md)
- [13. Payment Architecture](docs/13-payment-architecture.md)
- [14. Hybrid Sync](docs/14-hybrid-sync.md)
- [15. API Reference](docs/15-api-reference.md)
- [16. Global Localization](docs/16-global-localization.md)
- [18. Security and Data Governance](docs/18-security-and-data-governance.md)

### Status and QA (Phase 11)
- [Phase Progress Status](docs/PHASE_PROGRESS_STATUS.md): evidence-based status table per phase
- [QA Audit](docs/PHASE_11_QA_AUDIT.md) · [Test Strategy](docs/PHASE_11_TEST_STRATEGY.md) · [Coverage Matrix](docs/PHASE_11_TEST_COVERAGE_MATRIX.md) · [Environment Matrix](docs/PHASE_11_ENVIRONMENT_TEST_MATRIX.md) · [Defect Register](docs/PHASE_11_DEFECT_REGISTER.md)
- [Handover Report](docs/OPENCODE_HANDOVER_REPORT.md): handover guide for the next contributor

### Other References
- [Current Architecture](docs/CURRENT_ARCHITECTURE.md): actual technical architecture
- [Database Gap Analysis](docs/DATABASE_GAP_ANALYSIS.md) · [Security Review](docs/SECURITY_REVIEW_REPORT.md) · [Security Gap Analysis](docs/SECURITY_GAP_ANALYSIS.md) · [Repository Audit](docs/REPOSITORY_AUDIT.md)
- [UI/UX Audit](docs/ui-ux-audit.md) · [UI/UX Roadmap](docs/ui-ux-improvement-roadmap.md) · [Development Backlog](DEVELOPMENT_BACKLOG.md)

## License

This project is **source-available** under the [Career Application Tracker Personal, Non-Commercial Use License v1.0](LICENSE). The source code is public so anyone can read it, learn from it, run it for their own job search, and improve it, but it is **not** free to commercialise.

© 2026 Ari ([kijarrot21](https://github.com/kijarrot21)). New to licensing? Read [License and IP basics](docs/19-license-and-ip.md) for a plain-language walkthrough: what is required, what is optional, and what to do if someone resells this.

### What "source-available for personal use" means

Most people hear "public GitHub repository" and assume "do whatever you want." That is not the case here, because this application is a personal project and is not for sale by anyone other than its author.

| Action | Allowed without asking? |
|---|---|
| Read, study, and learn from the source code | ✅ Yes |
| Run the app for your own job search, on your own machine | ✅ Yes |
| Modify it for your own personal use | ✅ Yes |
| Share it free of charge with a friend for their personal use (with the LICENSE included) | ✅ Yes |
| Use it inside a company, agency, or freelance client project | ❌ No, written approval required |
| Sell it, resell it, or charge for access to it | ❌ No, written approval required |
| Put it behind a paywall, or bundle it into a paid product, template, or course | ❌ No, written approval required |
| Run it as a paid or revenue-generating hosted service for other people | ❌ No, written approval required |
| Remove copyright notices or claim authorship | ❌ No, never permitted |

### Why the license is written this way

The goal is straightforward: **share the work, keep the commercial rights.** Someone else should not be able to download this repository, list it on a marketplace, or resell it as their own product and profit from work they did not do. The license achieves that by limiting the permission it grants:

1. **The grant is conditional.** Section 2.1 gives a narrow permission (personal, non-commercial use), and Section 2.4 states that anything outside that scope is used *without permission*. That matters legally: unauthorised commercial use is not merely a broken contract, it is **copyright infringement**, which is what makes enforcement possible.
2. **Resale and commercial use are expressly prohibited.** Section 4 lists them by name (sell, resell, rent, bundle, paywall, paid hosting, internal business use), so there is no room to argue that the restriction was unclear.
3. **Approval must be in writing.** Section 5.4 removes the usual excuse of "I asked and nobody replied." Silence, a verbal "sure", or an unanswered message is explicitly **not** permission.
4. **Breach ends the permission immediately.** Sections 7.2 to 7.4 require the infringer to stop and delete all copies within seven days.
5. **Remedies are spelled out.** Section 8 covers injunctions (including a court interlocutory order), seizure and destruction of unauthorised copies, damages, disgorgement of profits, legal costs, and a criminal complaint where the infringement is commercial in scale.
6. **Contributions stay licensable.** Section 6 makes sure that if other people contribute code, the author keeps the right to offer commercial licenses later.

### About the word "open source"

"Open source" has a formal meaning: a license must allow commercial use and must not discriminate against fields of endeavour. A personal-use-only license therefore **cannot** be called open source, and calling it that could create a false impression that others are free to sell the software. The accurate terms are **source-available**, **publicly available**, or **free for non-commercial use**. This README and the LICENSE use those terms deliberately.

### Enforcement, in practice

Copyright in this code exists automatically from the moment it was written; no registration is required. A license file in the repository is the notice that puts every user on notice of the terms. To make a claim easier to prove, the author may also:

- record the work with **DJKI** (Directorate General of Intellectual Property, Ministry of Law of the Republic of Indonesia) for evidentiary purposes (pencatatan ciptaan);
- keep dated evidence of authorship, such as signed Git commits and release tags (this repository's commit history serves this purpose);
- send a written cease-and-desist demand before filing, and preserve screenshots, invoices, and marketplace listings as evidence.

Under Law No. 28 of 2014 on Copyright (*UU Hak Cipta*), computer programs are protected works, and remedies for infringement include injunctions, compensation, seizure, and, for commercial-scale infringement, criminal sanctions.

### If you want to use it commercially

Ask first. Written approval is required, and it is granted case by case. Requests should state who will use the software, what it will be used for, whether any fee will be charged to third parties, and for how long. Contact the author through the details published on the [GitHub profile](https://github.com/kijarrot21).

### Third-party components

The license covers only the original code in this repository. Dependencies such as Next.js, React, Drizzle ORM, and the rest of `package.json` remain under their own licenses (MIT, Apache-2.0, and others), and those licenses are unaffected by this one.

> **Note:** the license governs copying and modifying the *code*. If a public instance of this app is ever hosted for other users, that service also needs its own Terms of Service and Privacy Policy, because the license does not govern what users do with their accounts and data.

