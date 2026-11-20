# 08. Hybrid AI Engine Architecture

**Phase:** 3: Hybrid AI Engine
**Status:** Core engine, adapters, router, schemas, prompts, job persistence, privacy modes and consent gates COMPLETE. Local AI is the available user-facing path; Cloud AI provider selection and consent UI are not exposed. Live cloud providers NOT TESTED.
**Primary Directory:** `src/server/ai/`

---

## 1. Provider-Independent Architecture Overview

The Hybrid AI Engine decouples career intelligence tasks from any single model vendor and supports both local execution (zero cloud transmission) and cloud execution behind a unified server-side interface.

Local AI configuration and execution are available in the active product. OpenAI and Gemini adapters are preserved for future development, but cloud provider selection and cloud consent controls are not exposed in Settings.

```text
src/server/ai/
├── providers/
│   ├── provider.types.ts      # Normalized contract, capabilities, errors, usage
│   ├── json-output.ts         # Timeout fetch, JSON fence extraction, Zod validation
│   ├── ollama.provider.ts     # Local AI adapter (Ollama /api/chat + /api/tags)
│   ├── openai.provider.ts     # Cloud AI adapter (OpenAI /chat/completions)
│   ├── gemini.provider.ts     # Cloud AI adapter (Gemini :generateContent)
│   └── index.ts               # Registry & non-secret status helpers
├── router/
│   ├── provider-selector.ts   # Privacy-mode filtering, availability, consent evaluation
│   └── ai-task-router.ts      # Async job lifecycle, retries, atomic DB persistence
├── schemas/
│   ├── cv-data.schema.ts
│   ├── cv-analysis.schema.ts
│   ├── job-match.schema.ts
│   ├── correction-result.schema.ts
│   └── career-roadmap.schema.ts
├── prompts/
│   ├── en/                    # English versioned prompts (v1.0.0)
│   ├── id/                    # Bahasa Indonesia versioned prompts (v1.0.0)
│   └── prompt-registry.ts     # Deterministic template hashing & DB registration
├── security/
│   ├── endpoint-validator.ts  # Loopback / SSRF validation for local AI endpoints
│   └── prompt-guard.ts        # Untrusted-input wrapping, injection signals, PII minimization
└── services/
    ├── _context.ts            # Verified Master Career Profile & untrusted JD loaders
    ├── cv-parser.service.ts
    ├── cv-evaluator.service.ts
    ├── job-matcher.service.ts
    ├── cv-correction.service.ts
    ├── cv-generator.service.ts
    ├── skill-gap.service.ts
    ├── career-roadmap.service.ts
    └── interview-coach.service.ts
```

---

## 2. Normalized Provider Contract (`provider.types.ts`)

