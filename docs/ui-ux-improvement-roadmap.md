# UI/UX Improvement Roadmap: Career Application Tracker (Trackr ATS)

**Companion Document:** [ui-ux-audit.md](./ui-ux-audit.md)  
**Status:** Proposed Roadmap (Awaiting Approval Before Implementation)  
**Constraint:** No application code or routes have been modified during this audit.

---

## 1. Strategic Approach & Sequencing Rationale

To modernize the Career Application Tracker without breaking existing features or duplicating effort, the redesign is structured into **five sequential phases**:

1. **Phase 1: Design System Tokens & Accessible Primitive Foundation (P0)**  
   Consolidate competing CSS variables in `src/app/globals.css`, fix dark-mode contrast failures, and build a lightweight `src/components/ui/` layer powered by the already-installed `radix-ui`, `cmdk`, and `class-variance-authority` packages. Doing this first ensures every subsequent screen refactor reuses consistent, WCAG-compliant dialogs, popovers, tabs, forms, and buttons.
2. **Phase 2: App Shell, Navigation & Route Resilience (P0-P1)**  
   Fix tablet/collapsed sidebar layout bugs, upgrade `CommandMenu` and notifications to accessible Radix/`cmdk` primitives, establish consistent branding, and add route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` boundaries.
3. **Phase 3: Core Pipeline Workflows (Dashboard, Jobs, Shortlist, Applications) (P1)**  
   Fix filter persistence, refine Kanban (`DragOverlay`, `KeyboardSensor`, collapsible terminal lanes) and Table (`aria-sort`, directional indicators, single Export action), refocus Dashboard away from Analytics duplication, and upgrade Shortlist comparison.
4. **Phase 4: Dedicated Assessments & Offers Views + Application Detail Refactor (P1-P2)**  
   Fix the critical UTC/timezone calendar bug in `/interviews`, promote Assessments and Offers to dedicated navigable workflows (`/assessments` with edit support, `/offers` with comparison matrix), and split the 1,914-line `ApplicationDetailClient` into maintainable tab modules.
5. **Phase 5: Secondary Workspaces, Data Viz & Final Polish (P2-P3)**  
   Upgrade Email Center (confirmations, master-detail inbox), Document Repository (Radix preview dialog, `.docx` fallback, collapsible version history), Analytics (dark-mode Recharts theme, accessible palette, sortable company table), Settings (tabbed layout, stage editor, weight sum check), and Auth ergonomics.

---

## 2. Detailed Implementation Phases

### Phase 1: Design Tokens, Typography & UI Primitive Layer (P0)

**Objective:** Eliminate color/token drift, fix dark-mode contrast, and replace hand-rolled modals/inputs with Radix UI primitives.

- **1.1 Token & CSS Consolidation (`src/app/globals.css`, `src/app/layout.tsx`)**
  - Unify `--primary`, `--accent`, `--border`, and `--muted` tokens so `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-destructive`, and focus rings reference CSS variables instead of conflicting hardcoded hexes (`#08945f`, `#e2e8f0`, `#727973`).
  - Phase out the `@theme inline` `indigo-*` / `violet-*` / `purple-*` / `zinc-*` remapping shim after migrating affected classes, and fix invalid classes (`bg-[#c0edcf]/60/60`, `dark:border-[#B7C4FF]`, leftover `slate-*`).
  - Standardize base workspace typography to `14px` body (`text-body-md`) with `12px-13px` reserved for metadata/labels rather than wrapping whole screens in `text-xs`.
  - Switch `Plus Jakarta Sans` / `Inter` loading to `next/font/google` (or local `geist/font` primary) so offline local-first environments remain crisp without lint suppression.
- **1.2 Shared Accessible Primitives (`src/components/ui/`)**
  - `button.tsx`: Variant/size system via `class-variance-authority` (`primary`, `secondary`, `ghost`, `destructive`; sizes `sm`, `md`, `lg`, `icon`) with unified `h-9` / `h-10` heights.
  - `dialog.tsx` & `alert-dialog.tsx`: Built on `radix-ui` `Dialog` / `AlertDialog` with backdrop blur, focus trap, Escape/backdrop close, and `aria-labelledby`. Replaces `window.confirm()` and raw `fixed inset-0` modals.
  - `popover.tsx` & `tabs.tsx`: Built on `radix-ui` `Popover` and `Tabs` for notifications, filter popovers, and tabbed workspaces.
  - `form-field.tsx`: Wrapper generating stable `id` / `htmlFor` / `aria-describedby` bindings for labels, inputs, selects, and inline error messages, plus consistent dark-mode text color (`dark:text-[#ecf3eb]`).
  - `empty-state.tsx`: Standardized empty-state card with icon, heading, helper text, and primary CTA slot.
