# Phase 10: Security and Data Governance Architecture

## 1. Executive Summary

Career Application Tracker manages sensitive personal, financial, and professional data, including curriculum vitae (CVs), resumes, compensation expectations, job interview transcripts, recruiter contacts, and payment records.

This document specifies the technical architecture, security controls, privacy safeguards, and governance frameworks implemented across the application to comply with the **Indonesian Personal Data Protection Law (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi / UU PDP)** and international privacy standards (**GDPR / ISO 27001**).

---

## 2. Multi-Tenant Isolation & Server-Authoritative Architecture

### 2.1 Server-Authoritative Identity Enforcement
- **No Client Identity Trust**: The client application is never trusted to supply `userId` as proof of authorization.
- Every protected API route, Server Action, and Route Handler resolves the caller's identity through cryptographically verified session cookies ([session.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/lib/session.ts)) or valid HMAC-signed tokens.
- All service mutations (`recordSubmissionService`, `uploadOrVersionDocumentService`, `moveApplicationStageService`, `exportAccountJsonService`, `deleteUserAccountService`) mandate `userId: string` as their first parameter, populated solely by the server context.

### 2.2 Relational Isolation & Foreign Key Cascades
- All primary domain tables in [schema](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/db/schema) enforce foreign keys directly to the `user.id` primary key:
  ```ts
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ```
- Every query includes composite tenant scoping:
  ```ts
  and(eq(table.id, resourceId), eq(table.userId, authenticatedUserId))
  ```
- Cross-user ID queries immediately return `404 Not Found` or `null` to avoid leaking resource existence to unauthorized actors.

---

## 3. Cryptographic Secret Management & Data at Rest

### 3.1 Authenticated Encryption at Rest (AES-256-GCM)
Sensitive tokens (such as third-party Google and Microsoft OAuth 2.0 refresh tokens) are encrypted before persisting to the database in [crypto.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/lib/crypto.ts):
- **Algorithm**: AES-256-GCM with a 256-bit derived key.
- **Initialization Vector**: Cryptographically secure random 96-bit (12-byte) IV per encryption.
- **Authentication Tag**: 128-bit authentication tag ensuring confidentiality and tamper resistance.
- **Wire Format**: `v1.<iv_base64url>.<tag_base64url>.<ciphertext_base64url>`.

### 3.2 Secure PKCE Flow for OAuth 2.0
OAuth authentication with Google and Microsoft Outlook utilizes Proof Key for Code Exchange (RFC 7636) with SHA-256 code challenges (`S256`) and cryptographically signed state parameters ([email-oauth.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/lib/email-oauth.ts)).

---

## 4. Document Storage, Upload Pipeline & Malware Defense

### 4.1 Strict File Upload Validation ([storage.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/lib/storage.ts))
Uploaded files undergo validation before any disk write:
1. **Size Enforcement**: Maximum 10 MB (`MAX_DOCUMENT_BYTES = 10 * 1024 * 1024`). Files exceeding this limit are rejected.
2. **Magic Byte Verification**: File extension headers are verified against binary signatures:
   - PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
   - PNG: `\x89PNG\r\n\x1a\n`
   - JPEG: `\xFF\xD8\xFF`
   - WebP: `RIFF....WEBP`
   - DOCX: `PK\x03\x04` container with `.docx` extension
   - TXT / Markdown: Null byte inspection and active HTML/SVG tag rejection (`<script>`, `<svg>`, `<iframe>`, `<!DOCTYPE html>`).
3. **Storage Path Traversal Protection**: Storage keys are sanitized, relative path segments (`..`) are rejected, and physical paths are asserted to stay strictly inside `storage/documents/<safeUserId>/`.

### 4.2 Pluggable Malware Scanning Integration
The platform incorporates a pre-storage malware detection hook:
- **Default Baseline Scanner**:
  - Detects standard EICAR antivirus test signatures.
  - Detects executable payloads (`MZ` DOS headers, ELF binaries, and Mach-O binaries) disguised as career documents.
- **Pluggable Integration**: Supports ClamAV daemon, VirusTotal API, or external cloud sandbox inspection via `registerMalwareScanner(scannerHook)`.
- If a scan detects threats, database transactions are aborted, files are never written to disk, and a security alert is triggered.

---

## 5. Short-Lived Signed Download URLs

Rather than exposing static, unprotected file paths or requiring session cookies for direct download links:
1. Users or services request a short-lived download token via `getSignedDocumentUrlForUserService`:
   - URL: `/api/documents/download?token=<encodedPayload>.<hmacSignature>`
2. **Token Composition**:
   - `u`: Authenticated `userId`
   - `v`: Target `versionId`
   - `exp`: Unix timestamp (default lifetime: 300 seconds / 5 minutes)
3. **Verification**:
   - HMAC-SHA256 signature calculated over the payload using the server's encryption secret.
   - Route handlers ([download/route.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/app/api/documents/download/route.ts)) verify token authenticity, expiry, and version ID matching before streaming the document buffer.
