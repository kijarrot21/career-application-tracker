import type { z } from "zod";
import type { AiProviderId, AiUsageMetadata } from "@/lib/domain/ai";
import { env } from "@/lib/env";
import { AiProviderError, type FetchLike } from "./provider.types";

/**
 * Rough token estimation (~4 chars per token for Latin/Indonesian/code text)
 * used for pre-flight budgeting or when a provider omits exact token counts.
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function buildEstimatedUsage(params: {
  systemPrompt: string;
  userPrompt: string;
  expectedOutputTokens?: number;
  costPer1kInputUsd?: number;
  costPer1kOutputUsd?: number;
}): AiUsageMetadata {
  const inputTokens =
    estimateTokensFromText(params.systemPrompt) +
    estimateTokensFromText(params.userPrompt);
  const outputTokens = params.expectedOutputTokens ?? 600;
  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUsd = Number(
    (
      (inputTokens / 1000) * (params.costPer1kInputUsd ?? 0) +
      (outputTokens / 1000) * (params.costPer1kOutputUsd ?? 0)
    ).toFixed(6),
  );
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    latencyMs: 0,
    isEstimated: true,
  };
}

/**
 * Extracts a JSON payload from model text (handling optional ```json fences)
 * and strictly validates it against a Zod schema.
 */
export function parseAndValidateStructuredJson<TSchema extends z.ZodTypeAny>(
  rawText: string,
  schema: TSchema,
  provider: AiProviderId,
): z.infer<TSchema> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new AiProviderError(
      "INVALID_OUTPUT",
      `${provider} returned an empty response when JSON was expected.`,
      { provider, retryable: false },
    );
  }

  let jsonCandidate = trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    jsonCandidate = fenced[1].trim();
  } else {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (err) {
    throw new AiProviderError(
      "INVALID_OUTPUT",
      `${provider} returned malformed JSON output.`,
      { provider, retryable: false, cause: err },
    );
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    const issues = validated.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new AiProviderError(
      "INVALID_OUTPUT",
      `${provider} JSON failed schema validation: ${issues}`,
      { provider, retryable: false },
    );
  }

  return validated.data;
}

/**
 * Resolves the effective inference timeout with nullish semantics:
 * explicit task/model override -> provider default -> environment fallback.
 * `null` (used by persisted `pendingTaskRequest`) is treated as "not set".
 */
export function resolveRequestTimeoutMs(params: {
  explicitTimeoutMs?: number | null;
  providerDefaultTimeoutMs?: number;
}): number {
  return (
    params.explicitTimeoutMs ??
    params.providerDefaultTimeoutMs ??
    env.AI_REQUEST_TIMEOUT_MS
  );
}

const NULL_BODY_STATUS_CODES = new Set([204, 205, 304]);

/**
 * Executes a fetch whose full lifecycle (connection, response headers and
 * response body) is bounded by one AbortController timeout. The body is
 * buffered before the timer is cleared so provider-level `json()` / `text()`
 * reads can never stall outside the timeout window. The returned Response is
 * a drop-in replacement with the same status, headers and body semantics.
 */
export async function fetchWithTimeout(params: {
  url: string;
  init: RequestInit;
  timeoutMs?: number | null;
  providerDefaultTimeoutMs?: number;
  provider: AiProviderId;
  fetchFn?: FetchLike;
  diagnostics?: Record<string, string | number | boolean | null>;
}): Promise<Response> {
  const fetchFn = params.fetchFn ?? fetch;
  const timeoutMs = resolveRequestTimeoutMs({
    explicitTimeoutMs: params.timeoutMs,
    providerDefaultTimeoutMs: params.providerDefaultTimeoutMs,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetchFn(params.url, {
      ...params.init,
      signal: controller.signal,
    });

    // Keep the timeout active while the body is consumed. `stream: false`
    // providers send the body with the headers, but a stalled or chunked body
    // must still abort instead of hanging after the timer was cleared.
    const body = NULL_BODY_STATUS_CODES.has(response.status)
      ? null
      : await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      if (params.diagnostics) {
        // Structured, non-sensitive metadata only. Never log prompts or bodies.
        console.warn(
          "[ai-provider] request timed out",
          JSON.stringify({
            provider: params.provider,
            timeoutMs,
            ...params.diagnostics,
          }),
        );
      }
      throw new AiProviderError(
        "TIMEOUT",
        `${params.provider} request timed out after ${timeoutMs}ms.`,
        { provider: params.provider, retryable: true, cause: err },
      );
    }
    throw new AiProviderError(
      "PROVIDER_UNAVAILABLE",
      `${params.provider} endpoint is unreachable.`,
      { provider: params.provider, retryable: true, cause: err },
    );
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeHttpProviderError(params: {
  provider: AiProviderId;
  status: number;
  bodyText?: string;
}): AiProviderError {
  const { provider, status } = params;
  const snippet = (params.bodyText ?? "").slice(0, 200).replace(/\s+/g, " ");

  if (status === 401 || status === 403) {
    return new AiProviderError(
      "AUTH_ERROR",
      `${provider} authentication failed (HTTP ${status}). Check server API key configuration.`,
      { provider, retryable: false, statusCode: status },
    );
  }
  if (status === 429) {
    return new AiProviderError(
      "RATE_LIMITED",
      `${provider} rate limit exceeded (HTTP 429).`,
      { provider, retryable: true, statusCode: status },
    );
  }
  if (status >= 500) {
    return new AiProviderError(
      "PROVIDER_UNAVAILABLE",
      `${provider} upstream service error (HTTP ${status}).`,
      { provider, retryable: true, statusCode: status },
    );
  }
  return new AiProviderError(
    "TASK_EXECUTION_FAILED",
    `${provider} returned HTTP ${status}${snippet ? `: ${snippet}` : ""}`,
    { provider, retryable: false, statusCode: status },
  );
}
