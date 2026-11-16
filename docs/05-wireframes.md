# 05. UI/UX Wireframes

## Visual System
- **Inspiration**: Linear, Notion, Airtable, modern HR ATS platforms.
- **Typography**: Geist Sans for interface, Geist Mono for IDs (`JOB-0001`, `APP-0001`), dates, and metrics.
- **Surfaces**: Neutral zinc palette with subtle 1px borders and a restrained indigo accent.
- **Navigation**: Left sidebar on desktop, collapsible icon rail on tablet, slide-over drawer on mobile, plus a global `Cmd+K` / `Ctrl+K` command search palette.

## 1. Dashboard (`/dashboard`)
```
+-----------------------------------------------------------------------+
| Welcome back, Candidate        [Status: Actively searching v]         |
| [+ Add Job Vacancy]  [+ Log Application]  [View Shortlist]            |
+-----------------+-----------------+-----------------+-----------------+
| Total Submitted | Active Pipeline | Interviews      | Offers Received |
| 12              | 7               | 2 scheduled     | 1               |
+-----------------+-----------------+-----------------+-----------------+
| Recruitment Pipeline              | Upcoming Interviews               |
|  Applied        [========] 4      |  Thu 19 Nov, 10:00 WIB            |
|  CV Screening   [====]     2      |  HR Interview - Tokopedia         |
|  HR Interview   [==]       1      +-----------------------------------+
|  User Interview [==]       1      | Pending Follow-ups                |
|  Offer          [==]       1      |  ! Overdue: Follow up with GoTo   |
+-----------------------------------+-----------------------------------+
| Application Activity   | Pipeline Conversion Funnel | Outcomes        |
+------------------------+----------------------------+-----------------+
```

## 2. Find Jobs (`/jobs`) & Job Detail (`/jobs/[id]`)
```
+-----------------------------------------------------------------------+
| Find Jobs                                        [+ Add Job Vacancy]  |
| [Search title, company, skill...] [Triage v] [Priority v] [Source v]  |
+-----------------------------------------------------------------------+
| JOB-0004  Senior Frontend Engineer                      Score: 86%    |
| PT Tokopedia  -  Jakarta (Hybrid)  -  IDR 25M - 35M/mo  [Shortlisted] |
| Source: LinkedIn   Deadline: 2026-12-01   [Evaluate] [Record Apply]   |
+-----------------------------------------------------------------------+
```

Job Detail includes a dedicated **Suitability Evaluation** card with sliders (0 to 100%) and profile-based suggestions for:
- Skills Compatibility
- Experience Compatibility
- Educational Requirements
- Salary Compatibility
- Location Compatibility
- Career Growth Potential

## 3. Job Shortlist (`/shortlist`)
Ranked view of `Interested` and `Shortlisted` vacancies sorted by suitability score and upcoming application deadlines, with side-by-side comparison and one-click **Record Submission**.

## 4. Applications (`/applications?view=board` & `/applications?view=table`)
```
+-----------------------------------------------------------------------+
| Applications     [Kanban Board | Data Table]   [Export CSV] [+ Log]   |
| [Search...] [Stage v] [Outcome v] [Platform v]                        |
+---------------+---------------+---------------+---------------+-------+
| Sourced (2)   | Interested(3) | Applied (3)   | Screening (2) | ...   |
| (Vacancies)   | (Vacancies)   | (Apps)        | (Apps)        |       |
| +-----------+ | +-----------+ | +-----------+ | +-----------+ |       |
| | JOB-0008  | | | JOB-0004  | | | APP-0001  | | | APP-0002  | |       |
| | Grab      | | | Tokopedia | | | GoTo      | | | Traveloka | |       |
| | 82% match | | | 88% match | | | 4d ago    | | | Move ->   | |       |
| +-----------+ | +-----------+ | +-----------+ | +-----------+ |       |
+---------------+---------------+---------------+---------------+-------+
```

## 5. Application Detail (`/applications/[id]`)
```
+-----------------------------------------------------------------------+
| APP-0002  Senior Product Engineer at Traveloka    [Stage: HR Int. v]  |
| Outcome: Active   Submitted: 2026-11-05 via LinkedIn   Attempt #1     |
+-----------------------------------------------------------------------+
| [Overview] [Timeline & History] [Communications] [Interviews] [Tasks] |
+-----------------------------------------------------------------------+
| Recruitment Stage History (Append-Only)                               |
|  * 2026-11-12  Moved CV Screening -> HR Interview (Manual)            |
|  * 2026-11-08  Moved Applied -> CV Screening (Confirmed from email)   |
|  * 2026-11-05  Application submitted via LinkedIn                     |
+-----------------------------------------------------------------------+
```