4. **Download Headers**:
   - `X-Content-Type-Options: nosniff`
   - `Cache-Control: private, no-cache, no-store, must-revalidate`
   - `Content-Disposition: attachment; filename="..."`

---

## 6. AI Security, Privacy Modes & Prompt Injection Defense

Uploaded resumes, cover letters, and job vacancy descriptions are untrusted external input. The AI subsystem ([prompt-guard.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/ai/security/prompt-guard.ts)) implements defenses against prompt injection and data exfiltration:

### 6.1 Injection Detection & Delimiter Breakout Neutralization
- **Signal Detection**: Scans for override commands (`ignore previous instructions`, `role spoofing`, `print system prompt`, `reveal api key`, `call function`).
- **Tag Neutralization**: XML delimiter tags (`<untrusted_data>`, `<system>`, `<developer>`) are neutralized to square bracket notation (`[untrusted_data]`).
- **Passive Data Wrapping**:
  ```xml
  <untrusted_data label="candidate_cv">
  ... [Sanitized user content] ...
  </untrusted_data>
  ```
- **System Directives**: AI models receive strict instructions that text inside `<untrusted_data>` represents passive context and must never be interpreted as commands.

### 6.2 Data Minimization & PII Redaction
Prior to transmitting text to Cloud AI providers (Gemini / OpenAI), text is filtered through `minimizeCloudPii`:
- Indonesian National Identity numbers (NIK / No. KTP 16 digits) are redacted to `[REDACTED_NIK]`.
- API keys (`sk-...`, `AIza...`, Bearer tokens) are redacted to `[REDACTED_API_KEY]`.

### 6.3 Explicit Cloud AI Consent Gate
- Career documents are never sent to Cloud AI without explicit user consent.
- Users configure consent in Workspace Settings (`aiCloudDocumentConsent`).
- Individual AI analysis jobs store `containsPrivateDocuments`, `consentRequired`, `consentGranted`, and `consentGrantedAt` in `ai_analysis_jobs` for complete auditability.
- No career data is used for model training.

---

## 7. Indonesian PDP Law (UU No. 27 Tahun 2022) Compliance

| PDP Article | Legal Requirement | Technical & Operational Implementation | Status |
|---|---|---|---|
| **Art. 4** | Classification of Personal Data (General vs. Specific) | General (name, contact) and Specific (financial/salary data, work evaluation) segregated and protected. | **Implemented** |
| **Art. 7** | Right to Access and Data Portability | `exportAccountJsonService` provides complete JSON export of profile, applications, archive, AI jobs, and audit logs. | **Implemented** |
| **Art. 8** | Right to Erasure / Deletion | `deleteUserAccountService` cascades database deletion and physically unlinks all files from disk via `deleteUserStorageDir`. | **Implemented** |
| **Art. 12** | Right to Withdraw Consent | Users can toggle Cloud AI processing consent in Workspace Settings at any time. | **Implemented** |
| **Art. 16** | Lawful Basis & Explicit Consent | Explicit opt-in required before cloud AI processing; terms accepted at sign-up. | **Implemented** |
| **Art. 35** | Security & Technical Safeguards | AES-256-GCM encryption, TLS in transit, HMAC download tokens, anti-malware pipeline. | **Implemented** |
| **Art. 36** | Security Incident & Breach Notification | Audit logs record all exports, deletions, and access anomalies; operational SOP required for 72-hour notification to authority. | **Operational SOP Required** |
| **Art. 53** | Data Protection Officer (DPO) | Designation of a qualified DPO responsible for organizational PDP governance. | **Organizational Requirement** |

---

## 8. Backup, Disaster Recovery & Data Retention

1. **Configurable Retention Policy** ([archive.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/services/archive.ts)):
   - Users configure application archive retention periods (30 to 3,650 days).
   - Automated expiration status tracking (`active`, `expiring_soon`, `expired`).
   - Automated or on-demand purging of expired records (`purgeExpiredArchivesService`).
2. **Immutable Snapshots**:
   - Archiving an application takes an immutable JSON snapshot with SHA-256 integrity verification.
   - Deleting live documents preserves historical snapshots intact.
3. **Database Backup & Recovery**:
   - Cloud PostgreSQL engines support Point-In-Time Recovery (PITR) up to 30 days.
   - Document storage can be mirrored to S3-compatible versioned object storage with write-once-read-many (WORM) policies.

---

## 9. Next Operational Steps for Production

1. **DPO Appointment**: Designate an internal or external Data Protection Officer.
2. **Data Protection Impact Assessment (DPIA)**: Complete a formal DPIA on automated CV evaluation features.
3. **Data Processing Agreements (DPAs)**: Execute DPAs with Midtrans, Stripe, Google Cloud, and OpenAI.
4. **72-Hour Incident Response Drill**: Document and test incident response workflows.
