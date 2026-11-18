# Phase 10: Security and Data Governance Architecture

> **Audit status (2026-11-18):** Verified against source in `src/`, `next.config.ts`, `package.json`, `.env.example`, `.github/workflows/ci.yml`, tests, and the Phase 11 defect register. Status labels are defined below. Capabilities that are only configured or planned are labeled as such.

## Status legend

| Label | Meaning |
|---|---|
| **COMPLETE** | Implemented in source and covered by passing tests or verified configuration |
| **PARTIAL** | Implemented in source, but operational, external, or organizational work remains |
| **BLOCKED** | Cannot be verified here (no credentials, no cloud target, or approval required) |
| **NOT TESTED** | Code or configuration exists, but no test or drill has been executed for it |
| **NOT IMPLEMENTED** | Described as a goal only; no source implementation exists |
| **ACCEPTED DEFERRAL** | Explicitly accepted by the owner and scheduled for a future phase |

---

## 1. Executive Summary

Career Application Tracker manages sensitive personal, financial, and professional data, including curriculum vitae (CVs), resumes, compensation expectations, job interview transcripts, recruiter contacts, and payment records.

This document specifies the technical architecture, security controls, privacy safeguards, and governance frameworks implemented across the application. The stated compliance targets are the **Indonesian Personal Data Protection Law (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi / UU PDP)** and international privacy frameworks (**GDPR / ISO 27001**). Alignment is **PARTIAL**: technical controls are in place, but formal certification, a DPO appointment, a DPIA, and an incident response drill have not been performed.

**Verification evidence (COMPLETE):** 125/125 Vitest tests and 4/4 Playwright E2E tests pass; `typecheck`, `lint`, `build`, and CI are green. Security defects DEF-11-001, DEF-11-002, and DEF-11-003 are fixed (section 10). Live payments, live AI providers, live cloud sync, PostgreSQL RLS, and backup drills are explicitly **not** implemented or tested.

---

## 2. Multi-Tenant Isolation and Server-Authoritative Architecture

**Status: COMPLETE (application layer). Database RLS: NOT IMPLEMENTED (DEF-11-006, ACCEPTED DEFERRAL).**

### 2.1 Server-Authoritative Identity Enforcement

- **No Client Identity Trust:** The client application is never trusted to supply `userId` as proof of authorization.
- Every protected API route, Server Action, and Route Handler resolves the caller's identity through cryptographically verified session cookies ([session.ts](../src/lib/session.ts)) or valid HMAC signed tokens.
- All service mutations (`recordSubmissionService`, `uploadOrVersionDocumentService`, `moveApplicationStageService`, `exportAccountJsonService`, `deleteUserAccountService`) mandate `userId: string` as their first parameter, populated solely by the server context.

### 2.2 Relational Isolation and Foreign Key Cascades

- All primary domain tables in the [schema](../src/db/schema) enforce foreign keys directly to the `user.id` primary key:
  ```ts
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ```
- Every query includes composite tenant scoping:
  ```ts
  and(eq(table.id, resourceId), eq(table.userId, authenticatedUserId))
  ```
- Cross user ID queries immediately return `404 Not Found` or `null` to avoid leaking resource existence to unauthorized actors.
- Cloud PostgreSQL row level security is **NOT IMPLEMENTED**. DEF-11-006 was accepted by the owner as a deferral to a future cloud hardening phase; isolation currently depends on application layer filters and composite foreign keys only.

---

## 3. Cryptographic Secret Management and Data at Rest

**Status: COMPLETE (AES-256-GCM, PKCE and HMAC state).**

### 3.1 Authenticated Encryption at Rest (AES-256-GCM)

Sensitive tokens (such as third party Google and Microsoft OAuth 2.0 refresh tokens) are encrypted before persisting to the database in [crypto.ts](../src/lib/crypto.ts):

- **Algorithm:** AES-256-GCM with a 256 bit derived key.
- **Initialization Vector:** Cryptographically secure random 96 bit (12 byte) IV per encryption.
- **Authentication Tag:** 128 bit authentication tag ensuring confidentiality and tamper resistance.
- **Wire Format:** `v1.<iv_base64url>.<tag_base64url>.<ciphertext_base64url>`.

### 3.2 Secure PKCE Flow for OAuth 2.0

OAuth authentication with Google and Microsoft Outlook uses Proof Key for Code Exchange (RFC 7636) with SHA-256 code challenges (`S256`) and cryptographically signed state parameters ([email-oauth.ts](../src/lib/email-oauth.ts)).

**DEF-11-001 fix (COMPLETE):** `verifyOAuthState` in `crypto.ts` now uses `timingSafeEqual` on equal length decoded buffers and rejects states older than 10 minutes (`OAUTH_STATE_TTL_MS = 600_000`), preventing timing side channels and replay. Live OAuth flows remain **BLOCKED** in this environment (no credentials).

