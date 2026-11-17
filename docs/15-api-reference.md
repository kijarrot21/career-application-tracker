# Versioned API Reference (`/api/v1/*`)

## Architecture & Conventions

The application uses **Next.js App Router**:

- **Server Actions** (`src/server/actions/*`) handle internal UI form & workspace mutations.
- **Versioned Route Handlers** (`src/app/api/v1/*`) expose standardized REST contracts for asynchronous AI jobs, application archive inspection/analysis, credits & billing queries, payment checkouts, cryptographic webhooks, and hybrid synchronization.

All `/api/v1/*` handlers share unified primitives in `src/lib/api/v1.ts` and `src/server/api/v1-handler.ts` and delegate directly to domain services/queries without duplicating business logic.

---

## Global Standards

### 1. Authentication & Authorization

- All endpoints (except `/api/v1/payments/webhooks/[provider]`) require an authenticated Better Auth user session (`getOptionalUser()` + `src/proxy.ts` edge check).
- Unauthenticated requests receive `401 Unauthorized` (`UNAUTHORIZED`).
- Client-supplied `userId` / `user_id` parameters are **never** used for authorization; resource ownership is enforced strictly against the authenticated session `userId`.
- `/api/v1/payments/webhooks/[provider]` authenticates callers using provider cryptographic signatures (`SHA-512` for Midtrans, `HMAC-SHA256` with timestamp tolerance for Stripe) and rejects invalid signatures with `401`.

### 2. Response Envelopes & Headers

Every response sets:

- `X-API-Version: v1`
- `X-Request-Id: <uuid>` (echoes incoming `X-Request-Id` or generates a UUID)
- `Cache-Control: no-store`
- `X-RateLimit-Limit` & `X-RateLimit-Remaining` (plus `Retry-After` on `429`)

**Success Envelope:**

```json
{
  "ok": true,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {},
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

(`pagination` is included on paginated list endpoints.)

**Error Envelope:**

```json
{
  "ok": false,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  }
}
```

Unexpected internal errors return a generic `500 INTERNAL_ERROR` without database SQL, stack traces, file paths, or secrets.

### 3. Standard Error Codes & HTTP Statuses

| HTTP                  | Code                                                                                          | Meaning                                                        |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `400`                 | `INVALID_ID`                                                                                  | Path parameter is not a valid UUID                             |
| `400`                 | `INVALID_JSON`                                                                                | Request body failed JSON parsing                               |
| `400`                 | `VALIDATION_ERROR`                                                                            | Request query/body failed Zod schema validation                |
| `400`                 | `UNSUPPORTED_MEDIA_TYPE`                                                                      | Uploaded CV file format is unsupported or malformed            |
| `401`                 | `UNAUTHORIZED` / `INVALID_SIGNATURE`                                                          | Missing session or invalid webhook signature                   |
| `402`                 | `INSUFFICIENT_CREDITS`                                                                        | User credit wallet lacks required AI task credits              |
| `403`                 | `PRIVACY_MODE_BLOCKED` / `CONSENT_REQUIRED` / `SYNC_FORBIDDEN_ENTITY` / `SYNC_CLOUD_DISABLED` | Privacy mode, consent gate, or security policy blocked request |
| `404`                 | `NOT_FOUND`                                                                                   | Resource missing or owned by another user                      |
| `409`                 | `CONFLICT` / `SYNC_LOCAL_ONLY_MODE`                                                           | Resource state conflict or device offline mode constraint      |
| `422`                 | `UNPROCESSABLE_ENTITY` / `ARCHIVE_SNAPSHOT_IMMUTABLE` / `DOCUMENT_VERSION_IMMUTABLE`          | Domain invariant or webhook validation failure                 |
| `429`                 | `RATE_LIMIT_EXCEEDED`                                                                         | Sliding-window rate limit exceeded                             |
| `502` / `503` / `504` | `PROVIDER_ERROR` / `PAYMENT_PROVIDER_DISABLED` / `TIMEOUT`                                    | External AI or payment provider unavailable/timed out          |

### 4. Pagination & Idempotency

- **Pagination Query Params**: `?page=1&pageSize=20` (`page >= 1`, `1 <= pageSize <= 100`).
- **Idempotency**: POST endpoints for AI execution, payment checkout, and sync push/resolve accept `Idempotency-Key` HTTP headers or body `idempotencyKey`. Repeated submissions return deduplicated results without re-charging credits or double-granting payments.

---

## Endpoint Groups

### Application Archive

- `GET /api/v1/archive` — Paginated list of archived applications with filters (`search`, `outcome`, `status`, `company`, `jobTitle`, `fromDate`, `toDate`) + aggregate stats & retention policy.
- `POST /api/v1/archive` — Archive an application snapshot & closure record (`201 Created`).
- `GET /api/v1/archive/[id]` — Fetch full immutable snapshot, SHA-256 integrity flag, preserved archive documents, and sibling attempts.
- `POST /api/v1/archive/[id]/analyze` — Trigger grounded AI gap analysis on an archived application snapshot (`200` or `202` if awaiting consent).

### AI Services

- `POST /api/v1/ai/cv/parse` — Supports `multipart/form-data` (PDF/DOCX/TXT/MD file) or JSON (`documentVersionId` / `cvText`); marks uncertain fields for verification.
- `POST /api/v1/ai/cv/evaluate` — Structured 10-dimension CV quality evaluation grounded in Master Career Profile.
- `POST /api/v1/ai/cv/correct` — Before-and-after CV improvement suggestions requiring explicit user approval.
- `POST /api/v1/ai/cv/generate` — Generates tailored Indonesian CV or international resume payloads (`vacancyId` or `targetRole` required).
- `POST /api/v1/ai/job-match` — Matches Master Career Profile & selected CV against a vacancy or job description.
- `POST /api/v1/ai/career-roadmap` — Generates grounded 6-month & 12-month career roadmap (`targetRole`, `horizonMonths`).
- `GET /api/v1/ai/jobs/[id]` — Polls asynchronous AI job status, usage metadata, linked career analysis, and source provenance.
- `POST /api/v1/ai/jobs/[id]` — `{ action: "approve" | "cancel" }` for `awaiting_consent` jobs.

### Credit Services

- `GET /api/v1/credits/wallet` — Returns authoritative user credit wallet summary, active reservations, and AI task pricing catalog.
- `GET /api/v1/credits/ledger` — Paginated append-only credit ledger (`page`, `pageSize`, optional `entryType`).
- `GET /api/v1/credits/packages` — Paginated active credit top-up packages (`page`, `pageSize`, optional `currency`).

### Payment Services

- `POST /api/v1/payments/checkout` — Server-authoritative checkout order creation from `credit_packages` catalog (`packageKey`, `provider`, idempotent).
- `POST /api/v1/payments/webhooks/[provider]` — Cryptographically authenticated payment webhook ingestion (`midtrans` | `stripe`), amount/currency check, idempotent event deduplication, and atomic credit ledger grant.

### Synchronization

- `POST /api/v1/sync/push` — Processes explicit batch events or drains `sync_outbox` (`{ mode: "outbox", deviceId }`). Blocks cloud-authoritative credit/payment entities (`403 SYNC_FORBIDDEN_ENTITY`).
- `GET / POST /api/v1/sync/pull` — Incremental cursor-based pull of committed `sync_events`.
- `GET /api/v1/sync/status` — Returns device list, checkpoints, outbox queue counts, active errors, open conflicts, and paginated sync events.
- `POST /api/v1/sync/resolve` — Applies manual conflict resolution (`keep_local`, `keep_cloud`, `merged`, `dismissed`).
