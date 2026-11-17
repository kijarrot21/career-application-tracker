# UI/UX Audit: Career Application Tracker (Trackr ATS)

**Audit Date:** November 17, 2026  
**Scope:** Read-only inspection of all routes under `src/app`, all components under `src/components`, styling and Tailwind CSS v4 configuration in `src/app/globals.css`, `DESIGN.md`, and dependency usage in `package.json`.  
**Status:** Audit complete. No application code was modified.

---

## 1. Executive Summary

The Career Application Tracker implements a functional, data-rich personal Applicant Tracking System (ATS) with an emerald-tinted "Executive Precision ATS" visual direction layered over an earlier zinc/indigo wireframe architecture (`docs/05-wireframes.md`). All core recruitment workflows exist, including job discovery, suitability scoring, Kanban and table application tracking, interview scheduling, assessments, document versioning, email classification, analytics, and privacy controls.

However, the audit uncovered **structural UI/UX, accessibility, and design-system debt** across four main areas:

1. **Missing Accessible UI Primitive Layer (Critical):** `radix-ui`, `cmdk`, `react-hook-form`, and `class-variance-authority` are installed in `package.json`, yet **zero files in `src/` import them**. Modals, popovers, command search, tabs, and dropdowns are hand-rolled with raw `<div>`, `<button>`, and native `<select>` elements, lacking focus trapping, `aria-modal`, Escape handling, keyboard navigation, and accessible labels.
2. **Design Token Fragmentation and Dark Mode Contrast Failures (High):** `src/app/globals.css` mixes two conflicting color systems (MD3 emerald/surface tokens vs. `DESIGN.md` `#08945f` / `#e2e8f0` / `#727973` utility classes) and relies on an `@theme inline` shim that remaps `indigo-*`, `violet-*`, `purple-*`, and `zinc-*` to green shades. Dozens of secondary labels use `text-[#3f674f]` without `dark:` overrides, failing contrast in dark mode.
3. **Information Architecture Gaps for Assessments and Offers (High):** Assessments are buried as a tab inside `/interviews` with no edit workflow, and Offers exist only inside individual `/applications/[id]` detail pages with no cross-application offer comparison screen. Meanwhile, `/dashboard` and `/analytics` duplicate large KPI walls and chart sets.
4. **Missing Route Loading, Error, and 404 Boundaries (High):** No `loading.tsx`, `error.tsx`, or `not-found.tsx` files exist under `src/app`. Combined with shared `isPending` transition locks and `window.confirm()` prompts, feedback during async actions and navigation is inconsistent.

---

## 2. System Inventory

### 2.1 Routes Inspected (`src/app`)

| Route | File | Screen / Purpose |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | Server redirect to `/dashboard` or `/sign-in` |
| `/sign-in` | `src/app/(auth)/sign-in/page.tsx` | Split-pane sign-in portal |
| `/sign-up` | `src/app/(auth)/sign-up/page.tsx` | Split-pane registration portal |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Command center, KPIs, pipeline bars, interviews, follow-ups, charts |
| `/jobs` | `src/app/(app)/jobs/page.tsx` | Job Discovery list, filters, triage, quick apply |
| `/jobs/new` | `src/app/(app)/jobs/new/page.tsx` | Create new job vacancy form |
| `/jobs/[id]` | `src/app/(app)/jobs/[id]/page.tsx` | Vacancy detail, inline edit toggle, suitability evaluation panel |
| `/shortlist` | `src/app/(app)/shortlist/page.tsx` | Shortlisted vacancies and 3-item comparison tray |
| `/applications` | `src/app/(app)/applications/page.tsx` | Applications Kanban board and Data Table |
| `/applications/[id]` | `src/app/(app)/applications/[id]/page.tsx` | 7-tab Application Detail workspace (includes Offer tab) |
| `/interviews` | `src/app/(app)/interviews/page.tsx` | 4-tab Interviews & Assessments workspace |
| `/emails` | `src/app/(app)/emails/page.tsx` | OAuth connections, classified inbox, analyzer, recruiter directory |
| `/documents` | `src/app/(app)/documents/page.tsx` | Document vault, version control, and file preview |
| `/analytics` | `src/app/(app)/analytics/page.tsx` | 17 KPI/metric cards, 7 visualizations, breakdown tables |
| `/settings` | `src/app/(app)/settings/page.tsx` | 6-section profile, pipeline stages, rules, weights, privacy settings |

*Note: Zero `loading.tsx`, `error.tsx`, or `not-found.tsx` files exist anywhere in `src/app`.*

### 2.2 Layout & Navigation Structure

- **Root Layout (`src/app/layout.tsx`):** Loads `GeistSans` and `GeistMono` via `geist/font`, plus external Google Fonts `<link>` tags for `Inter` and `Plus Jakarta Sans`, wrapped in `ThemeProvider` (`next-themes` with `defaultTheme="light"`, `enableSystem={false}`, plus `sonner` `<Toaster position="bottom-right" />`).
- **Authenticated Layout (`src/app/(app)/layout.tsx`):** Renders `AppShell` with `AppSidebar`, sticky top header bar (`h-16`), `SampleDataBanner`, and `<main>` container with ambient blur accents.
- **Sidebar Groups (`src/components/layout/app-sidebar.tsx`):**
  - *Pipeline Management:* Dashboard (`/dashboard`), Applications (`/applications`), Interviews (`/interviews`), Analytics (`/analytics`).
  - *Career Assets:* Find Jobs (`/jobs`), Job Shortlist (`/shortlist`), Documents (`/documents`), Email Center (`/emails`).
  - *Footer:* Settings (`/settings`) and user profile card with Sign Out button.

### 2.3 Tailwind Configuration & Global Styles

- **Tailwind CSS v4 (`@tailwindcss/turbopack` 4.3.3):** Configured directly in `src/app/globals.css` using `@import "tailwindcss";`, `@custom-variant dark (&:is(.dark *));`, and `@theme inline`. There is no `tailwind.config.*` or `components.json`.
- **Token Architecture in `src/app/globals.css`:**
  - Lines 5-148 define light and `.dark` CSS custom properties (`--surface`, `--surface-container-*`, `--primary: #006a42`, `--secondary: #3f674f`, `--tertiary: #745725`, `--error: #ba1a1a`, `--accent: #006a42`).
  - Lines 197-244 remap Tailwind `indigo-*`, `violet-*`, `purple-*`, and `zinc-*` scales to emerald and surface hex values.
  - Lines 277-387 define custom typography classes (`.text-display-lg`, `.text-headline-lg/md/sm`, `.text-title-md`, `.text-body-lg/md/sm`, `.text-label-md/sm/xs`, `.text-metric-num`).
  - Lines 390-419 define `.elevation-0` through `.elevation-4`.
  - Lines 421-598 define global element styles for inputs/selects/textareas and `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-destructive` using hardcoded `#08945f`, `#727973`, `#e2e8f0`, and `#ef4444` values from `DESIGN.md`.