---

## 4. Document Storage, Upload Pipeline, and Malware Defense

**Status: COMPLETE (validation, 413 pre check, baseline scanner). External scanner integrations: PARTIAL (hook only).**

### 4.1 Strict File Upload Validation ([storage.ts](../src/lib/storage.ts))

Uploaded files undergo validation before any disk write:

1. **Size Enforcement:** Maximum 10 MB (`MAX_DOCUMENT_BYTES = 10 * 1024 * 1024`). The upload route performs a `Content-Length` pre check and rejects oversized bodies with `413` before buffering (DEF-11-008).
2. **Magic Byte Verification:** File signatures are verified against binary bytes:
   - PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
   - PNG: `\x89PNG\r\n\x1a\n`
   - JPEG: `\xFF\xD8\xFF`
   - WebP: `RIFF....WEBP`
   - DOCX: `PK\x03\x04` container with a `.docx` extension
   - TXT / Markdown: null byte inspection and active HTML/SVG tag rejection (`<script>`, `<svg>`, `<iframe>`, `<!DOCTYPE html>`)
3. **Storage Path Traversal Protection:** Storage keys are sanitized, relative path segments (`..`) are rejected, and physical paths are asserted to stay inside `storage/documents/<safeUserId>/`.

### 4.2 Pluggable Malware Scanning Integration

The platform has a pre storage malware detection hook:

- **Default Baseline Scanner:** Detects the standard EICAR test signature and executable payloads (MZ DOS headers, ELF binaries, and Mach-O binaries) disguised as career documents. **COMPLETE.**
- **Pluggable Integration:** `registerMalwareScanner(scannerHook)` can attach ClamAV, VirusTotal, or a cloud sandbox. The hook exists, but no external scanner is configured or tested here. **PARTIAL.**
- When a scan detects threats, transactions are aborted and files are never written to disk.

---

## 5. Short-Lived Signed Download URLs

**Status: COMPLETE.**

Rather than exposing static, unprotected file paths or requiring session cookies for direct download links:

1. Users or services request a short lived download token via `getSignedDocumentUrlForUserService`:
   - URL: `/api/documents/download?token=<encodedPayload>.<hmacSignature>`
2. **Token Composition:**
   - `u`: authenticated `userId`
   - `v`: target `versionId`
   - `exp`: Unix timestamp (default lifetime 300 seconds / 5 minutes)
3. **Verification:** HMAC-SHA256 over the payload using the server encryption secret. The route handler ([download/route.ts](../src/app/api/documents/download/route.ts)) verifies token authenticity, expiry, and version ID matching before streaming the document buffer. `verifySignedDownloadToken` also uses constant time comparison (DEF-11-001).
4. **Download Headers:** `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache, no-store, must-revalidate`, and `Content-Disposition: attachment; filename="..."`.

---

## 6. AI Security, Privacy Modes, and Prompt Injection Defense

**Status: COMPLETE (prompt guard, PII redaction, consent gate). Live AI providers: BLOCKED / NOT TESTED.**

Uploaded resumes, cover letters, and job vacancy descriptions are untrusted external input. The AI subsystem ([prompt-guard.ts](../src/server/ai/security/prompt-guard.ts)) implements defenses against prompt injection and data exfiltration:

### 6.1 Injection Detection and Delimiter Breakout Neutralization

- **Signal Detection:** Scans for override commands (`ignore previous instructions`, role spoofing, `print system prompt`, `reveal api key`, `call function`).
- **Tag Neutralization:** XML delimiter tags (`<untrusted_data>`, `<system>`, `<developer>`) are neutralized to square bracket notation (`[untrusted_data]`).
- **Passive Data Wrapping:** Untrusted content is wrapped in `<untrusted_data label="...">` blocks.
- **System Directives:** AI models receive strict instructions that text inside `<untrusted_data>` is passive context and must never be treated as commands.

### 6.2 Data Minimization and PII Redaction

Before text is sent to a Cloud AI provider (Gemini / OpenAI), `minimizeCloudPii` filters it:

- Indonesian National Identity numbers (NIK / 16 digit KTP) are redacted to `[REDACTED_NIK]`.
- API keys (`sk-...`, `AIza...`, Bearer tokens) are redacted to `[REDACTED_API_KEY]`.

### 6.3 Explicit Cloud AI Consent Gate

- Career documents are never sent to Cloud AI without explicit user consent.
- Users configure consent in Workspace Settings (`aiCloudDocumentConsent`).
- AI analysis jobs store `containsPrivateDocuments`, `consentRequired`, `consentGranted`, and `consentGrantedAt` in `ai_analysis_jobs` for auditability.
- No career data is used for model training.

Live cloud AI providers are **BLOCKED** here (no keys consumed). Provider calls are **NOT TESTED** against live services.

---

## 7. Indonesian PDP Law (UU No. 27 Tahun 2022) Compliance

