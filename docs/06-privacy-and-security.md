# 06. Privacy and Security

Career data (CVs, contact details, employment history, recruiter correspondence) is confidential personal data. This document describes how the application handles it, with reference to Indonesia's Personal Data Protection Law (UU No. 27 Tahun 2022, "UU PDP").

## Data Inventory
| Category | Examples | Where |
|---|---|---|
| Account | name, email, password hash | `user`, `account` |
| Profile | skills, years of experience, education level, salary expectation, preferred locations | `user_settings` |
| Recruitment records | vacancies, applications, stages, notes | `job_vacancies`, `applications`, `application_status_history` |
| Contacts | recruiter name, email, phone | `recruiter_contacts` |
| Correspondence | manual logs (Phase 2); email metadata and snippets (Phase 3) | `email_communications` |
| Documents (Phase 4) | CVs, certificates, offers | storage + `documents` |
| Audit | who changed what and when | `audit_logs` |

## Principles Applied
| UU PDP principle | Implementation |
|---|---|
| Lawful basis (consent) | The data subject is the user, who enters their own data. Third-party data (recruiter contacts) is limited to professional contact information. |
| Purpose limitation | Data is used only to track the user's own job search. No sharing, no advertising, no analytics beacons. |
| Data minimization | Phase 3 email sync stores subject, sender, date, snippet, and classification by default, not full bodies. OAuth scopes are read-only. |
| Accuracy | All records are editable; stage history keeps corrections visible. |
| Security | Password hashing (Better Auth, scrypt), httpOnly secure cookies, per-user isolation, composite foreign keys, Zod validation, security headers, encrypted OAuth tokens (AES-256-GCM, Phase 3), CSV formula-injection protection. |
| Data subject rights | Access and portability via JSON/CSV export; rectification via edit; erasure via account deletion (cascade). |
| Retention | Data is kept until the user deletes it. Sample data can be removed at any time. Recommended: delete or export closed searches after 24 months (configurable retention reminders planned in Phase 6). |
| Breach handling | For self-hosted deployments the operator must notify affected users within 72 hours per UU PDP Article 46. Keep audit logs and DB backups to support investigation. |

## Security Controls
- **Authentication**: Better Auth email/password, minimum 10-character password, built-in rate limiting on auth routes, database sessions.
- **Authorization**: every server query requires the session user id; there is no endpoint that takes a user id from the client.
- **Input validation**: Zod schemas on every server action and route handler; URLs must be http(s).
- **Output safety**: React escaping; no `dangerouslySetInnerHTML` with user content; CSV cells beginning with `= + - @` are prefixed.
- **Headers**: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Audit trail**: create, update, delete, stage change, export, and account deletion events in `audit_logs`, with sensitive fields redacted.
- **Secrets**: environment variables only. `.env*.local` and `.data/` are git-ignored.
