# Security Review & Audit Report

**Project**: Career Application Tracker  
**Audit Scope**: End-to-End Security Architecture (Phases 1 to 10)  
**Classification**: Confidential / Engineering Assessment  
**Date**: November 2026  

---

## 1. Executive Summary

A comprehensive security, privacy, and data governance audit was conducted on the Career Application Tracker platform. The system handles highly confidential career data, including applicant profiles, resumes, salary negotiations, interview feedback, and payment transactions.

The review confirmed that:
1. Multi-tenant isolation is enforced at the database query level with composite `userId` scoping across all tables.
2. Short-lived HMAC-signed download URLs prevent unauthorized file harvesting and protect document storage.
3. Magic byte validation, size bounds, and a pluggable malware scanning hook protect against file-based attacks.
4. AI prompt injection defenses effectively neutralize delimiter breakouts, strip control characters, and redact sensitive Indonesian NIK and cloud API keys.
5. Account deletion permanently cascades across database entities and physically unlinks stored files from disk, fulfilling Indonesian PDP Law (UU No. 27 Tahun 2022) and GDPR Right to Erasure mandates.

---

## 2. Threat Modeling & Risk Matrix

| Threat Category | Potential Impact | Inherent Risk | Mitigations Implemented | Residual Risk |
|---|---|---|---|---|
| **Cross-Tenant Data Leakage** | User A accesses User B's CVs, applications, or notes | Critical | Mandatory server-side session resolution; composite `userId` filtering on every query; DB cascade deletions. | Low |
| **Malicious File Upload** | Executables, SVG XSS, or malware uploaded as resumes | High | Magic byte verification, strict 10 MB limit, script/tag blocking in text files, pluggable malware scanner. | Low |
| **Direct File Harvesting** | Attackers enumerate sequential document URLs | High | Short-lived (300s) HMAC-SHA256 signed download tokens; non-guessable storage UUIDs; `no-store` headers. | Low |
| **Prompt Injection / Override** | Malicious CV text hijacks AI evaluation instructions | High | Delimiter escaping, system prompt directives, passive data wrapping (`<untrusted_data>`), PII minimization. | Low |
| **Payment & Credit Tampering** | Client spoofs payment success or alters credit balances | Critical | Server-authoritative credit ledger; webhook cryptographic signature verification (Midtrans & Stripe); idempotency keys. | Low |
| **Unauthorized Sync Push** | Malicious device overwrites cloud application state | High | Device registration with token authentication; version-based conflict detection; sync outbox isolation; zero local credit mutation. | Low |
| **Data Retention Breach** | Stale candidate data retained indefinitely | Medium | Configurable archive retention policy (30 to 3650 days); automated expired archive purge service. | Low |

---

## 3. Subsystem Security Audit

### 3.1 Authentication & Session Management
- **Framework**: Better Auth with secure HTTP-only cookies (`better-auth.session_token`).
- **CSRF Protection**: Native SameSite cookie policies and Next.js Server Action CSRF tokens.
- **Account Deletion Gate**: Requires explicit password verification (`deleteAccountWithPasswordAction`) before triggering account deletion.

### 3.2 Document Storage Security ([storage.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/lib/storage.ts))
- **Path Traversal**: Storage keys are verified against `..` traversals and restricted to `storage/documents/<safeUserId>/`.
- **Magic Bytes**: Binary headers are validated for PDF (`%PDF-`), PNG, JPEG, WebP, and DOCX (`PK\x03\x04`). Text/Markdown files are checked for null bytes and prohibited from containing `<script>`, `<svg>`, or `<iframe>` tags.
- **Anti-Malware Scanner**: Pre-save hook detects EICAR signatures, Windows PE (`MZ`), Linux ELF, and Mach-O headers. Integrates with ClamAV and cloud sandbox scanners.
- **Signed Download URLs**: `/api/documents/download?token=...` enforces short-lived (5 min) HMAC signatures, preventing link leakage or brute-force access.

