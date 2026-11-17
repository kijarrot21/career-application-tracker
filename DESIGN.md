---
name: Career Application Tracker (Trackr ATS) Design System
version: 2.0.0
framework: Tailwind CSS v4 + Radix UI + Class Variance Authority
---

# Design System Specification

## 1. Design Direction

Career Application Tracker uses a professional productivity SaaS aesthetic tailored to personal career management:

- **Information Hierarchy (Linear-inspired):** Crisp 1px hairline borders, clear breadcrumb and page header structure, muted secondary metadata, and unambiguous primary calls to action.
- **Structured Workspace Simplicity (Notion-inspired):** Calm neutral canvas (`#f6f8f7` light / `#0b110e` dark) paired with elevated white/dark-pine cards (`#ffffff` / `#111915`) and subtle recessed wells (`#eef3ef` / `#141e19`).
- **Data Presentation (Stripe-inspired):** Tabular numeric alignment (`tabular-nums`), consistent metric cards, sortable data tables with `aria-sort` indicators, and theme-aware visualizations.
- **Practical ATS Workflows:** Stage status badges with dot indicators, Kanban cards, suitability gauges, and explicit confirmation dialogs for destructive actions.

---

## 2. Semantic Color Tokens (`src/app/globals.css`)

All components consume semantic CSS custom properties mapped via Tailwind CSS v4 `@theme inline`. Arbitrary hex values are disallowed inside feature modules.

### 2.1 Surfaces & Text

| Token | Light Mode | Dark Mode | Purpose |
| :--- | :--- | :--- | :--- |
| `--background` | `#f6f8f7` | `#0b110e` | Root application canvas |
| `--foreground` | `#111814` | `#ecf2ee` | Primary headings and body ink |
| `--surface` | `#f6f8f7` | `#0b110e` | Base shell surface |
| `--surface-subtle` | `#eef3ef` | `#141e19` | Recessed wells, table headers, Kanban lanes |
| `--surface-elevated` / `--card` | `#ffffff` | `#111915` | Cards, panels, modals |
| `--popover` | `#ffffff` | `#141e19` | Popovers, dropdowns, chart tooltips |
| `--muted` | `#eef3ef` | `#141e19` | Muted fills and pill backgrounds |
| `--muted-foreground` | `#4b5d52` | `#9cb0a3` | Secondary text, helper copy, table sub-labels |
| `--subtle-foreground` | `#687a6f` | `#788c7f` | Placeholders, inactive icons |

### 2.2 Brand, Secondary & Borders

| Token | Light Mode | Dark Mode | Purpose |
| :--- | :--- | :--- | :--- |
| `--primary` | `#006a42` | `#007a4d` | Primary buttons, active navigation, active tabs (WCAG AA contrast with `#ffffff`) |
| `--primary-hover` | `#005635` | `#00633e` | Primary hover state |
| `--primary-active` | `#00442a` | `#004e30` | Primary pressed state |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text/icons on `--primary` |
| `--primary-soft` | `#e3f4ea` | `rgba(0, 134, 85, 0.22)` | Soft highlights, active pills |
| `--primary-on-soft` | `#005232` | `#86f9ba` | High-contrast text on `--primary-soft` |
| `--primary-text` | `#006a42` | `#69dca0` | Inline links, active icons, metric accents |
| `--secondary` | `#eef3ef` | `#18241e` | Secondary fills and neutral badges |
| `--secondary-hover` | `#e2ebe5` | `#213129` | Secondary hover surface |
| `--secondary-foreground` | `#1f2d25` | `#dce8e0` | Secondary button and badge text |
| `--border` | `#d7e2db` | `#223229` | Standard 1px hairline borders |
| `--border-subtle` | `#e6eee9` | `#1a2720` | Internal dividers and row separators |
| `--border-strong` | `#b7c8bd` | `#334a3d` | Hover borders and emphasized containers |
| `--input` | `#ffffff` | `#141e19` | Form field background |
| `--input-border` | `#c5d4cb` | `#2a3d32` | Form field border |
| `--ring` | `#006a42` | `#34d399` | Keyboard focus ring |

### 2.3 Semantic Status

| Role | Solid | Soft Fill | Text on Soft | Border |
| :--- | :--- | :--- | :--- | :--- |
| **Destructive** | `--destructive` (`#dc2626`) | `--destructive-soft` | `--destructive-on-soft` | `--destructive-border` |
| **Success** | `--success` (`#059669` / `#10b981`) | `--success-soft` | `--success-on-soft` | `--success-border` |
| **Warning** | `--warning` (`#d97706` / `#f59e0b`) | `--warning-soft` | `--warning-on-soft` | `--warning-border` |
| **Information** | `--info` (`#0284c7` / `#38bdf8`) | `--info-soft` | `--info-on-soft` | `--info-border` |

---

## 3. Typography (`geist/font`)

Loaded offline-safe via `geist/font/sans` and `geist/font/mono` in `src/app/layout.tsx`.

| Role | Class | Size / Line Height | Weight | Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | `.text-display-lg` | `2.25rem` / `2.75rem` (desktop `3rem` / `3.5rem`) | `700` | `-0.025em` to `-0.03em` |
| **Page Title** | `.text-page-title` (`.text-headline-md`) | `1.5rem` (24px) / `2rem` | `600` | `-0.02em` |
| **Section Title** | `.text-section-title` (`.text-headline-sm`) | `1.0625rem` (17px) / `1.5rem` | `600` | `-0.015em` |
| **Card Title** | `.text-card-title` (`.text-title-md`) | `0.9375rem` (15px) / `1.375rem` | `600` | `-0.01em` |
| **Body** | `.text-body-md` (`body`) | `0.875rem` (14px) / `1.375rem` | `400` | `0` |
| **Secondary Text** | `.text-body-sm` | `0.8125rem` (13px) / `1.25rem` | `400` | `0` |
| **Caption** | `.text-caption` | `0.75rem` (12px) / `1.125rem` | `400` | `0.01em` |
| **Labels** | `.text-label-md` / `.text-label-sm` / `.text-label-xs` | `13px` / `12px` / `11px` | `500-600` | `0` to `0.05em` |
| **Numeric Data** | `.text-numeric` / `.text-metric-num` | `1.75rem` (28px) / `2rem` | `700` | `-0.02em` (`tabular-nums`) |

