# 01. Requirements Analysis

## Product Summary
Career Application Tracker is a Personal Applicant Tracking System (ATS). It supports one job seeker across three objectives:

1. **Job Search and Discovery**: capture, organize, and evaluate vacancies before applying.
2. **Application Tracking**: record each submission and follow it through a standard HR recruitment pipeline with a complete audit trail.
3. **Result and Career Analytics**: measure outcomes and conversion using only real records.

## Personas
| Persona | Description | Primary needs |
|---|---|---|
| Active job seeker | Applying to 5 to 30 roles per month across LinkedIn, JobStreet, Glints, Kalibrr, career portals | One place for every application, reminders, honest metrics |
| Passive candidate | Occasionally evaluates opportunities | Shortlist, suitability scoring, low effort entry |

## Scope by Phase
| Phase | Module(s) | Status |
|---|---|---|
| 1 | Product design (this folder) | Done |
| 2 | Auth, Dashboard, Job Discovery, Shortlist, Applications (Kanban, Table, Detail), Pipeline, basic interviews, basic follow-ups, manual communication log, data export and deletion | Done |
| 3 | Gmail/Outlook OAuth, email classification, Email Center, follow-up sequences, notifications | Planned |
| 4 | Full interview module + calendar, assessments, offers, document repository | Planned |
| 5 | Analytics page, reports | Planned |
| 6 | Testing hardening, RLS, deployment | Planned |

## Requirement Traceability
| Requirement (prompt section) | Implementation | Phase |
|---|---|---|
| 2. 13-stage pipeline | `application_stages` seeded per user with `stage_type` | 2 |
| 2. Customizable stages | Settings > Pipeline (rename, recolor, reorder, add, hide) | 2 |
| 2. Skipped stages | Any forward move allowed; timeline shows skipped stages | 2 |
| 2. Complete status history | Append-only `application_status_history` | 2 |
| 2. Active / unsuccessful / successful | `applications.outcome` derived from stage type | 2 |
| 2. No auto-reject on silence | No Response is a user-confirmed suggestion only | 2 |
| A. Job discovery fields | `job_vacancies` (all listed fields) | 2 |
| A. Save from URL | Platform + external ID detection from URL, no scraping | 2 |
| A. Suitability 0 to 100% | `suitability_evaluations`, six weighted criteria | 2 |
| A. Interested / Shortlisted / Not Interested / Archived | `job_vacancies.triage_status` | 2 |
| B. Unique Application ID | `applications.code` (APP-0001) unique per user | 2 |
| B. Kanban drag-and-drop | dnd-kit board with history recording | 2 |
| B. Data table, filters, CSV | TanStack table, URL filters, CSV route | 2 |
| B. Application detail | Tabs: Overview, Timeline, Communications, Interviews, Follow-ups | 2 |
| C. Email integration | Manual log in Phase 2; OAuth in Phase 3 | 2 / 3 |
| D. External platform tracking | Platform, URL, external ref ID, confirmation ref, manual status | 2 |
| E. Interview management | Basic scheduling in Phase 2; full module in Phase 4 | 2 / 4 |
| F. KPIs and charts | Dashboard KPIs + 3 charts in Phase 2; full analytics in Phase 5 | 2 / 5 |
| 4. Follow-ups | Auto first follow-up, manual tasks, overdue flags | 2 / 3 |
| 5. Documents | Schema in Phase 1; module in Phase 4 | 4 |
| 6. Normalized DB, audit, duplicate prevention | Drizzle schema, composite FKs, partial unique index, `audit_logs` | 2 |
| 9. Security and privacy | Better Auth, per-user isolation, Zod validation, export, deletion | 2 |

## Key Assumptions
- An **application** exists only once a submission happens. Sourced and Interested are vacancy-level states.
- Times are stored in UTC and displayed in the user's timezone (default Asia/Jakarta).
- Money is stored in whole units of the selected currency (default IDR).
- External platforms (LinkedIn, JobStreet, etc.) are **not** accessed automatically. URLs are references only.

## Out of Scope (all phases)
- Automated submission to job platforms or scraping of logged-in pages.
- Sending emails on the user's behalf.
- AI-generated recruitment outcomes or synthetic analytics.

## Acceptance Criteria Map
| AC | Description | Phase | Verified by |
|---|---|---|---|
| 1 | Manage vacancies | 2 | E2E `core-journey`, integration `vacancies` |
| 2 | Record applications | 2 | E2E, integration `applications` |
| 3 | Stage moves | 2 | E2E board drag, integration `history` |
| 4 | Transition history | 2 | integration `history` |
| 5 | Kanban + Table | 2 | E2E |
| 6 | Emails linked | 3 (manual log in 2) | Phase 3 tests |
| 7 | Interview schedules | 2 basic / 4 full | integration |
| 8 | Follow-ups | 2 basic / 3 full | unit `follow-ups`, integration |
| 9 | Outcomes accurate | 2 | unit `stages`, `kpi` |
| 10 | Analytics from real records | 2 / 5 | unit `kpi`, sample exclusion test |
| 11 | Documents | 4 | Phase 4 tests |
| 12 | Responsive | 2 | E2E viewports |
| 13 | Isolation | 2 | integration `isolation` |