### 3.3 AI Intelligence & Privacy Protection ([prompt-guard.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/ai/security/prompt-guard.ts))
- **Prompt Injection Defense**: Detection of override phrases (`ignore previous instructions`, `role spoofing`, `delimiter breakout`).
- **Tag Neutralization**: Replaces `<untrusted_data>` with `[untrusted_data]` in user text so users cannot prematurely close wrapper delimiters.
- **Data Minimization**: Automatically redacts 16-digit Indonesian NIKs (`[REDACTED_NIK]`) and API keys before sending prompts to external providers.
- **Consent Gate**: Database flags `containsPrivateDocuments` and `consentRequired` prevent cloud execution without explicit user consent.

### 3.4 Payment & Credit Security ([payments.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/services/payments.ts))
- **Authoritative Ledgers**: Wallets and ledgers are maintained server-side in PostgreSQL. Local devices cannot modify credit balances.
- **Signature Verification**:
  - Midtrans: SHA-512 over `order_id + status_code + gross_amount + server_key`.
  - Stripe: HMAC-SHA256 signature verification over the raw webhook payload.
- **Idempotency**: Webhook events are tracked in `payment_webhook_events`. Repeated deliveries are acknowledged without re-granting credits.

### 3.5 Hybrid Synchronization Security ([sync.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/services/sync.ts))
- **Device Authorization**: Each sync client registers a distinct device token linked to the authenticated user.
- **Cross-User Protection**: Push and pull queries strictly filter by `sync_devices.userId`.
- **Financial Boundary**: Synchronizing credit or payment mutations from local devices is strictly forbidden and rejected at the API boundary.

---

## 4. Indonesian PDP Law (UU No. 27 Tahun 2022) Governance Review

1. **Right to Access & Portability (Art. 7)**:
   - Implemented via `exportAccountJsonService` ([settings.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/src/server/services/settings.ts)).
   - Exports all candidate applications, documents, stages, AI evaluations, credits, and audit records in JSON format.
   - Authentication passwords and encryption keys are scrubbed from exported data.
2. **Right to Erasure (Art. 8)**:
   - Implemented via `deleteUserAccountService` and `deleteUserStorageDir`.
   - All relational rows are cascade-deleted in PostgreSQL.
   - Physical documents stored on disk are unlinked and permanently deleted.
3. **Audit Trail (Art. 35)**:
   - Security-sensitive actions (exports, deletions, stage moves, retention updates) are recorded in `audit_logs` with timestamps, entity IDs, and user IDs.

---

## 5. Security Test Suite Summary

The security architecture is verified through dedicated unit and integration suites:
- **Unit Suite** ([phase10-security.test.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/tests/unit/phase10-security.test.ts)):
  - 14 tests: Signed token lifecycle, tamper rejection, expiry handling, EICAR detection, binary header blocking, tag neutralization, NIK redaction, size limits.
- **Integration Suite** ([security.test.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/tests/integration/security.test.ts)):
  - 9 tests: Cross-user document isolation, cross-user application isolation, signed download URL verification, upload threat rejection, cascade DB and physical file deletion, PDP JSON export sanitization, retention purge verification.

**Result**: 100% Pass across all security test cases.

---

## 6. Recommendations & Deployment Restrictions

1. **Transport Layer**: Enforce TLS 1.3 in production environments. Strict-Transport-Security (`max-age=31536000; includeSubDomains; preload`) is already configured in [next.config.ts](file:///Users/arhel/Documents/Project/Personal Job Applicant Tracking System/next.config.ts).
2. **Operational Policies**:
   - Establish a 72-hour security incident notification runbook to comply with PDP Article 36.
   - Execute formal Data Processing Agreements (DPAs) with payment and cloud AI vendors.
   - Designate a Data Protection Officer (DPO) prior to public commercial launch in Indonesia.