### 2.4 Radix UI & Component Library Audit

- `package.json` declares `radix-ui` (`^1.8.1`), `cmdk` (`^1.1.1`), `react-hook-form` (`^7.92.0`), `@hookform/resolvers` (`^7.0.6`), and `class-variance-authority` (`^0.7.1`).
- **Actual Usage in `src/`:** **0 imports** of `radix-ui`, `cmdk`, `react-hook-form`, or `class-variance-authority`.
- **Reusable UI Layer:** Only `src/components/ui/badges.tsx` exists under `src/components/ui/`. There are no shared `Dialog`, `Button`, `Input`, `Select`, `Tabs`, `Tooltip`, `Card`, `EmptyState`, or `ConfirmDialog` primitives.

---

## 3. Cross-Cutting Findings

### 3.1 Accessibility & Interactive Primitives

| ID | Finding | Severity | Affected Files | Priority |
| :--- | :--- | :--- | :--- | :--- |
| CC-01 | **Hand-rolled modals lack ARIA dialog semantics, focus trap, and Escape handling.** Modals render as raw `fixed inset-0` divs without `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, scroll lock, or focus restoration. `RecordSubmissionDialog`, `MoveStageDialog`, and `DocumentsClient` preview modal do not close on `Escape` or backdrop click. | Critical | `src/components/applications/record-submission-dialog.tsx`, `src/components/applications/move-stage-dialog.tsx`, `src/components/documents/documents-client.tsx`, `src/components/layout/command-menu.tsx` | P0 |
| CC-02 | **Form labels lack `htmlFor` / `id` associations.** Most `<label>` elements across forms are visual siblings rather than programmatically bound to their `<input>`, `<select>`, or `<textarea>`. | Critical | `src/components/jobs/vacancy-form.tsx`, `src/components/applications/record-submission-dialog.tsx`, `src/components/applications/move-stage-dialog.tsx`, `src/components/applications/application-detail-client.tsx`, `src/components/interviews/interviews-client.tsx`, `src/components/emails/email-center-client.tsx`, `src/components/documents/documents-client.tsx`, `src/components/settings/settings-client.tsx` | P0 |
| CC-03 | **Icon-only buttons missing `aria-label`.** Close (`X`), delete (`Trash2`), dismiss, unlink, and stage reorder buttons frequently omit `aria-label` (some have `title` only, others have neither). | High | `src/components/layout/app-shell.tsx`, `src/components/layout/command-menu.tsx`, `src/components/applications/move-stage-dialog.tsx`, `src/components/applications/record-submission-dialog.tsx`, `src/components/documents/documents-client.tsx`, `src/components/interviews/interviews-client.tsx`, `src/components/emails/email-center-client.tsx`, `src/components/settings/settings-client.tsx` | P0 |
| CC-04 | **`CommandMenu` has no keyboard result navigation and retains stale query results.** Pressing ArrowUp/ArrowDown/Enter does not move focus through results; clearing the input leaves previous search results visible because `useEffect` returns early when `!query.trim()`. | High | `src/components/layout/command-menu.tsx` | P1 |
| CC-05 | **Notification dropdown lacks popover semantics and click-outside/Escape dismissal.** `notifOpen` toggle in `AppShell` has no `aria-expanded`, `aria-controls`, Escape listener, or outside-click dismissal. | Medium | `src/components/layout/app-shell.tsx` | P1 |
| CC-06 | **Inconsistent destructive confirmation patterns.** Five delete actions use blocking browser `window.confirm()`, while disconnecting an OAuth account, deleting a recruiter contact, and deleting an assessment execute immediately without any confirmation. | High | `src/components/jobs/job-detail-client.tsx`, `src/components/applications/application-detail-client.tsx`, `src/components/documents/documents-client.tsx`, `src/components/interviews/interviews-client.tsx`, `src/components/emails/email-center-client.tsx`, `src/components/settings/settings-client.tsx` | P1 |

### 3.2 Color, Typography, and Design System Consistency

| ID | Finding | Severity | Affected Files | Priority |
| :--- | :--- | :--- | :--- | :--- |
| CC-07 | **Two competing palette definitions in `globals.css` and `DESIGN.md`.** CSS variables define `--primary: #006a42` and `--border: #bdcabf`, whereas `.btn-primary` uses `#08945f`, `.btn-secondary` uses `#e2e8f0` and `#727973`, `.btn-destructive` uses `#ef4444`, and `input:focus` forces `#08945f !important`. Components mix arbitrary hex values (`#006a42`, `#08945F`, `#E2E8F0`, `#B45309`) with semantic utilities. | High | `src/app/globals.css`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/components/emails/email-center-client.tsx`, `src/components/applications/application-detail-client.tsx` | P0 |
| CC-08 | **Dark mode contrast failures on secondary text and inputs.** Numerous muted labels use `text-[#3f674f]` with no `dark:text-[#a5d1b4]` override, rendering dark green text on `#111a15`/`#17231c` surfaces. Many `<input>` and `<select>` elements specify `dark:bg-[#17231c]` without `dark:text-[#ecf3eb]`. Leftover `slate-*` classes and `dark:border-[#B7C4FF]` appear in tabs and buttons. Invalid Tailwind class `bg-[#c0edcf]/60/60` appears in `EmailCenterClient`. | High | `src/components/jobs/jobs-list-client.tsx`, `src/components/jobs/job-detail-client.tsx`, `src/components/applications/application-detail-client.tsx`, `src/components/interviews/interviews-client.tsx`, `src/components/emails/email-center-client.tsx`, `src/components/settings/settings-client.tsx`, `src/components/layout/app-sidebar.tsx` | P0 |
| CC-09 | **Micro-typography and inconsistent container base sizing.** `globals.css` sets `body` to `14px`, yet most workspace containers (`InterviewsClient`, `EmailCenterClient`, `DocumentsClient`, `AnalyticsClient`, `SettingsClient`, `VacancyForm`) wrap their entire view in `text-xs` (`12px`), shrinking labels, inputs, and metadata to `11px-12px`. | Medium | `src/app/globals.css` and nearly all `src/components/*` files | P1 |
| CC-10 | **External Google Fonts dependency for a local-first app.** `src/app/layout.tsx` loads `Plus Jakarta Sans` and `Inter` from `fonts.googleapis.com` via `<link>` (disabling Next lint rule) alongside `geist/font`. Offline environments fall back silently; `next/font/google` or local font bundling is preferred. | Low | `src/app/layout.tsx` | P3 |
| CC-11 | **Inconsistent control heights and button primitives.** Some pages pair `h-9` `<select>` controls next to `h-10` `.btn-primary` / `.btn-secondary` buttons, and inline `<Link>` / `<button>` actions bypass `.btn-*` classes with custom padding and radii (`rounded-lg` vs `rounded-xl`). | Medium | `src/components/jobs/jobs-list-client.tsx`, `src/components/jobs/job-detail-client.tsx`, `src/components/applications/applications-table.tsx`, `src/components/applications/application-detail-client.tsx` | P2 |

