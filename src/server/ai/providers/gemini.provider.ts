import type { z } from "zod";
import type { AiUsageMetadata } from "@/lib/domain/ai";
import { env, isGeminiConfigured } from "@/lib/env";
import {
  buildEstimatedUsage,
  estimateTokensFromText,
  fetchWithTimeout,
  normalizeHttpProviderError,
  parseAndValidateStructuredJson,
} from "./json-output";
import {
  AiProviderError,
  type AiModelConfig,
  type AiProvider,
  type AiProviderCapabilities,
  type AiProviderHealth,
  type AiStructuredRequest,
  type AiStructuredResponse,
  type FetchLike,
} from "./provider.types";

const GEMINI_INPUT_USD_PER_1K = 0.0001;
const GEMINI_OUTPUT_USD_PER_1K = 0.0004;

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini (Cloud AI)";
  readonly locality = "cloud" as const;
  readonly capabilities: AiProviderCapabilities = {
    locality: "cloud",
    structuredOutput: "json_object",
    jsonMode: true,
    streaming: true,
    vision: true,
    maxContextTokens: 1_000_000,
    supportsSystemRole: true,
  };

  private readonly fetchFn?: FetchLike;
  private readonly apiKeyOverride?: string;

  constructor(options?: { fetchFn?: FetchLike; apiKeyOverride?: string }) {
    this.fetchFn = options?.fetchFn;
    this.apiKeyOverride = options?.apiKeyOverride;
  }

  private getApiKey(): string {
    return (this.apiKeyOverride ?? env.GEMINI_API_KEY).trim();
  }

  private getBaseUrl(): string {
    return (
      env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return Boolean(this.apiKeyOverride?.trim() || isGeminiConfigured());
  }

  getDefaultModel(config?: AiModelConfig): string {
    return config?.model?.trim() || env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  getDefaultTimeoutMs(): number {
    return env.AI_REQUEST_TIMEOUT_MS;
  }

  async checkHealth(config?: AiModelConfig): Promise<AiProviderHealth> {
    const defaultModel = this.getDefaultModel(config);
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        provider: "gemini",
        locality: "cloud",
        configured: false,
        available: false,
        defaultModel,
        models: [],
        reason: "GEMINI_API_KEY is not configured on the server.",
      };
    }

    const started = Date.now();
    try {
      const res = await fetchWithTimeout({
        url: `${this.getBaseUrl()}/models`,
        init: {
          method: "GET",
          headers: { "x-goog-api-key": apiKey },
        },
        timeoutMs: Math.min(config?.timeoutMs ?? 5000, 10_000),
        provider: "gemini",
        fetchFn: this.fetchFn,
      });

      if (!res.ok) {
        return {
          provider: "gemini",
          locality: "cloud",
          configured: true,
          available: false,
          defaultModel,
          models: [],
          latencyMs: Date.now() - started,
          reason: `Gemini health check returned HTTP ${res.status}.`,
        };
      }

      return {
        provider: "gemini",
        locality: "cloud",
        configured: true,
        available: true,
        defaultModel,
        models: [defaultModel],
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        provider: "gemini",
        locality: "cloud",
        configured: true,
        available: false,
        defaultModel,
        models: [],
        latencyMs: Date.now() - started,
        reason:
          err instanceof Error ? err.message : "Gemini endpoint unreachable.",
      };
    }
  }

  estimateUsage(request: {
    systemPrompt: string;
    userPrompt: string;
  }): AiUsageMetadata {
    return buildEstimatedUsage({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      costPer1kInputUsd: GEMINI_INPUT_USD_PER_1K,
      costPer1kOutputUsd: GEMINI_OUTPUT_USD_PER_1K,
    });
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AiStructuredRequest<TSchema>,
  ): Promise<AiStructuredResponse<z.infer<TSchema>>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AiProviderError(
        "PROVIDER_NOT_CONFIGURED",
        "Google Gemini is not configured (missing server GEMINI_API_KEY).",
        { provider: "gemini", retryable: false },
      );
    }

    const model = this.getDefaultModel(request.modelConfig);
    const started = Date.now();

    const userContent = request.outputContractHint
      ? `${request.userPrompt}\n\nOutput Schema Contract:\n${request.outputContractHint}`
      : request.userPrompt;

    const encodedModel = encodeURIComponent(model);
    const res = await fetchWithTimeout({
      url: `${this.getBaseUrl()}/models/${encodedModel}:generateContent`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userContent }],
            },
          ],
          generationConfig: {
            temperature: request.modelConfig?.temperature ?? 0.2,
            maxOutputTokens: request.modelConfig?.maxOutputTokens ?? 2048,
            responseMimeType: "application/json",
          },
        }),
      },
      timeoutMs: request.modelConfig?.timeoutMs,
      providerDefaultTimeoutMs: this.getDefaultTimeoutMs(),
      provider: "gemini",
      fetchFn: this.fetchFn,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw normalizeHttpProviderError({
        provider: "gemini",
        status: res.status,
        bodyText,
      });
    }

    let payload: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    try {
      payload = (await res.json()) as typeof payload;
    } catch (err) {
      throw new AiProviderError(
        "INVALID_OUTPUT",
        "Gemini returned a non-JSON HTTP response.",
        { provider: "gemini", retryable: false, cause: err },
      );
    }

    const rawText =
      payload.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";

    const data = parseAndValidateStructuredJson(
      rawText,
      request.schema,
      "gemini",
    );

    const inputTokens =
      payload.usageMetadata?.promptTokenCount ??
      estimateTokensFromText(request.systemPrompt) +
        estimateTokensFromText(userContent);
    const outputTokens =
      payload.usageMetadata?.candidatesTokenCount ??
      estimateTokensFromText(rawText);
    const totalTokens =
      payload.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

    const estimatedCostUsd = Number(
      (
        (inputTokens / 1000) * GEMINI_INPUT_USD_PER_1K +
        (outputTokens / 1000) * GEMINI_OUTPUT_USD_PER_1K
      ).toFixed(6),
    );

    return {
      data,
      rawText,
      provider: "gemini",
      locality: "cloud",
      model,
      finishReason: payload.candidates?.[0]?.finishReason,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs: Date.now() - started,
        isEstimated: payload.usageMetadata == null,
      },
    };
  }
}
