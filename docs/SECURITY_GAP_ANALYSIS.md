# Security & Data Isolation Gap Analysis

**Scope:** Authentication, authorization, tenant isolation, cryptography, file storage, HTTP headers, input validation, audit logging, and readiness for Hybrid AI + Cloud Sync + Payments.

---

## 1. Verified Security Strengths (Existing Baseline)

1. **Tenant Isolation at Query & DB Layers:**
   - All authenticated pages and Server Actions call `requireUser()` (`src/lib/session.ts:25-33`), and all API Route Handlers call `getOptionalUser()` (`src/lib/session.ts:13-23`) before accessing data. No endpoint accepts `userId` from client input.
   - All core child tables enforce composite foreign keys `(parent_id, user_id) -> parent(id, user_id)`, preventing cross-user foreign key linking even at the SQL engine level.
   - Integration tests (`tests/integration/services.test.ts:62-120`) explicitly verify cross-user isolation for vacancies, applications, and document files.
2. **Secret Redaction & Audit Trail:**
   - `writeAudit()` (`src/lib/audit.ts:4-25`) redacts sensitive keys (`password`, `newPassword`, `currentPassword`, `accessToken`, `refreshToken`, `encryptedRefreshToken`, `token`).
3. **OAuth Token Protection:**
   - Read-only OAuth scopes (`gmail.readonly`, `Mail.Read`) with PKCE (`S256`) and HMAC-signed state. Refresh tokens encrypted with AES-256-GCM (`src/lib/crypto.ts:22-55`).
4. **Upload & Export Protections:**
   - Magic-byte inspection + 10 MB cap + HTML/SVG/script rejection for `.txt`/`.md` (`src/lib/storage.ts:36-117`).
   - CSV formula-injection neutralization (`src/lib/csv.ts:7-18`).
   - No `dangerouslySetInnerHTML`, `window.confirm()`, `eval()`, or `new Function()` found in `src/`.

---

## 2. Identified Security & Data Isolation Weaknesses