### 3.3 Loading, Error, and Empty States

| ID | Finding | Severity | Affected Files | Priority |
| :--- | :--- | :--- | :--- | :--- |
| CC-12 | **No route-level `loading.tsx`, `error.tsx`, or `not-found.tsx`.** All `(app)` pages use `force-dynamic` server queries without Suspense streaming skeletons or friendly error recovery UI. | High | `src/app/(app)/*` | P1 |
| CC-13 | **Coarse `useTransition` pending locks and unguarded actions.** A single `isPending` boolean per page disables unrelated buttons across cards/rows simultaneously, without per-item spinners. Several actions (`handleDismiss`, Kanban vacancy drag, `snoozeFollowUpTaskAction`, `completeFollowUpTaskAction`, `deleteAssessmentAction`, `deleteInterviewAction`, `reorderStagesAction`, `loadSampleDataAction`, `removeSampleDataAction`) lack `try/catch` error toasts. | High | `src/components/layout/app-shell.tsx`, `src/components/dashboard/dashboard-client.tsx`, `src/components/applications/kanban-board.tsx`, `src/components/applications/application-detail-client.tsx`, `src/components/interviews/interviews-client.tsx`, `src/components/settings/settings-client.tsx` | P1 |

---

## 4. Screen-by-Screen Detailed Audit

### 4.1 Global Shell & Navigation (`AppShell`, `AppSidebar`, `CommandMenu`, `SampleDataBanner`)

- **Current Implementation:** Fixed/sticky left sidebar (`AppSidebar`) collapsing to `72px` on `md`-`lg` and expanding to `256px` on `xl+` (plus mobile slide-over drawer), paired with a `64px` sticky glassmorphic header (`AppShell`), `CommandMenu` (`Cmd/Ctrl+K`), notification popover, theme toggle, and `SampleDataBanner`.
- **Evaluation:**
  - *Navigation Clarity:* Clear two-group sidebar (`Pipeline Management` and `Career Assets`), active emerald pill with `aria-current="page"`. However, branding switches between `Trackr ATS`, monogram `CT`, and `Career Application Tracker`. Header CTAs (`Add Job`, `Log Application`) duplicate primary buttons on `/dashboard`, `/jobs`, and `/applications`.
  - *Responsive Behavior:* Between `768px` and `1279px` (`md` to `xl`), `AppSidebar` forces `72px` icon-only mode and hides the expand/collapse button (`hidden xl:inline-flex`), locking tablet users out of labels. When collapsed (`72px`), the bottom user card (`px-3`) tries to fit a `32px` avatar + `28px` Sign Out button inside `48px`, causing clipping/overflow.
  - *Interaction & Accessibility:* `CommandMenu` lacks keyboard list navigation; notification popover lacks outside-click/Escape handling; `AppShell` header has no skip-to-content link.
- **Identified Problems:**
  - **[High]** Tablet (`768px-1279px`) cannot expand sidebar; collapsed bottom user card overflows `72px` rail (`src/components/layout/app-sidebar.tsx`).
  - **[Medium]** Inconsistent product branding (`Trackr`, `CT`, `Career Application Tracker`) across sidebar, metadata, and auth (`app-sidebar.tsx`, `layout.tsx`, `sign-in/page.tsx`).
  - **[Medium]** Duplicate primary CTAs in global header and page headers (`app-shell.tsx`).
  - **[Low]** Dead `phaseBadge` branch in `app-sidebar.tsx` lines 88-110.
- **Recommended Improvements:** Add skip link; fix collapsed sidebar footer (stack avatar and sign-out vertically or move sign-out to a user menu); allow expand toggle at `md+`; replace `CommandMenu` with `cmdk` + Radix `Dialog`; convert notifications to Radix `Popover`; unify brand name and keep global header CTAs compact or single primary `"Quick Log"`.
- **Files Affected:** `src/components/layout/app-shell.tsx`, `src/components/layout/app-sidebar.tsx`, `src/components/layout/command-menu.tsx`, `src/components/layout/sample-data-banner.tsx`.
- **Priority:** P0 (a11y/shell primitives) / P1 (responsive sidebar).

---

### 4.2 Auth Screens (`/sign-in`, `/sign-up`, `/`)

- **Current Implementation:** Root `/` redirects server-side to `/dashboard` or `/sign-in`. Both `/sign-in` and `/sign-up` render a 50/50 split layout on `lg+` (emerald credentials pane on left, elevated card form on right) with a UU PDP privacy disclosure card at the bottom.
- **Evaluation:**
  - *Visual Hierarchy & Typography:* Clean split composition and crisp heading scale (`text-headline-md`), though the 10-line UU PDP privacy block at the bottom of the card competes visually with the primary CTA.
  - *Form Usability:* Email and password fields have proper `<label htmlFor>` bindings and `autoComplete`. However, there is no Show/Hide password toggle, no inline password-length indicator on `/sign-up` (only checked on submit), and no error clear on input edit.
  - *Color Consistency:* Mixes `#08945F` and `#E2E8F0` hardcoded values with `#eff5ee` and `#bdcabf`.