- **Exit Criteria:** Zero `window.confirm()` calls; zero unbound `<label>` elements in shared forms; all dialogs trap focus and close on `Escape`; WCAG AA contrast verified in both light and dark modes.

---

### Phase 2: App Shell, Navigation Architecture & Async Boundaries (P0-P1)

**Objective:** Fix responsive shell defects, modernize command search, and guarantee safe loading/error states across every route.

- **2.1 Sidebar & Header Fixes (`src/components/layout/app-sidebar.tsx`, `src/components/layout/app-shell.tsx`)**
  - Fix collapsed (`72px`) sidebar footer overflow by stacking or using an icon-only Sign Out button with tooltip below the avatar.
  - Enable the collapse/expand toggle on `md` viewports (`768px-1279px`) instead of locking tablets into a `72px` un-expandable rail.
  - Remove dead `phaseBadge` branch in `AppSidebar` and unify product naming (`Trackr ATS` / `Career Application Tracker`) across header, metadata, and auth.
  - Convert top-bar notifications panel to `radix-ui` `Popover` with outside-click/Escape handling and `try/catch` feedback on dismissal.
  - Add a visible-on-focus `"Skip to main content"` link in `AppShell` and deduplicate global vs page-level `"Add Job"` / `"Log Application"` primary CTAs.
- **2.2 Accessible Command Palette (`src/components/layout/command-menu.tsx`)**
  - Rebuild using `cmdk` inside `radix-ui` `Dialog` for full keyboard arrow navigation (`ArrowUp`/`ArrowDown`/`Enter`), screen-reader announcements, and automatic result clearing when query is empty.
- **2.3 Route Loading, Error, and Empty Boundaries (`src/app/(app)/`)**
  - Add `src/app/(app)/loading.tsx` (and route-specific skeletons for Dashboard, Kanban/Table, and Analytics), `src/app/(app)/error.tsx` (with retry button), and `src/app/not-found.tsx`.
  - Add `try/catch` error handling and per-item pending indicators across all mutation handlers.
- **Exit Criteria:** Tablet (`768px-1279px`) sidebar expands/collapses cleanly without footer clipping; `Cmd+K` supports full keyboard-only navigation; simulated server errors render `error.tsx` gracefully.

---

### Phase 3: Core Pipeline Workflows (Dashboard, Jobs, Shortlist, Applications) (P1)

**Objective:** Optimize daily job search and pipeline management workflows for speed, clarity, and persistence.

- **3.1 Dashboard Refocus (`src/components/dashboard/dashboard-client.tsx`)**
  - Replace mobile horizontal-scroll KPI strip with a `grid-cols-2 md:grid-cols-2 xl:grid-cols-4` layout so all 4 primary KPIs are visible without hidden overflow.
  - Add visual dropdown chevron affordance to the `searchStatus` selector in the Welcome header.
  - Make pipeline stage bars clickable links into `/applications?stageId=...`.
  - Trim the bottom duplicated analytics wall (keep a concise summary or single trend widget linking to `/analytics`) to keep Dashboard focused on immediate actions (interviews, overdue follow-ups, recent activity).
- **3.2 Job Discovery & Suitability (`src/components/jobs/*`)**
  - Persist `/jobs` search, triage, priority, source, work arrangement, and sort state in URL query parameters (`useSearchParams`), and add a `"Reset Filters"` action.
  - De-clutter vacancy cards (cap visible skill pills at 5 with `+N more`, unify `h-9` / `h-10` action controls).
  - Organize `VacancyForm` into clear collapsible/stepped sections with a sticky action bar and allow editing recruiter contact fields on existing vacancies.
  - In `SuitabilityPanel`, add numeric inputs paired with range sliders and a non-destructive preview/undo option when clicking `"Apply Profile Suggestions"`.
- **3.3 Job Shortlist (`src/components/jobs/shortlist-client.tsx`)**
  - Upgrade the 3-card comparison tray into an aligned attribute comparison matrix table (Salary, Work Arrangement, Location, Experience, Skills overlap, Deadline, Fit Score, plus direct Apply/Inspect buttons).
  - Add sort/search controls, an empty-state `"Browse Find Jobs"` CTA, and an undo toast on `Not Interested` / `Archive`.
