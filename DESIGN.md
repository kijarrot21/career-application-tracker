---
name: Executive Precision
colors:
  surface: '#fbf8ff'
  surface-dim: '#d9d9e6'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ededfb'
  surface-container-high: '#e7e7f5'
  surface-container-highest: '#e1e1ef'
  on-surface: '#191b25'
  on-surface-variant: '#444654'
  inverse-surface: '#2e303a'
  inverse-on-surface: '#f0effd'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2751d8'
  primary: '#0034ae'
  on-primary: '#ffffff'
  primary-container: '#204cd3'
  on-primary-container: '#c6cfff'
  inverse-primary: '#b7c4ff'
  secondary: '#485aa2'
  on-secondary: '#ffffff'
  secondary-container: '#9daffe'
  on-secondary-container: '#2d4087'
  tertiary: '#7a2500'
  on-tertiary: '#ffffff'
  tertiary-container: '#a23400'
  on-tertiary-container: '#ffc4b0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#0038b8'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#001453'
  on-secondary-fixed-variant: '#2f4288'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#380c00'
  on-tertiary-fixed-variant: '#822800'
  background: '#fbf8ff'
  on-background: '#191b25'
  surface-variant: '#e1e1ef'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-num:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

# Executive Precision Design System

## Brand & Style

This design system delivers an executive-grade personal career command center. It balances the analytical rigor of an enterprise CRM with the calm clarity and tactile efficiency of an elite personal productivity tool.

- **Brand Personality**: Disciplined, forward-thinking, empowering, and organized. It avoids frivolous gamification in favor of structural clarity, quiet confidence, and tactile responsiveness.
- **Target Audience**: Mid-to-senior knowledge workers, engineering leads, product directors, and domain specialists navigating multi-stage hiring funnels who require commanding control over pipeline stages, correspondence, offer models, and technical cycles.
- **Emotional Response**: Grounded control, reduced cognitive fatigue during high-stakes job transitions, steady momentum, and acute professional agency.
- **Design Style**: Modern Precision SaaS. High-density information architecture balanced by crisp neutral surfaces, deliberate 1px structural borders, muted tonal badges, and high-impact accents powered by electric royal blue (`#204CD3`) for decisive primary actions and active navigation states.

## Colors

The color palette centers on a crisp slate neutral foundation paired with an electric royal blue (`#204CD3`) primary anchor and clear semantic status beacons.

- **Primary Interactive Anchor**:
  - Primary Accent (`#204CD3`): Primary CTAs, active tab underlines, key action buttons, and focused component halos.
  - Primary Container / Soft Surface (`#EEF2FF`): Selected navigation states, applied stage pills, and highlighted data rows.
  - Primary Text On-Soft (`#1D4ED8`): Text and iconography rendered on electric blue tinted backgrounds.
- **Foundational Neutral Surfaces**:
  - Main Canvas (`#F8FAFC`): Provides clean, glare-free baseline contrast against intense data densities.
  - Surface Containers & Cards (`#FFFFFF`): Elevated panels, data tables, and kanban lane backgrounds.
  - Surface Subdued (`#F1F5F9`): Kanban column tracks, search field resting surfaces, and inactive hover states.
- **Structural Ink & Typography**:
  - Ink Primary (`#0F172A`): Primary headings, metrics, and high-emphasis text.
  - Ink Secondary (`#334155`): Secondary body, table headers, and breadcrumbs.
  - Ink Muted (`#64748B`): Timestamps, inactive tabs, and field labels.
  - Borders & Dividers (`#E2E8F0`): Crisp 1px separations; active borders shift to `#CBD5E1`.
- **Accents & Semantics**:
  - Stage: Applied / Initial Contact (`#204CD3`): Uses `#EEF2FF` background with `#1D4ED8` text and a solid `#204CD3` indicator dot.
  - Stage: Active Interview / Offer (`#10B981`): Emerald green applied on `#ECFDF5` background with `#047857` text.
  - Stage: In Review / Lead (`#F59E0B`): Amber applied on `#FFFBEB` background with `#B45309` text.
  - Stage: Archived / Rejection (`#F43F5E`): Rose applied on `#FFF1F2` background with `#BE123C` text.