- **Identified Problems:**
  - **[Medium]** Missing Show/Hide password toggle and live password validation hint on `/sign-up` (`sign-in/page.tsx`, `sign-up/page.tsx`).
  - **[Low]** Dense legal wall inside the auth card increases vertical height on mobile; could be a collapsible summary or modal.
- **Recommended Improvements:** Add accessible password visibility toggle, inline 10-char password meter/check on sign-up, and convert the UU PDP notice into a compact expandable accordion or link.
- **Files Affected:** `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`.
- **Priority:** P2.

---

### 4.3 Dashboard (`/dashboard` - `DashboardClient`)

- **Current Implementation:** Single vertical scroll containing: (1) Welcome banner with `searchStatus` `<select>` and quick action links, (2) 4 primary KPI cards + 6 `MiniStat` cards, (3) 12-column split with `Application Pipeline` bar breakdown, `Upcoming Interviews`, and `Pending Follow-ups`, (4) `Recent Application Activity` feed, and (5) a full `Recruitment Performance Analytics` section with 6 rate/duration `MetricCard`s and 3 Recharts charts (Funnel, Bar, Donut).
- **Evaluation:**
  - *Visual Hierarchy & Information Density:* Too dense and repetitive. Displaying **16 metric/stat cards + 4 lists + 3 charts** blurs the purpose of Dashboard (daily action center) vs Analytics (retrospective reporting).
  - *Responsive Behavior:* The top 4 KPI cards switch to horizontal scrolling (`flex overflow-x-auto`) below `md`, hiding 3 of 4 cards with no scroll indicator or pagination dots instead of a clean `grid-cols-2` stack.
  - *Interaction & Charts:* Welcome status `<select>` looks like a static green pill without a chevron indicator. Stage breakdown bars and KPI cards are non-interactive (cannot click a stage to filter `/applications`). Recharts `<Tooltip />` uses default light styling in dark mode and lacks `role="img"` / accessible summaries.
- **Identified Problems:**
  - **[High]** Excessive information density and duplication with `/analytics` (`dashboard-client.tsx` lines 515-708).
  - **[High]** Mobile KPI carousel hides 3 cards offscreen without affordance (`dashboard-client.tsx` line 195).
  - **[Medium]** Recharts tooltips and `PieChart` sizing break down in dark mode and narrow viewports; interactive status `<select>` lacks dropdown affordance.
- **Recommended Improvements:** Refocus Dashboard on daily execution (4 primary KPIs in a `grid-cols-2 lg:grid-cols-4` layout, actionable "Needs Attention" / overdue follow-ups, upcoming interviews, pipeline snapshot linking to `/applications?stageId=...`, and recent activity), moving the 6 conversion cards and 3 deep charts primarily to `/analytics` (or keeping 1 compact trend card with a "View Full Analytics" link).
- **Files Affected:** `src/components/dashboard/dashboard-client.tsx`.
- **Priority:** P1.

---

### 4.4 Job Discovery (`/jobs`, `/jobs/new`, `/jobs/[id]` - `JobsListClient`, `VacancyForm`, `JobDetailClient`, `SuitabilityPanel`)

- **Current Implementation:** `/jobs` shows a 6-column filter toolbar (search, triage, priority, platform, sort) plus Work Arrangement filter pills and a vertical list of vacancy cards. `/jobs/new` renders `VacancyForm` (757 lines) with URL auto-detection and duplicate checking. `/jobs/[id]` shows vacancy header, inline edit mode toggle, requirements, linked applications, and `SuitabilityPanel`.
- **Evaluation:**
  - *Navigation & Persistence:* Filter state in `JobsListClient` is local `useState` only; clicking a vacancy and hitting Back resets all filters and search queries. No "Clear Filters" action exists.
  - *Information Density:* Vacancy cards stack 4 badges (`SuitabilityBadge`, `TriageBadge`, `PriorityBadge`, `SampleBadge`) next to the title and render unlimited skill chips, inflating card height.
  - *Form Usability (`VacancyForm`):* Long single-column/multi-grid form (~25 fields) with no sticky save bar, no per-field validation messages, and inconsistent edit behavior (recruiter contact fields disappear when editing an existing vacancy).
  - *Suitability Panel:* Sliders (`input[type="range"]`) lack numeric step inputs or visible scale ticks; `"Apply Profile Suggestions"` silently overwrites user ratings (forcing `growth` to `80` if null) with no confirmation or undo.
  - *Accessibility & Contrast:* Numerous labels in `VacancyForm` lack `htmlFor`; `JobDetailClient` has multiple `text-[#3f674f]` labels without `dark:` colors; `handleDelete` uses `window.confirm`.
- **Identified Problems:**
  - **[High]** Filter state lost on navigation; no "Clear all filters" button (`jobs-list-client.tsx`).
  - **[High]** Unassociated labels and dark-mode contrast gaps (`vacancy-form.tsx`, `job-detail-client.tsx`).
  - **[Medium]** Card badge clutter and unbounded skill chip lists (`jobs-list-client.tsx`).
  - **[Medium]** `VacancyForm` lacks sticky action footer, progressive disclosure for optional sections, and recruiter editing support (`vacancy-form.tsx`).
  - **[Medium]** `SuitabilityPanel` overwrites manual scores without warning/undo (`suitability-panel.tsx`).
- **Recommended Improvements:** Sync `/jobs` filters to URL query params; add active filter chips + Reset; cap card skills at 5 with `+N more`; group `VacancyForm` into clear collapsible or stepped sections with sticky save bar; add numeric input alongside range sliders and undo/preview for profile suggestions.
- **Files Affected:** `src/components/jobs/jobs-list-client.tsx`, `src/components/jobs/job-detail-client.tsx`, `src/components/jobs/vacancy-form.tsx`, `src/components/jobs/suitability-panel.tsx`, `src/app/(app)/jobs/new/page.tsx`.
- **Priority:** P1 (filters/a11y) / P2 (form ergonomics).

---

### 4.5 Job Shortlist (`/shortlist` - `ShortlistClient`)

- **Current Implementation:** Lists `interested` and `shortlisted` vacancies with a checkbox to select up to 3 items into a "Side-by-Side Comparison" grid above the list, plus `Record Submission`, `Not Interested`, and `Archive` actions.
- **Evaluation:**
  - *Comparison Usability:* The 3-column comparison tray uses stacked paragraphs inside independent cards (`md:grid-cols-3`) instead of an aligned attribute matrix table, making row-by-row comparisons (Salary vs Salary, Skills vs Skills) harder to scan. It omits Skills, Employment Type, Industry, and direct Apply/Inspect buttons.
  - *Navigation & Empty State:* No search or sort controls; empty state has no CTA button to browse `/jobs` (the button is only in the top header); cannot demote an item back to `New` without visiting detail view.