- **3.4 Applications Board, Table & Submission Modals (`src/components/applications/*`)**
  - Sync `/applications` filters to URL query parameters and add a `"Clear Filters"` button + active filter badge count.
  - In `KanbanBoard`: add a `"Show/Hide Closed Stages"` toggle so terminal columns (`Rejected`, `Withdrawn`, `No Response`) don't force 4,200px horizontal scrolling during active daily triage; add `<DragOverlay>` and `KeyboardSensor`; pre-select target context when clicking a column `+` quick-add button.
  - In `ApplicationsTable`: remove duplicate `"Export CSV"` button, add `aria-sort` + directional sort arrows (`ArrowUp`/`ArrowDown`), sticky first column (`App ID` / `Company`), and a row quick-actions menu (`View`, `Move Stage`, `Delete`).
  - Migrate `RecordSubmissionDialog` and `MoveStageDialog` to Radix `Dialog`, connect `RecordSubmissionDialog` CV selection to actual uploaded versions in `/documents` (with custom label fallback), and initialize `MoveStageDialog` `effectiveOn` in the user's configured timezone.
- **Exit Criteria:** Filters survive navigation to detail pages and back; Kanban cards drag smoothly with keyboard and pointer via `DragOverlay`; table sorting passes `aria-sort` checks; `RecordSubmissionDialog` links real document versions.

---

### Phase 4: Interviews Timezone Fix, Dedicated Assessments & Offers, Application Detail Split (P1-P2)

**Objective:** Resolve the critical calendar timezone bug, expose hidden Assessments and Offers workflows as first-class screens, and refactor the Application Detail monolith.

- **4.1 Interviews Calendar Fix & Mobile Agenda (`src/components/interviews/interviews-client.tsx`, `src/app/(app)/interviews/page.tsx`)**
  - Fix UTC vs user-timezone mismatch: bucket calendar events by `data.timezone` calendar date instead of `toISOString().slice(0, 10)`, format/parse `datetime-local` values in `data.timezone`, and remove the misleading `"Date & Time (UTC)"` label.
  - Fix `"Current Month"` button to jump to actual today's month (and offer `"Jump to Next Interview"` separately).
  - Add a responsive mobile Agenda/List view below `md` instead of squeezing a 7-column grid onto 375px screens.
  - Move `"Schedule Interview"` from a full tab into a Radix `Dialog` / `Sheet` so users keep calendar context.
- **4.2 Dedicated Assessments Screen (`src/app/(app)/assessments/page.tsx`, `src/components/assessments/`, `src/components/layout/app-sidebar.tsx`)**
  - Extract Assessments from `/interviews` Tab 3 into a dedicated `/assessments` route under `Pipeline Management` in `AppSidebar` (retaining a summary badge/link on `/interviews` if helpful).
  - Add full **Edit Assessment** support (update score, max score, result, due date, and notes), status/result filtering, numeric score validation, and `AlertDialog` delete confirmation.
- **4.3 Dedicated Offers & Comparison Screen (`src/app/(app)/offers/page.tsx`, `src/components/offers/`, `src/components/layout/app-sidebar.tsx`)**
  - Add a dedicated `/offers` route under `Pipeline Management` displaying all recorded job offers, pending response deadline alerts, structured compensation summary, and side-by-side Offer Comparison across competing offers.
  - Fix `ApplicationOfferTab` default `offerReceivedOn` from `app.submittedOn` to today's date in user timezone, and add an executive summary view above/alongside the edit form.
- **4.4 Application Detail Modularization (`src/components/applications/application-detail-client.tsx`)**
  - Split the 1,914-line file into focused tab components (`OverviewTab`, `TimelineTab`, `CommunicationsTab`, `InterviewsTab`, `FollowUpsTab`, `DocumentsTab`, `OfferTab`) wrapped in Radix `Tabs`.
  - Add read-only summary vs edit mode in `OverviewTab`, remove stale `"arrives in Phase 3"` copy, unify interview editing with `/interviews`, and add edit/delete support for logged communications and follow-up tasks.
- **Exit Criteria:** Interviews scheduled in `Asia/Jakarta` (or any timezone) appear on the exact local date in the calendar; Assessments can be created, edited, filtered, and safely deleted at `/assessments`; competing offers can be compared side by side at `/offers`.

---

### Phase 5: Secondary Workspaces, Analytics Visualizations & Polish (P2-P3)

**Objective:** Refine Email Center, Document Repository, Analytics, Settings, and Auth screens for executive polish and consistency.

- **5.1 Email Center (`src/components/emails/email-center-client.tsx`)**
  - Add `AlertDialog` confirmations for disconnecting email accounts and deleting recruiter contacts.
  - Add copy-to-clipboard buttons on OAuth Redirect URIs in the setup guide.
  - Upgrade Recruitment Inbox from stacked full-width cards to a responsive master-detail split pane (`message list` + `classification & linking inspector`) with bulk ignore/archive actions.