## Typography

The typographic hierarchy balances the structural poise of **Plus Jakarta Sans** for headlines and high-value numerical metrics with the pragmatic, utilitarian readability of **Inter** for dense UI data, metadata, forms, and table rows.

- **Tabular Figures**: All metric cards, salary values, dates, time markers, and interview counters must enforce `font-variant-numeric: tabular-nums` to maintain precise vertical baseline alignment across dense cards and lists.
- **Letter Spacing**: Display and large headlines carry subtle negative tracking (`-0.015em` to `-0.03em`) for a disciplined editorial posture. Micro-labels and status badges use deliberate positive tracking (`+0.02em` to `+0.04em`) with semibold weights to ensure crisp legibility at small sizes.
- **Hierarchy Rules**: Primary headers do not exceed 36px on desktop to maintain SaaS information density. Interactive cards lean on 14px and 13px body text to preserve compact vertical rhythms.

## Layout & Spacing

The dashboard employs a fluid, multi-pane SaaS framework configured with a fixed collapsible global navigation sidebar (64px collapsed, 240px expanded) and a responsive fluid content stage.

- **Grid Systems**:
  - **Metrics Tier**: 4-column fluid auto-fit grid (`minmax(220px, 1fr)`) separated by `gutter-desktop` (1.5rem / 24px).
  - **Pipeline Stage / Kanban View**: Horizontal swipe-scroll or multi-column flex grid with fixed column widths (`280px` minimum to `340px` maximum) with `1rem` (16px) gutters.
  - **Split Details View**: 60/40 split pane when inspecting an applicant item (primary kanban/list on the left, full contextual profile drawer on the right).
- **Responsive Adaptations**:
  - **Desktop (1280px+)**: Multi-lane board fully visible; expanded sidebar; sticky action bars with `margin-desktop` (2rem / 32px) page gutters.
  - **Tablet (768px - 1279px)**: Horizontal snap-scrolling Kanban columns; metrics collapse into a 2x2 grid; collapsed icon-only sidebar.
  - **Mobile (<768px)**: Kanban lanes convert to a segmented-control single-lane view; metrics collapse to a horizontal scroll deck; canvas margins compress to `margin` (1rem / 16px).

## Elevation & Depth

Visual hierarchy uses a refined blend of **1px structural borders** and **whisper-light ambient shadows** to keep the interface crisp, lightweight, and performant.

- **Base Layer (Elevation 0)**:
  - Canvas background (`#F8FAFC`). No shadow, no outline.
- **Board Lanes & Metric Shells (Elevation 1)**:
  - Surface white (`#FFFFFF`) with a 1px solid border in `#E2E8F0`. Shadow: `0 1px 2px 0 rgba(11, 28, 48, 0.04)`.
- **Interactive Job Cards (Elevation 2)**:
  - Surface white (`#FFFFFF`) with 1px border in `#E2E8F0`.
  - Resting shadow: `0 1px 3px 0 rgba(11, 28, 48, 0.05), 0 1px 2px -1px rgba(11, 28, 48, 0.05)`.
  - Hover shadow: `0 4px 6px -1px rgba(11, 28, 48, 0.08), 0 2px 4px -2px rgba(11, 28, 48, 0.04)`; border shifts to `#CBD5E1`.
- **Drag-and-Drop Active State (Elevation 3)**:
  - When dragging cards across kanban columns: card scales to 1.02x, shadow deepens to `0 12px 24px -4px rgba(32, 76, 211, 0.16), 0 4px 6px -2px rgba(11, 28, 48, 0.04)`, border shifts directly to electric royal blue (`#204CD3`).