- **Identified Problems:**
  - **[Medium]** Card-based comparison tray lacks attribute alignment, skills/requirements rows, and direct actions (`shortlist-client.tsx` lines 98-160).
  - **[Medium]** No sorting/filtering or empty-state CTA inside the empty state box (`shortlist-client.tsx` lines 162-172).
  - **[Low]** No undo toast when moving a vacancy to `Not Interested` or `Archived`.
- **Recommended Improvements:** Replace the comparison card grid with a structured comparison matrix table (attributes as rows, selected vacancies as columns, highlighting best salary/highest fit); add empty-state CTA and undoable triage toasts.
- **Files Affected:** `src/components/jobs/shortlist-client.tsx`.
- **Priority:** P2.

---

### 4.6 Applications (`/applications` - `ApplicationsViewClient`, `KanbanBoard`, `ApplicationsTable`, `RecordSubmissionDialog`, `MoveStageDialog`)

- **Current Implementation:** Top view switcher (`Kanban Board` / `Data Table`), `Export CSV`, `Log Application`, 6-control filter toolbar, and either a 13-column horizontal Kanban board (`@dnd-kit/core`) or a 10-column sortable/groupable HTML table.
- **Evaluation:**
  - *Filter Persistence & Toolbar:* Filters (`search`, `stageFilter`, `outcomeFilter`, `platformFilter`, `fromDate`, `toDate`) are stored in component state, not URL params, so opening an application and navigating back loses all filters. No "Clear Filters" button exists.
  - *Kanban Board Usability:* Rendering all 13 stages horizontally at `312px` each (~4,200px total width) forces heavy horizontal scrolling even on large desktops, and terminal stages (`Rejected`, `Withdrawn`, `No Response`) occupy full columns on the active board. Cards are tall (`Move stage:` `<select>`, salary pill, stage badge, outcome/interview badge, follow-up date, no-response alert, drag handle). `DndContext` lacks `KeyboardSensor` and `<DragOverlay>`, causing clipped dragging inside the overflow container. Column `+` quick-add ignores which column was clicked.
  - *Table Usability:* `ApplicationsTable` renders 10 wide columns with horizontal overflow, no sticky Company/Role column, no pagination/row count footer, no row actions menu, and no `aria-sort` or directional sort icon (`ArrowUpDown` stays static). `"Export CSV"` is duplicated in both `ApplicationsViewClient` header and `ApplicationsTable` toolbar.
  - *Form & Modal Usability:* `RecordSubmissionDialog` has ~18 fields in one long scrollable modal and uses a plain text input defaulting to `"Master_CV_v1.pdf"` instead of picking from uploaded documents in `/documents`. `MoveStageDialog` computes `effectiveOn` via UTC `toISOString().slice(0, 10)` instead of the user's configured timezone.
- **Identified Problems:**
  - **[Critical]** Modals (`RecordSubmissionDialog`, `MoveStageDialog`) lack Radix Dialog accessibility (`role="dialog"`, focus trap, Escape) (`record-submission-dialog.tsx`, `move-stage-dialog.tsx`).
  - **[High]** 13-column board overflow, missing `<DragOverlay>` and `KeyboardSensor`, and column `+` ignoring stage context (`kanban-board.tsx`).
  - **[High]** Table lacks `aria-sort`, active sort indicators, row quick-actions, and duplicates `"Export CSV"` (`applications-table.tsx`, `applications-view-client.tsx`).
  - **[High]** Filters reset on navigation; no Reset Filters control (`applications-view-client.tsx`).
  - **[Medium]** `RecordSubmissionDialog` doesn't link to real repository document versions; `MoveStageDialog` date defaults to UTC (`record-submission-dialog.tsx`, `move-stage-dialog.tsx`).
- **Recommended Improvements:** Add toggleable/collapsible terminal lanes on Kanban (or group active vs closed), add `<DragOverlay>` and `KeyboardSensor`, compact card metadata; sync filters to URL params with Reset button; upgrade table with `aria-sort`, directional icons, sticky identifier column, and single Export button; integrate repository CV selector in `RecordSubmissionDialog`.
- **Files Affected:** `src/components/applications/applications-view-client.tsx`, `src/components/applications/kanban-board.tsx`, `src/components/applications/applications-table.tsx`, `src/components/applications/record-submission-dialog.tsx`, `src/components/applications/move-stage-dialog.tsx`.
- **Priority:** P0 (modals) / P1 (board, table, filters).

---

### 4.7 Application Detail (`/applications/[id]` - `ApplicationDetailClient`)

- **Current Implementation:** A 1,914-line monolithic component with header card, clickable stage stepper, No Response banner, and 7 tabs (`Overview & Details`, `Timeline & Status History`, `Communications`, `Interviews`, `Follow-up Tasks`, `Attached Documents`, `Offer & Result`).
- **Evaluation:**
  - *Visual Hierarchy & Information Density:* `Overview` tab exposes 16 editable inputs immediately without a clean read-only summary view. Long tab labels with counts (`Timeline & Status History (N)`) wrap awkwardly across lines on tablet/mobile.
  - *Pipeline Stepper:* Skipped stages render with `line-through` text, reducing legibility; stepper wraps onto multiple lines instead of a clean horizontal scroll or compact progress bar.
  - *Interaction & Feature Parity:* `Interviews` tab inside Application Detail cannot edit prep notes or delete interviews (unlike `/interviews`). `Communications` and `Follow-up Tasks` tabs have no edit/delete actions. `Documents` tab displays both legacy free-text `cvVersionLabel` and structured repository links, causing ambiguity.
  - *Stale Copy & Contrast:* Line 883-884 still says `"(Automated Gmail/Outlook OAuth sync arrives in Phase 3.)"`, though OAuth sync is already live. Line 513 has `dark:border-[#B7C4FF]`; many labels and dark inputs lack `dark:text-[#ecf3eb]` and `htmlFor`.