- **5.2 Document Repository (`src/components/documents/documents-client.tsx`)**
  - Move Upload / Add Version into a Radix `Dialog` with drag-and-drop dropzone and file-size indicator.
  - Upgrade Document Preview modal to Radix `Dialog`, add a clean unsupported-preview card for `.docx` files (with Download CTA) instead of a broken `<iframe>`, show latest version prominently with collapsible older versions, and move `sha256` hashes behind a subtle metadata tooltip.
- **5.3 Analytics (`src/components/analytics/analytics-client.tsx`)**
  - Consolidate the 17 top KPI cards into scannable summary strips so primary funnel and trend charts appear closer to the fold.
  - Theme Recharts `<Tooltip />`, `<CartesianGrid />`, and axes using CSS variables so dark mode renders legibly; replace the 4-bar emerald/brown palette with a high-contrast, color-vision-safe categorical palette; expand `YAxis width` dynamically for long platform names; add `role="img"` / accessible summaries.
  - Add quick date-range presets (`30d`, `90d`, `YTD`, `All`) and sortable columns on the Company Response Rates table.
- **5.4 Settings & Auth (`src/components/settings/settings-client.tsx`, `src/app/(auth)/*`)**
  - Convert the 6-section vertical Settings scroll into Radix `Tabs` (`Profile & Preferences`, `Pipeline Stages`, `Follow-up Rules`, `Suitability Weights`, `Sample Data & Privacy`) with unsaved-changes warnings.
  - Add live sum validation (`Total: 100%`) to Suitability Weights, a structured date chip/tag editor for Public Holidays, visual color swatches + rename/delete support for custom stages, and a Radix `AlertDialog` for account deletion.
  - On `/sign-in` and `/sign-up`, add Show/Hide password toggles, live password length check on sign-up, and a compact collapsible UU PDP privacy summary.
- **Exit Criteria:** Dark mode Recharts tooltips and axes pass contrast checks; `.docx` preview shows clear fallback; Settings sections are tabbed with live weight/holiday validation; full Playwright E2E and Vitest suites pass.

---

## 3. Quick Wins vs. Structural Refactors

| Category | Work Items | Effort | Impact |
| :--- | :--- | :--- | :--- |
| **Quick Wins (1-2 days)** | Fix invalid CSS (`bg-[#c0edcf]/60/60`), dark-mode `text-[#3f674f]` & input text colors, `MoveStageDialog` local date default, `ApplicationOfferTab` `offerReceivedOn` default, stale Phase 3 copy, icon button `aria-label`s, calendar UTC bug fix | Low | High |
| **Medium Refactors (3-5 days)** | Build `src/components/ui/` Radix primitives (`Dialog`, `AlertDialog`, `Tabs`, `Popover`, `Button`, `FormField`); upgrade `CommandMenu` with `cmdk`; fix `AppSidebar` tablet & collapsed footer; add `loading.tsx`/`error.tsx`/`not-found.tsx`; URL-sync `/jobs` and `/applications` filters | Medium | High |
| **Structural Enhancements (1-2 weeks)** | Extract `/assessments` and `/offers` routes; split 1,914-line `ApplicationDetailClient`; refactor Kanban (`DragOverlay`, collapsible terminal lanes); upgrade Email Center split-pane, Shortlist comparison matrix, Tabbed Settings, and Recharts theming | High | High |

---

## 4. Proposed Implementation Order (Summary)

1. **Step 1 (Phase 1):** Consolidate `globals.css` design tokens, fix dark-mode contrast, and create `src/components/ui/` primitives (`Button`, `Dialog`, `AlertDialog`, `Popover`, `Tabs`, `FormField`, `EmptyState`).
2. **Step 2 (Phase 2):** Refactor `AppSidebar`, `AppShell`, and `CommandMenu` (`cmdk`); add `loading.tsx`, `error.tsx`, and `not-found.tsx`.
3. **Step 3 (Phase 3):** Refactor `DashboardClient` density/mobile KPIs; add URL-persisted filters and UI improvements to `/jobs`, `/shortlist`, and `/applications` (Kanban + Table + `RecordSubmissionDialog` + `MoveStageDialog`).
4. **Step 4 (Phase 4):** Fix `/interviews` timezone bug & mobile agenda; create `/assessments` (with full edit) and `/offers` (with comparison matrix); split `ApplicationDetailClient` into modular tabs.
5. **Step 5 (Phase 5):** Upgrade `EmailCenterClient`, `DocumentsClient`, `AnalyticsClient` (Recharts dark mode & accessible palette), `SettingsClient` (tabbed layout & validators), and Auth forms.
6. **Step 6 (Verification):** Run TypeScript (`npm run typecheck`), ESLint (`npm run lint`), unit tests (`npm test`), Playwright E2E (`npm run test:e2e`), plus keyboard-only and light/dark responsive visual checks across all 14+ routes.