| Severity | Finding | Location | Risk & Remediation |
|---|---|---|---|
| **High** | **Orphaned User Files on Account Deletion** | `src/server/services/settings.ts:409-412` | `deleteUserAccountService` deletes the `user` DB row (cascading `documents`/`document_versions`), **leaving uploaded physical CV/certificate files in `storage/documents/<userId>/` on disk**. Violates UU PDP right to erasure. **Fix:** Collect `storageKey`s before DB deletion and remove all user files + directory after commit. |
| **High** | **OAuth State Verification Timing Leak & Missing Replay/Expiry Check** | `src/lib/crypto.ts:77-91` | `verifyOAuthState` compares `sig !== expected` using standard string equality instead of `crypto.timingSafeEqual`, and never validates the `ts` timestamp inside the state payload (`start/route.ts:30`). **Fix:** Use `timingSafeEqual` on equal-length buffers and enforce a strict 10-minute TTL (`Date.now() - Number(ts) <= 600_000`). |
| **High** | **Inline Serving of Active/Renderable Document Formats** | `src/app/api/documents/versions/[versionId]/file/route.ts:23-35` | Serves `application/pdf`, `text/plain`, `text/markdown`, and images with `Content-Disposition: inline` without a restrictive `Content-Security-Policy: sandbox` header on the file response. **Fix:** Serve file responses with `Content-Security-Policy: sandbox; default-src 'none'` and force `attachment` for non-previewed types. |
| **High** | **Missing CSP & HSTS Headers** | `next.config.ts:3-11` | `docs/06-privacy-and-security.md:33` documents CSP, but `next.config.ts` does **not** send `Content-Security-Policy` or `Strict-Transport-Security` (in production). **Fix:** Add environment-aware `Content-Security-Policy` and HSTS (`max-age=63072000; includeSubDomains`). |
| **Medium** | **Missing Zod Validation on Several Server Action Arguments** | `src/server/actions/settings.ts:44,75,82`<br>`src/server/actions/applications.ts:59,103,113`<br>`src/server/actions/emails.ts:51,63,85` | `updateSearchStatusAction`, `reorderStagesAction`, `toggleStageHiddenAction`, `snoozeFollowUpTaskAction`, `linkEmailToApplicationAction`, and `confirmEmailStageTransitionAction` pass raw client parameters (UUIDs, dates, enums) directly into Drizzle queries without Zod validation. Malformed UUIDs/dates trigger raw PostgreSQL errors instead of clean validation errors. **Fix:** Enforce Zod schemas on every service/action boundary. |
| **Medium** | **Cookie Substring Check in Edge Proxy & Unmatched `/api/email`** | `src/proxy.ts:17-21,41-54` | `hasSessionCookie` checks `c.name.includes("better-auth.session_token")` (client-forgery passes proxy edge gate, though server `requireUser()` catches it), and `matcher` omits `/api/email/:path*`. **Fix:** Document proxy as coarse redirect optimization only (defense-in-depth remains `requireUser()`), and include `/api/email/:path*` or standardize API auth middleware. |
| **Medium** | **`ENCRYPTION_KEY` Fallback to `BETTER_AUTH_SECRET` & Dev Default** | `src/lib/crypto.ts:10-16`<br>`src/lib/env.ts:30-33` | If `ENCRYPTION_KEY` is unset, OAuth encryption derives its key from `BETTER_AUTH_SECRET` (which defaults to a static string in non-production). Rotating auth secret would break decryption of stored refresh tokens. **Fix:** Require dedicated `ENCRYPTION_KEY` whenever OAuth or BYOK AI secrets are stored in production, and decouple key domains via HKDF. |
| **Medium** | **Path Prefix Check Without Trailing Separator** | `src/lib/storage.ts:130` | `if (!full.startsWith(root))` should be `full === root || full.startsWith(root + sep)` to prevent sibling-directory prefix collisions (e.g., `storage/documents_evil`). Currently mitigated by `randomUUID()` keys, but should be hardened. |
| **Medium** | **Incomplete UU PDP Account Data Export** | `src/server/services/settings.ts:304-407` | `exportAccountJsonService` omits `assessments`, `documents`, `documentVersions`, `applicationDocuments`, `emailAccounts` (non-secret metadata), and `notifications`. **Fix:** Include all user-owned entities (redacting secrets) for complete UU PDP portability. |
| **Medium** | **No PostgreSQL Row-Level Security (RLS) Yet** | `src/db/migrations/0000_messy_komodo.sql` | In cloud multi-tenant PostgreSQL/Supabase deployments, isolation currently relies solely on application `WHERE user_id = ...` filters and composite FKs. **Fix:** Add cloud-compatible RLS policies in a dedicated hardening phase. |
| **Low** | **Multipart Upload Buffering Before Size Check** | `src/app/api/documents/upload/route.ts:14,35` | `request.formData()` buffers the request body before `validateDocumentBuffer` checks the 10 MB limit. **Fix:** Enforce `Content-Length` pre-check and Next.js/server body limits. |
| **Low** | **Raw Error Messages Returned from API/Actions** | `src/app/api/documents/upload/route.ts:67-68` | Returns `err.message` directly to client; safe for custom domain errors, risky if an unexpected DB/driver error leaks internals. **Fix:** Introduce typed `DomainError` / `ValidationError` classes and sanitize unexpected 500 errors. |

---

## 3. Forward-Looking Security Requirements (Upcoming Hybrid AI & Monetization Phases)

When introducing **Hybrid Sync**, **Hybrid AI**, and **Credit Monetization**, the following controls are mandatory:
1. **AI Prompt Injection & PII Minimization:**
   - Job descriptions and recruiter emails are untrusted external text; wrap them as delimited data (never system instructions) and sanitize/strip sensitive credentials or unrelated personal identifiers before sending to Cloud AI providers.
   - Enforce strict **no-fabrication** grounding rules: AI CV/cover-letter tools may only cite facts present in the user's verified profile/documents.
2. **Provider Key Isolation:**
   - System cloud AI keys and payment gateway keys (e.g., Midtrans/Xendit server keys) must remain strictly server-side (`env`), never exposed in `NEXT_PUBLIC_*` or client props.
3. **Atomic Credit & Webhook Security:**
   - All credit deductions must use atomic DB transactions (`SELECT ... FOR UPDATE` or conditional `UPDATE ... WHERE balance >= cost`) with idempotency keys to prevent race-condition double spending.
   - Payment webhooks must verify cryptographic signatures (HMAC/SHA-512) and check idempotency before crediting wallets.
4. **Sync Authorization:**
   - Cloud sync endpoints must validate authenticated Better Auth session/token ownership, reject client-supplied `userId`, and enforce server-authoritative validation on synced rows (especially preventing clients from forging credit balances or `ai_runs`).