- **Identified Problems:**
  - **[High]** Monolithic 1,914-line file with missing `htmlFor` bindings, dark-mode text contrast gaps, and leftover non-emerald/slate classes (`application-detail-client.tsx`).
  - **[High]** Tab bar lacks `role="tablist"`/`role="tab"`/`aria-selected` semantics and wraps poorly on mobile (`application-detail-client.tsx` lines 477-520).
  - **[Medium]** Read/edit confusion in Overview tab; missing edit/delete on interviews, follow-ups, and communications; stale Phase 3 copy (`application-detail-client.tsx` lines 523-1318).
  - **[Medium]** Dual CV tracking (legacy string vs Document Repository links) creates conflicting sources of truth (`application-detail-client.tsx` lines 1537-1550).
- **Recommended Improvements:** Split `ApplicationDetailClient` into dedicated tab subcomponents; adopt Radix `Tabs`; provide read-only Overview summary with explicit Edit mode (or autosave/dirty guard); remove stale Phase 3 notice; unify interview editor with `/interviews`.
- **Files Affected:** `src/components/applications/application-detail-client.tsx`.
- **Priority:** P0 (a11y/contrast) / P1 (component split & tab UX).

---

### 4.8 Interviews (`/interviews` - `InterviewsClient`)

- **Current Implementation:** 4-tab view (`Calendar & Split Inspector`, `All Interviews`, `Assessments & Technical Tests`, `Schedule New Interview`) with 4 top KPI cards. The Calendar tab shows a 7-column month grid (60%) alongside `InterviewInspectorEditor` (40%).
- **Evaluation:**
  - *Timezone Bug & Calendar Usability:* Calendar cell matching uses `startsAt.toISOString().slice(0, 10)` (UTC date) and the inspector input says `"Date & Time (UTC)"`, whereas the inspector header displays `formatDateTime(interview.startsAt, timezone)` in the user's local timezone (`Asia/Jakarta` UTC+7). An interview at 01:00 WIB on Nov 18 is stored as `2026-11-17T18:00Z` and renders on **Nov 17** in the calendar grid! Also, `"Current Month"` jumps to `initialYearMonth` (the first scheduled interview's month) rather than today's date.
  - *Responsive Behavior:* On mobile (`< 768px`), the 7-column month grid shrinks cells to ~45px wide, truncating company names to 2-3 characters with no agenda/day-list fallback.
  - *Workflow Friction:* Scheduling uses a full page tab (`Schedule New Interview`) instead of a drawer/modal, and clicking `"Inspect & Edit"` in List view switches back to the Calendar tab. List view lacks search and date filtering.
- **Identified Problems:**
  - **[Critical]** UTC vs user timezone mismatch between calendar day cells (`toISOString().slice(0, 10)`), editor input (`Date & Time (UTC)`), and displayed header time (`interviews-client.tsx` lines 416-423, 1061-1063, 1235).
  - **[High]** Mobile 7-column calendar grid is unusable on narrow viewports (`interviews-client.tsx` lines 397-471).
  - **[Medium]** Scheduling in a separate tab interrupts calendar context; List view lacks search and inline outcome updates (`interviews-client.tsx` lines 498-618, 856-1043).
- **Recommended Improvements:** Normalize calendar cell bucketing and `datetime-local` formatting/parsing to `data.timezone`; provide a mobile Agenda list view below `md`; move "Schedule Interview" to a Radix Dialog/Sheet; separate Assessments into its own route/view.
- **Files Affected:** `src/components/interviews/interviews-client.tsx`, `src/app/(app)/interviews/page.tsx`.
- **Priority:** P0 (timezone bug) / P1 (mobile agenda & modal).

---

### 4.9 Assessments (Tab inside `/interviews` - `InterviewsClient` lines 621-853)

- **Current Implementation:** Implemented solely as Tab 3 (`Assessments & Technical Tests`) inside `InterviewsClient`. Renders a list of assessment cards (7 cols) and a creation form (5 cols).
- **Evaluation:**
  - *Navigation Clarity & Discoverability:* No `/assessments` route and no sidebar navigation link. Users must know to look inside `Interviews` to manage coding tests, case studies, or psychometric assessments.
  - *Interaction & Form Usability:* Assessments can only be **created or deleted**; there is **no edit flow** to enter a score or change `result` from `Pending` to `Passed` / `Failed` once completed. `Score` and `Max Score` use `type="text"` instead of numeric inputs, and the delete button has no confirmation dialog and no `aria-label`.
  - *Empty & Filter States:* Empty state is a single plain sentence (`"No assessments recorded yet."`) with no helpful guidance; there are no status/type filters or sorting by due date.
- **Identified Problems:**
  - **[High]** No dedicated `/assessments` route or sidebar entry; buried inside `/interviews` (`app-sidebar.tsx`, `interviews-client.tsx`).
  - **[High]** Cannot edit existing assessments (no way to record score/pass/fail after creation) (`interviews-client.tsx` lines 634-711).
  - **[High]** Delete button lacks confirmation dialog and `aria-label` (`interviews-client.tsx` line 653).
- **Recommended Improvements:** Promote Assessments to a dedicated route (`/assessments`) or a clear sub-navigation item under Pipeline Management; add inline or drawer-based Edit Assessment functionality; add status/due-date filters and delete confirmation.
- **Files Affected:** `src/components/interviews/interviews-client.tsx`, `src/components/layout/app-sidebar.tsx` (and new route `src/app/(app)/assessments/page.tsx` when implemented).
- **Priority:** P1.

---

### 4.10 Offers (Tab inside `/applications/[id]?tab=offer` - `ApplicationOfferTab`)

- **Current Implementation:** Exists solely as Tab 7 (`Offer & Result`) inside `ApplicationDetailClient` (`src/components/applications/application-detail-client.tsx` lines 1670-1914). Provides a single form for `positionTitle`, `baseSalary`, `currency`, `salaryPeriod`, `offerReceivedOn`, `responseDeadline`, `joiningDate`, `decision`, `syncApplicationStage` checkbox, `benefits` textarea, and `notes` textarea.
- **Evaluation:**
  - *Navigation Clarity:* There is **no `/offers` route**, no sidebar item, and no aggregated Offers overview. A candidate holding 2 or 3 competing offers has no way to view deadlines or compare total compensation packages side by side without opening separate application tabs.
  - *Form Usability:* `offerReceivedOn` falls back to `app.submittedOn` (line 1335) when creating a new offer, which is almost always incorrect since offers arrive weeks after submission. Compensation details (signing bonus, annual bonus, equity/ESOP, allowances) are flattened into an unstructured `benefits` textarea.
  - *Visual Hierarchy:* Even when an offer is already recorded, the tab renders the raw edit form rather than a clear executive Offer Summary card with deadline urgency countdown and decision actions (`Accept Offer`, `Decline`, `Negotiate`).