Every provider implements `AiProvider`:
- **Identification:** `id` (`"ollama" | "openai" | "gemini"`), `name`, `locality` (`"local" | "cloud"`).
- **Capabilities:** `structuredOutput`, `jsonMode`, `streaming`, `vision`, `maxContextTokens`, `supportsSystemRole`. Unsupported capability requests fail cleanly with `AiProviderError("UNSUPPORTED_CAPABILITY")`.
- **Structured Output & Validation:** `generateStructured(request)` extracts JSON (supporting optional markdown fences) and validates against strict Zod schemas via `parseAndValidateStructuredJson()`. Invalid JSON or schema mismatches normalize to `INVALID_OUTPUT`.
- **Usage Estimation & Accounting:** `estimateUsage()` estimates pre-flight token counts/cost; completed responses normalize `{ inputTokens, outputTokens, totalTokens, estimatedCostUsd, latencyMs, isEstimated }`.
- **Timeout & Error Normalization:** `fetchWithTimeout()` enforces `AbortController` timeouts (`AI_REQUEST_TIMEOUT_MS`, default `30000` ms) and maps failures to typed `AiErrorCode` values (`PROVIDER_NOT_CONFIGURED`, `PROVIDER_UNAVAILABLE`, `AUTH_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `INVALID_OUTPUT`, `ENDPOINT_INVALID`, `CONSENT_REQUIRED`, `PRIVACY_MODE_BLOCKED`, `TASK_EXECUTION_FAILED`).

### Adapter Verification Status

| Provider | Locality | Transport & Schema Status | Live Runtime Verification |
|---|---|---|---|
| **Ollama** (`ollama.provider.ts`) | Local | Adapter implemented (`/api/tags`, `/api/chat`); verified end-to-end via mocked HTTP `fetchFn` + in-memory PGlite integration tests | Requires user-local Ollama daemon (`OLLAMA_BASE_URL`); not probed live in automated tests |
| **OpenAI** (`openai.provider.ts`) | Cloud | Adapter implemented (`/models`, `/chat/completions`); verified via mocked HTTP `fetchFn` for success, `401`, and secret non-leakage | Adapter interface & contract only when `OPENAI_API_KEY` is unset; requires server key for live calls |
| **Google Gemini** (`gemini.provider.ts`) | Cloud | Adapter implemented (`/models`, `:generateContent` via `x-goog-api-key` header); verified via mocked HTTP `fetchFn` for success, timeout, and `429` | Adapter interface & contract only when `GEMINI_API_KEY` is unset; requires server key for live calls |

OpenAI and Gemini rows describe adapter-level implementation. Neither provider can be selected through the active Settings interface while Cloud AI is coming soon.

---

## 3. AI Privacy Modes & Consent Enforcement

Configured per user in `user_settings` (configurable in `/settings` Section 5):

1. **`local_only` (Local AI Only):** Strictly permits local execution (`ollama`). Explicit requests for cloud providers raise `PRIVACY_MODE_BLOCKED`.
2. **`cloud_allowed` (Cloud AI):** Allows configured cloud providers (`openai`, `gemini`), **but** still requires explicit consent (`user_settings.aiCloudDocumentConsent` or per-task `consentGranted`) before sending private career documents. This mode is retained in the server contract but disabled in Settings while Cloud AI is coming soon.
3. **`ask_before_each` (Ask Before Every AI Task, Default):** Every AI job pauses at `status = "awaiting_consent"` with `ai_analysis_sources` persisted and **no provider call made**, until explicitly resumed via `approveAndRunAiJobService(userId, jobId)`.

**Key Isolation Guarantee:** `OPENAI_API_KEY` and `GEMINI_API_KEY` exist solely in `src/lib/env.ts` server memory. Only sanitized boolean `configured` statuses reach `/settings`.

---

## 4. Database Tables & Separation From Verified Career Data

Added via migration `src/db/migrations/0003_modern_the_fury.sql`:

| Table | Purpose | Isolation & Integrity |
|---|---|---|
| `ai_prompt_versions` | Versioned registry of `id` and `en` prompt templates | `UNIQUE(task_type, locale, version)`, SHA-256 `template_hash` |
| `ai_analysis_jobs` | Async execution status (`awaiting_consent` → `running` → `completed`/`failed`/`cancelled`), provider/model, consent timestamps, `input_hash`, retry attempts, error metadata, token usage | `user_id` cascade, `UNIQUE(id, user_id)`, indexes on `(user_id, status, created_at)` and `(user_id, task_type, input_hash)` |
| `ai_career_analyses` | Zod-validated structured outputs stored **separately** from verified Master Career Profile tables | Composite FK `(job_id, user_id) -> ai_analysis_jobs(id, user_id)` cascade, `UNIQUE(job_id)` |
| `ai_analysis_sources` | Provenance links and SHA-256 hashes for grounded inputs (`career_profile`, `job_vacancy`, `document_version`, `interview`, `raw_text`) plus `is_untrusted_external` and `injection_signal_count` | Composite FKs to `ai_analysis_jobs` and `ai_career_analyses` |
| `ai_feedback` | User rating (`1..5`), `helpful`, `action_taken`, and notes/hallucination reports | Composite FK `(analysis_id, user_id) -> ai_career_analyses(id, user_id)` cascade |

---

## 5. Security Controls

1. **Untrusted Input Wrapping (`prompt-guard.ts`):** Uploaded CVs and external job descriptions are sanitized (stripping zero-width/control chars and neutralizing `<untrusted_data>` / `<system>` breakout tags) and wrapped in `<untrusted_data label="...">` delimiters paired with anti-injection system directives.
2. **Cloud PII Minimization:** Before invoking any `cloud` provider (`openai`, `gemini`), `minimizeCloudPii()` redacts accidental Bearer tokens, API keys (`sk-...`, `AIza...`), and explicit Indonesian `NIK`/`KTP` 16-digit markers.
3. **Local Endpoint SSRF Protection (`endpoint-validator.ts`):** User-configured Ollama URLs require `http:`/`https:`, reject embedded credentials and cloud metadata IPs (`169.254.*`), and allow loopback targets (`127.0.0.1`, `localhost`, `::1`) by default.
4. **No Silent Overwrites:** AI analyses never mutate `career_profiles`, `career_experiences`, `career_educations`, `career_skills`, `career_certifications`, or `career_projects`.

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| User-facing AI provider selection | Local AI available; Cloud AI coming soon | Local endpoint, model, and provider controls remain editable. OpenAI/Gemini options and `cloud_allowed` are disabled in Settings. |
| Provider contract, JSON extraction and Zod validation | COMPLETE | `src/server/ai/providers/provider.types.ts`, `src/server/ai/providers/json-output.ts`. |
| Ollama, OpenAI and Gemini adapters | COMPLETE at the adapter and contract level | `src/server/ai/providers/ollama.provider.ts`, `openai.provider.ts`, `gemini.provider.ts`. Verified with mocked HTTP `fetchFn` only. |
| Router, privacy modes, consent gate and async jobs | COMPLETE | `src/server/ai/router/ai-task-router.ts`, `src/server/ai/router/provider-selector.ts`. |
| Versioned bilingual prompts and deterministic hashing | COMPLETE | `src/server/ai/prompts/`, `src/server/ai/prompts/prompt-registry.ts`. |
| AI tables with usage metadata (input/output tokens, cost, latency) | COMPLETE | `src/db/schema/ai.ts`, migration `src/db/migrations/0003_modern_the_fury.sql`, type in `src/lib/domain/ai.ts`. |
| Prompt guard and cloud PII minimization (`minimizeCloudPii`) | COMPLETE | `src/server/ai/security/prompt-guard.ts`, `src/server/ai/security/endpoint-validator.ts`. |
| Live Ollama, OpenAI or Gemini calls against real endpoints | NOT TESTED | No credentials or local daemon were available in the test environment. |

## Test evidence

- Unit: `tests/unit/phase3-ai.test.ts` covers SSRF validation, untrusted input sanitization, prompt injection signals, cloud PII minimization, deterministic prompt hashes, Ollama JSON parsing and normalized provider errors.
- Integration: `tests/integration/ai-engine.test.ts` (in-memory PGlite) covers privacy modes, `awaiting_consent` pause and resume via `approveAndRunAiJobService`, retries, job persistence, feedback, user isolation and Zod-validated service execution using mocked providers.
- Suite totals: 125/125 Vitest tests pass across 25 files, 4/4 Playwright E2E tests pass, typecheck, lint and build are green, and CI is green on commit `2a9540c`.