- **Flyout Drawers & Modals (Elevation 4)**:
  - Side panel candidate drawers: `0 20px 25px -5px rgba(11, 28, 48, 0.12), 0 8px 10px -6px rgba(11, 28, 48, 0.06)`, flanked by a subtle `#0B1C30` backdrop mask at 20% opacity.

## Shapes

The design system maintains geometric precision with clean, compact curvature (`roundedness: 1`).

- **Controls & Micro Elements**: Buttons, text inputs, search fields, and metric cards use `rounded-sm` (0.25rem / 4px).
- **Surface Containers & Cards**: Job cards, kanban track columns, and flyout containers adopt `rounded` (0.5rem / 8px).
- **Status Tags & Pill Badges**: Stage pills, salary tags, and counter chips use complete circular pills (`rounded-full` / 9999px) to contrast against rectangular cards.
- **Nested Inner Geometry**: Containers with inner padding host elements whose radii inherit a proportionate reduction (`inner radius = outer radius - padding`) to ensure visual cohesion across borders.

## Components

### Buttons
- **Primary**: Solid electric royal blue (`#204CD3`), white text, 4px radius (`rounded-sm`), semibold weight. Subtle active scale (`0.98`). Hover: `#1D4ED8`. Focus-visible: 2px ring in `#204CD3` with 2px canvas offset.
- **Secondary**: Surface `#FFFFFF`, border 1px solid `#CBD5E1`, text `#0F172A`. Hover: `#F8FAFC`, border `#94A3B8`.
- **Ghost / Icon**: Transparent background, text `#64748B`. Hover: `#EEF2FF`, text `#204CD3`.

### Stage Pill Badges
- Compact pill-shaped containers (`padding: 2px 10px`, `label-sm` font, `rounded-full`).
- **Applied**: `#EEF2FF` fill, `#1D4ED8` text, dot accent `#204CD3`.
- **Interviewing**: `#ECFDF5` fill, `#047857` text, dot accent `#10B981`.
- **Review**: `#FFFBEB` fill, `#B45309` text, dot accent `#F59E0B`.
- **Rejected**: `#FFF1F2` fill, `#BE123C` text, dot accent `#F43F5E`.

### Kanban Column
- Track shell: Background `#F1F5F9`, border 1px solid `#E2E8F0`, 8px border-radius (`rounded`), `padding: 12px`.
- Column Header: Features stage name, total item count chip (`#E2E8F0` badge), and quick-add ghost button with electric blue hover.

### Job Card Component
- Container: `#FFFFFF` fill, 1px `#E2E8F0` border, 8px border-radius, `padding: 14px`.
- Structure:
  - Top row: Company avatar/favicon (24x24px rounded-sm) + Company Name (`body-sm`, bold) + Date Added.
  - Middle row: Target Role (`headline-sm`, 1-line truncation) + Compensation label (`$160k - $185k`, tabular text).
  - Bottom row: Status Pill Badge (left-aligned) + Interview step pill or pending task icon (right-aligned).
- Active / Drag State: Electric royal blue border (`#204CD3`) with elevated halo shadow.

### Metric / KPI Tile
- Surface: `#FFFFFF`, 1px `#E2E8F0` border, 8px border-radius, `padding: 16px`.
- Layout: Top subtitle label (`label-md`, uppercase `#64748B`), middle metric counter (`metric-num`, `#0F172A`), bottom trend indicator (`+12% this week` in `#10B981` or active milestone counter in `#204CD3`).

### Input Fields & Search
- Container: Surface `#FFFFFF` or `#F8FAFC` at rest, border 1px `#CBD5E1`, height 40px, 4px radius.
- Leading icon slot (16px magnifier or filter icon in `#94A3B8`). Focus state smoothly transitions border to `#204CD3` with a 3px soft tint ring (`rgba(32, 76, 211, 0.15)`).

### Checkboxes & Radio Buttons
- Selected State: Solid `#204CD3` fill with white checkmark/radio dot. Focus state displays a 2px offset ring in `#204CD3`.
- Unselected State: 1px border `#CBD5E1` on `#FFFFFF` background.