All numeric figures, tracking IDs (`JOB-0001`, `APP-0001`), dates, durations, and salary bands enforce `font-variant-numeric: tabular-nums`.

---

## 4. Spacing, Radius & Elevation

- **Border Radius:**
  - `rounded-md` (`0.375rem` / 6px): Compact buttons (`xs`), pills inside segments
  - `rounded-lg` (`0.5rem` / 8px): Standard `Button`, `Input`, `Select`, `Textarea`
  - `rounded-xl` (`0.75rem` / 12px): `Card`, `DataTable`, list items, dropdown menus
  - `rounded-2xl` (`1rem` / 16px): `Dialog`, `ConfirmDialog`, Kanban lanes, `Popover`
  - `rounded-full`: `Badge`, `StatusBadge`, avatars
- **Control Heights:**
  - `xs`: `h-7` (28px)
  - `sm`: `h-8` (32px)
  - `md`: `h-9` (36px, default)
  - `lg`: `h-10` (40px, primary toolbar & form actions)
  - `xl`: `h-11` / `h-12` (44px+, auth portals)
- **Elevation:**
  - `.elevation-0`: Flat canvas (`--background`)
  - `.elevation-1`: Static cards (`--shadow-xs`)
  - `.elevation-2`: Interactive cards (`--shadow-sm`, lifts to `--shadow-md` on hover)
  - `.elevation-3`: Active drag tile (`scale(1.015)` + `--shadow-md` + `--primary` border)
  - `.elevation-4`: Modals, popovers, dropdown menus (`--shadow-lg`)

---

## 5. Component Library (`src/components/ui/`)

All reusable UI components are exported from `src/components/ui/index.ts`:

| Component | File | Underlying Primitive / Notes |
| :--- | :--- | :--- |
| `Button`, `buttonVariants` | `button.tsx` | `cva` + `radix-ui` `Slot` (`asChild`), variants: `primary`, `secondary`, `ghost`, `warning`, `destructive`, `destructiveSolid`, `soft`, `outline`, `link`; explicit `#ffffff` text on solid primary/destructive actions |
| `Input`, `inputVariants` | `input.tsx` | Sizes `sm`-`xl`, tones `default` (cards/forms) / `subtle` (toolbars), `hasError` state |
| `Textarea`, `textareaVariants` | `textarea.tsx` | Sizes `sm`/`md`/`lg`, tones `default` (cards/forms) / `subtle` (toolbars), uniform border/hover/focus ring and `hasError` state |
| `Select`, `selectVariants` | `select.tsx` | Styled native `<select>` with custom chevron icon for full form and Playwright `selectOption` compatibility |
| `FormField` | `form-field.tsx` | `radix-ui` `Label` with automatic `id`/`htmlFor` wiring, required marker, hint, and alert error text |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `card.tsx` | `cva` variants for `elevation`, `tone`, and `padding` |
| `Badge`, `badgeVariants` | `badge.tsx` | Semantic variants: `default`, `primary`, `secondary`, `success`, `warning`, `destructive`, `info`, `outline` |
| `StatusBadge`, `StageBadge`, `OutcomeBadge`, `TriageBadge`, `PriorityBadge`, `SuitabilityBadge`, `SampleBadge` | `badges.tsx` | Stage-to-tone mapping with status dot indicators |
| `DataTable`, `DataTableContainer`, `DataTableRoot`, `DataTableHeader`, `DataTableBody`, `DataTableRow`, `DataTableHead`, `DataTableSortButton`, `DataTableCell` | `data-table.tsx` | Sortable headers with `aria-sort` and directional arrow icons, responsive scroll container |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `dialog.tsx` | `radix-ui` `Dialog` with focus trap, backdrop blur, Escape dismissal, and close button |
| `ConfirmDialog` | `confirm-dialog.tsx` | `radix-ui` `AlertDialog` replacing `window.confirm()` for destructive confirmations |
| `DropdownMenu` suite | `dropdown-menu.tsx` | `radix-ui` `DropdownMenu` |
| `Popover` suite | `popover.tsx` | `radix-ui` `Popover` |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `tabs.tsx` | `radix-ui` `Tabs` supporting `underline` and `segmented` variants |
| `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` | `tooltip.tsx` | `radix-ui` `Tooltip` (provider mounted in `ThemeProvider`) |
| `EmptyState`, `LoadingState`, `ErrorState` | `states.tsx` | Standardized async, empty, and alert error states (wired into `app/(app)/loading.tsx`, `error.tsx`, and `app/not-found.tsx`) |
| `PageHeader`, `SectionHeader` | `page-header.tsx` | Standardized breadcrumbs, page titles, badges, and action slots |

### Notes on Tailwind v4 Cascade & Class Merging
- Base element rules (`body`, headings, native field fallbacks) live in `@layer base` and `.btn-*` compatibility rules live in `@layer components` inside `src/app/globals.css` so Tailwind utilities always win cleanly.
- `cn()` in `src/lib/utils.ts` uses `extendTailwindMerge` with all custom typography tokens (`.text-body-sm`, `.text-card-title`, etc.) registered under `font-size` so combining them with semantic color classes (`text-white`, `text-primary-foreground`, `text-card-foreground`) never drops the text color.