- **Identified Problems:**
  - **[High]** No dedicated `/offers` overview & side-by-side offer comparison workspace (`app-sidebar.tsx`, `application-detail-client.tsx`).
  - **[Medium]** `offerReceivedOn` defaults to `app.submittedOn` instead of today's date (`application-detail-client.tsx` line 1335).
  - **[Medium]** No executive Offer Summary view or structured compensation fields (bonus/equity) (`application-detail-client.tsx` lines 1670-1914).
- **Recommended Improvements:** Create a dedicated `/offers` route (with sidebar link under Pipeline Management) featuring an Offer Comparison matrix, deadline countdown alerts, and summary metrics; refine `ApplicationOfferTab` with a summary card + edit toggle and fix `offerReceivedOn` default to today.
- **Files Affected:** `src/components/applications/application-detail-client.tsx`, `src/components/layout/app-sidebar.tsx` (and new route `src/app/(app)/offers/page.tsx` when implemented).
- **Priority:** P1.

---

### 4.11 Email Center (`/emails` - `EmailCenterClient`)

- **Current Implementation:** OAuth 2.0 connection bar (Gmail/Outlook + collapsible setup guide), 3 tabs (`Recruitment Inbox`, `Analyze / Log Email`, `Recruiter Contacts`), filter bar, and stacked email cards with classification badges, confidence percentage, suggested stage transition banners, and inline application-linking `<select>`.
- **Evaluation:**
  - *Information Density & Layout:* The inbox uses tall stacked full-width cards rather than a split-pane email client (`list` on left, `thread & triage inspector` on right), requiring heavy scrolling for 20+ messages.
  - *Interaction & Safety:* `Disconnect` account and `Delete` recruiter buttons have no confirmation dialog (`email-center-client.tsx` lines 362, 909) and the delete recruiter button lacks `aria-label`. No bulk action exists to mark or clear `Not Recruitment` / `Ignored` messages. Setup guide Redirect URIs lack copy-to-clipboard buttons.
  - *Visual & Contrast Bugs:* Line 378 uses invalid Tailwind syntax `bg-[#c0edcf]/60/60`; numerous dark-mode `text-[#3f674f]` spans lack `dark:` variants.
- **Identified Problems:**
  - **[High]** Destructive `Disconnect` and `Delete Recruiter` actions execute without confirmation; `Delete Recruiter` lacks `aria-label` (`email-center-client.tsx`).
  - **[High]** Dark mode contrast gaps and invalid CSS class `bg-[#c0edcf]/60/60` (`email-center-client.tsx`).
  - **[Medium]** Full-width card stack scales poorly compared to a master-detail inbox; missing bulk triage and copy-URI buttons (`email-center-client.tsx`).
- **Recommended Improvements:** Add confirmation dialogs for disconnect/delete; fix invalid CSS and dark-mode tokens; add copy-to-clipboard on OAuth redirect URIs; consider master-detail split layout for inbox triage and bulk ignore/archive actions.
- **Files Affected:** `src/components/emails/email-center-client.tsx`.
- **Priority:** P0 (a11y/contrast) / P2 (master-detail layout).

---

### 4.12 Document Repository (`/documents` - `DocumentsClient`)

- **Current Implementation:** Header with `"Upload Document"` toggle, inline collapsible upload form, search bar + 9 category filter pills, document cards listing all versions inline with `Link to Application` dropdowns, `Preview` modal (`<img>` or `<iframe>`), and `Download`.
- **Evaluation:**
  - *Preview Usability:* Non-image files (including `.docx` Word documents allowed in `accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md"`) are rendered inside an `<iframe>` (`documents-client.tsx` line 727), which causes browsers to trigger a blank frame or unexpected file download for `.docx` instead of showing a clear fallback message.
  - *Modal Accessibility:* Preview modal lacks `role="dialog"`, `aria-modal="true"`, Escape key dismissal, backdrop click close, and `aria-label` on the close button.
  - *Visual Noise & Density:* Every card renders a decorative top-right blur circle (`pointer-events-none ... blur-xl`) and expands all historical versions unconditionally. Version rows show raw `sha256:...` strings, adding visual noise. The `"Link to Application"` `<select>` auto-mutates on change without indicating already-linked applications.
- **Identified Problems:**
  - **[Critical]** Document Preview modal is inaccessible (no `role="dialog"`, focus trap, Escape, or close `aria-label`) (`documents-client.tsx` lines 684-736).
  - **[High]** `<iframe>` preview fails silently for `.docx` files (`documents-client.tsx` lines 726-732).
  - **[Medium]** Inline upload panel pushes content down; version lists cannot collapse; `sha256` hashes and decorative blur blobs add clutter (`documents-client.tsx`).
- **Recommended Improvements:** Move upload form and preview into Radix `Dialog`s; show explicit non-previewable fallback card for `.docx` with Download CTA; show latest version prominently with collapsible version history; hide `sha256` behind a tooltip or info popover.
- **Files Affected:** `src/components/documents/documents-client.tsx`.
- **Priority:** P0 (modal a11y) / P2 (preview fallback & layout).

---

### 4.13 Analytics (`/analytics` - `AnalyticsClient`)

- **Current Implementation:** Date range + sample mode filter bar, CSV export and Print/Save PDF buttons, 10 numbered KPI tiles (`1. Jobs Discovered` through `10. No Response`), 7 conversion/cycle `MetricShell` cards, 3 custom/Recharts Row-1 charts (Funnel, Stage bars, Outcomes Donut), 2 Row-2 charts (Activity Over Time, Monthly Recruitment Performance), 2 Row-3 charts (Interview Conversion Trend, Platform Horizontal Bar), and 3 breakdown tables/lists (Company Response Rates, Platform Distribution, Industry Distribution).
- **Evaluation:**
  - *Information Density:* **17 KPI/metric cards** stacked in two grids before any chart appears creates visual fatigue and echoes the Dashboard.
  - *Chart Usability & Accessibility:* Recharts `<Tooltip />` and axis tick labels are not theme-aware for dark mode. `"Applications by Job Platform"` hardcodes `YAxis width={110}` (clipping longer source names). `"Monthly Recruitment Performance"` uses 4 similar emerald/olive/brown colors (`#006a42`, `#008655`, `#8f6f3b`, `#005232`), which lack perceptual separation for color-blind users. Charts lack `aria-label` or screen-reader data summaries.
  - *Table & Filter Usability:* Company Response Rates table cannot be sorted by Response Rate or Avg Reply, and has no pagination/search. Date filters lack quick presets (`30d`, `90d`, `YTD`).