**Status: PARTIAL (technical articles COMPLETE; operational articles outstanding).**

| PDP Article | Legal Requirement | Technical and Operational Implementation | Status |
|---|---|---|---|
| **Art. 4** | Classification of Personal Data (General vs. Specific) | General (name, contact) and specific (financial or salary data, work evaluation) data segregated and protected. | **COMPLETE** |
| **Art. 7** | Right to Access and Data Portability | `exportAccountJsonService` provides a complete JSON export of profile, applications, archive, AI jobs, and audit logs. | **COMPLETE** |
| **Art. 8** | Right to Erasure or Deletion | `deleteUserAccountService` cascades database deletion and physically unlinks all files via `deleteUserStorageDir`. | **COMPLETE** |
| **Art. 12** | Right to Withdraw Consent | Users can toggle Cloud AI processing consent in Workspace Settings at any time. | **COMPLETE** |
| **Art. 16** | Lawful Basis and Explicit Consent | Explicit opt in is required before cloud AI processing; terms are accepted at sign up. | **COMPLETE** |
| **Art. 35** | Security and Technical Safeguards | AES-256-GCM encryption, TLS in transit (HSTS configured), HMAC download tokens, anti malware pipeline, global CSP. | **COMPLETE** |
| **Art. 36** | Security Incident and Breach Notification | Audit logs record exports, deletions, and access anomalies; an operational SOP for 72 hour notification is required. | **PARTIAL** (SOP and drill **NOT TESTED**) |
| **Art. 53** | Data Protection Officer (DPO) | Designation of a qualified DPO for organizational PDP governance. | **BLOCKED** (owner action) |

---

## 8. Backup, Disaster Recovery, and Data Retention

**Status: PARTIAL for retention and snapshots. NOT IMPLEMENTED / NOT TESTED for cloud backup options.**

1. **Configurable Retention Policy** ([archive.ts](../src/server/services/archive.ts)): users configure application archive retention periods (30 to 3,650 days); expiration status tracking (`active`, `expiring_soon`, `expired`); and on demand purging of expired records (`purgeExpiredArchivesService`). **COMPLETE.**
2. **Immutable Snapshots:** Archiving an application takes an immutable JSON snapshot with SHA-256 integrity verification; deleting live documents preserves historical snapshots. **COMPLETE.**
3. **Database Backup and Recovery:** Cloud PostgreSQL Point in Time Recovery (PITR), S3 compatible versioned object storage, and write once read many (WORM) policies are **future deployment options only**. No cloud backup, PITR, WORM, or restore drill has been implemented or tested in this repository. Local development uses embedded PGlite at `./.data/pglite`; see `docs/17-deployment-guide.md` for the data loss caution. **NOT IMPLEMENTED / NOT TESTED.**

---

## 9. Next Operational Steps and Open Items

| Item | Status | Note |
|---|---|---|
| DPO appointment | **BLOCKED** | Owner action; no DPO designated. |
| Data Protection Impact Assessment (DPIA) on CV evaluation | **NOT TESTED** | Formal assessment not performed. |
| Data Processing Agreements (Midtrans, Stripe, Google Cloud, OpenAI) | **BLOCKED** | No live providers in use; agreements not executed. |
| 72 hour incident response drill | **NOT TESTED** | Document and test the workflow before production. |
| PostgreSQL row level security (DEF-11-006) | **ACCEPTED DEFERRAL** | Deferred by owner to a future cloud hardening phase. |
| Backup and restore drill | **NOT TESTED** | See `docs/17-deployment-guide.md`. |

---

## 10. Verification Evidence and Defect Status

**Overall verification: COMPLETE for automated quality gates.**

- 125/125 Vitest tests pass; 4/4 Playwright E2E tests pass.
- `npm run typecheck`, `npm run lint`, `npm run build`, and GitHub Actions CI are green.

| Item | Status | Evidence |
|---|---|---|
| DEF-11-001: OAuth state timing safe comparison and 10 minute TTL | **FIXED / COMPLETE** | `timingSafeEqual` on decoded buffers plus timestamp TTL check in `src/lib/crypto.ts`; same hardening applied to signed download tokens. |
| DEF-11-002: CSP sandbox on inline document responses | **FIXED / COMPLETE** | `Content-Security-Policy: sandbox; default-src 'none'` in the document file route. |
| DEF-11-003: global Content Security Policy | **FIXED / COMPLETE** | Environment aware CSP in `next.config.ts`; verified in production headers via curl; E2E document preview and images pass. |
| DEF-11-008: 413 pre check and typed errors on upload | **FIXED / COMPLETE** | `Content-Length` pre check in the upload route; typed `DomainError`; generic 500 on unexpected errors. |
| DEF-11-006: PostgreSQL row level security | **ACCEPTED DEFERRAL** | Explicitly deferred by the owner; not implemented. |