- **Identified Problems:**
  - **[High]** Recharts tooltips/axes ignore dark mode; 4-bar palette lacks color-blind contrast; charts lack accessible labels (`analytics-client.tsx`).
  - **[Medium]** 17 stacked KPI tiles before the fold obscure visual hierarchy; Company table lacks sorting (`analytics-client.tsx`).
  - **[Low]** Unused `accent="blue"` union branch in `KpiTile` (line 819); missing date-range presets.
- **Recommended Improvements:** Theme Recharts tooltips, gridlines, and axis ticks via CSS variables; adopt a distinct categorical palette (e.g., emerald, teal, amber, slate/indigo) with patterns or clear legend toggles; consolidate KPIs into grouped summary strips; add sortable headers to Company Response Rates and quick date presets.
- **Files Affected:** `src/components/analytics/analytics-client.tsx`.
- **Priority:** P1 (chart dark mode & contrast) / P2 (KPI consolidation & table sort).

---

### 4.14 Settings (`/settings` - `SettingsClient`)

- **Current Implementation:** Single vertical scroll of 6 numbered card sections: (1) Candidate Profile & Preferences, (2) Recruitment Pipeline Stages, (3) Follow-up & "No Response" Intervals, (4) Job Suitability Evaluation Weights, (5) Sample Demonstration Records, and (6) Data Portability & Account Deletion (UU PDP).
- **Evaluation:**
  - *Navigation & Form Usability:* 886-line monolithic page with 4 separate `<form>` blocks and no section tabs or sidebar sub-nav, requiring excessive scrolling to reach Data Export or Account Deletion. No unsaved-changes indicator exists across the 4 forms.
  - *Pipeline Stage Customization:* Users can reorder, hide/show, and add stages, but **cannot rename or recolor existing stages or delete custom stages**. The `"Stage Classification"` (`interview`, `screening`, `assessment`) and `"Badge Color"` (`indigo`, `fuchsia`, `zinc`) `<select>`s expose raw internal enum keys rather than human labels or color previews.
  - *Suitability Weights & Holidays:* The 6 weight inputs do not display a live total (`Sum: 100%`) or warn when weights don't sum to 100. The Public Holidays text input silently strips invalid date strings on save with no validation error.
  - *Safety & Contrast:* Account deletion uses `window.confirm` after password entry; multiple labels lack `htmlFor` and `dark:` text colors.
- **Identified Problems:**
  - **[High]** Unassociated `<label>` elements and missing `dark:` contrast on helper text and inputs (`settings-client.tsx`).
  - **[Medium]** Monolithic 6-section vertical layout with no section tabs or unsaved-changes guard (`settings-client.tsx`).
  - **[Medium]** Stage editor exposes raw color/type keys without swatches and lacks rename/delete for custom stages (`settings-client.tsx` lines 484-626).
  - **[Medium]** Weights editor lacks live sum check; holidays input silently drops malformed dates (`settings-client.tsx` lines 192-195, 735-774).
- **Recommended Improvements:** Organize Settings into clean tabbed sections (`Profile`, `Pipeline Stages`, `Follow-up Rules`, `Suitability Weights`, `Data & Privacy`); add `htmlFor` to all fields; add live weight sum badge (`Total: 100%`), holiday chip/tag picker with date validation, stage color swatches, and an in-app Radix confirmation modal for permanent account deletion.
- **Files Affected:** `src/components/settings/settings-client.tsx`.
- **Priority:** P0 (a11y/contrast) / P2 (tabbed layout & stage/weight UX).

---

## 5. Consolidated Issue Summary by Severity & Priority

| Severity | Count | Key Themes |
| :--- | :--- | :--- |
| **Critical** | 4 | Unbound `<label>` elements across forms; raw `fixed inset-0` modals without ARIA/focus-trap/Escape (`RecordSubmissionDialog`, `MoveStageDialog`, `DocumentsClient` preview); UTC vs user-timezone mismatch on `/interviews` calendar grid. |
| **High** | 15 | Unused `radix-ui`/`cmdk` primitives; missing `aria-label` on icon buttons; dual design token system & dark-mode `#3f674f` contrast failures; missing `loading.tsx`/`error.tsx`/`not-found.tsx`; missing `/assessments` edit & route; missing `/offers` route & comparison; tablet sidebar expand/collapse lock & collapsed footer overflow; Kanban 13-col overflow & missing `DragOverlay`/`KeyboardSensor`; filter state loss on `/jobs` and `/applications`; unconfirmed destructive actions (`EmailCenterClient`, `InterviewsClient`); `.docx` iframe preview failure; Recharts dark-mode tooltip & color contrast. |
| **Medium** | 17 | `text-xs` micro-typography default; duplicate header/table CTAs; `Dashboard` vs `Analytics` KPI overlap & mobile KPI carousel; `Shortlist` comparison card layout; `VacancyForm` ergonomics & `SuitabilityPanel` silent overwrite; `ApplicationDetailClient` 1,914-line monolith & stale Phase 3 copy; `Settings` 6-section scroll, raw stage enum dropdowns, weight sum check, and silent holiday filtering; Auth password toggle. |
| **Low** | 5 | Google Fonts external link vs local/Next font; dead `phaseBadge` code in `AppSidebar`; unused `accent="blue"` in `AnalyticsClient`; auth legal text density; undo toast on shortlist triage. |

**Priority Definitions:**
- **P0:** Accessibility blockers, broken timezone behavior, dark-mode contrast failures, and core Radix UI primitive setup.
- **P1:** Navigation/IA gaps (`/assessments`, `/offers`), responsive shell & Kanban/Table usability, Dashboard vs Analytics separation, loading/error boundaries, filter persistence, and destructive confirmations.
- **P2:** Monolith component splitting (`ApplicationDetailClient`, `SettingsClient`), form ergonomics, comparison matrix, preview fallback, and chart refinements.
- **P3:** Font bundling, dead code cleanup, and micro-polish.
