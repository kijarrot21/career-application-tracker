import type { z } from "zod";
import type { AiUsageMetadata } from "@/lib/domain/ai";
import { env, isOpenAiConfigured } from "@/lib/env";
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

const OPENAI_INPUT_USD_PER_1K = 0.00015;
const OPENAI_OUTPUT_USD_PER_1K = 0.0006;

export class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI (Cloud AI)";
  readonly locality = "cloud" as const;
  readonly capabilities: AiProviderCapabilities = {
    locality: "cloud",
    structuredOutput: "json_object",
    jsonMode: true,
    streaming: true,
    vision: true,
    maxContextTokens: 128_000,
    supportsSystemRole: true,
  };

  private readonly fetchFn?: FetchLike;
  private readonly apiKeyOverride?: string;

  constructor(options?: { fetchFn?: FetchLike; apiKeyOverride?: string }) {
    this.fetchFn = options?.fetchFn;
    this.apiKeyOverride = options?.apiKeyOverride;
  }

  private getApiKey(): string {
    return (this.apiKeyOverride ?? env.OPENAI_API_KEY).trim();
  }

  private getBaseUrl(): string {
    return (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKeyOverride?.trim() || isOpenAiConfigured());
  }

  getDefaultModel(config?: AiModelConfig): string {
    return config?.model?.trim() || env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async checkHealth(config?: AiModelConfig): Promise<AiProviderHealth> {
    const defaultModel = this.getDefaultModel(config);
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        provider: "openai",
        locality: "cloud",
        configured: false,
        available: false,
        defaultModel,
        models: [],
        reason: "OPENAI_API_KEY is not configured on the server.",
      };
    }

    const started = Date.now();
    try {
      const res = await fetchWithTimeout({
        url: `${this.getBaseUrl()}/models`,
        init: {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        timeoutMs: Math.min(config?.timeoutMs ?? 5000, 10_000),
        provider: "openai",
        fetchFn: this.fetchFn,
      });

      if (!res.ok) {
        return {
          provider: "openai",
          locality: "cloud",
          configured: true,
          available: false,
          defaultModel,
          models: [],
          latencyMs: Date.now() - started,
          reason: `OpenAI health check returned HTTP ${res.status}.`,
        };
      }

      return {
        provider: "openai",
        locality: "cloud",
        configured: true,
        available: true,
        defaultModel,
        models: [defaultModel],
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        provider: "openai",
        locality: "cloud",
        configured: true,
        available: false,
        defaultModel,
        models: [],
        latencyMs: Date.now() - started,
        reason:
          err instanceof Error ? err.message : "OpenAI endpoint unreachable.",
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
      costPer1kInputUsd: OPENAI_INPUT_USD_PER_1K,
      costPer1kOutputUsd: OPENAI_OUTPUT_USD_PER_1K,
    });
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AiStructuredRequest<TSchema>,
  ): Promise<AiStructuredResponse<z.infer<TSchema>>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AiProviderError(
        "PROVIDER_NOT_CONFIGURED",
        "OpenAI is not configured (missing server OPENAI_API_KEY).",
        { provider: "openai", retryable: false },
      );
    }

    const model = this.getDefaultModel(request.modelConfig);
    const started = Date.now();

    const userContent = request.outputContractHint
      ? `${request.userPrompt}\n\nOutput Schema Contract:\n${request.outputContractHint}`
      : request.userPrompt;

    const res = await fetchWithTimeout({
      url: `${this.getBaseUrl()}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: request.modelConfig?.temperature ?? 0.2,
          max_tokens: request.modelConfig?.maxOutputTokens ?? 2048,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      },
      timeoutMs: request.modelConfig?.timeoutMs,
      provider: "openai",
      fetchFn: this.fetchFn,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw normalizeHttpProviderError({
        provider: "openai",
        status: res.status,
        bodyText,
      });
    }

    let payload: {
      choices?: Array<{
        message?: { content?: string | null };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    try {
      payload = (await res.json()) as typeof payload;
    } catch (err) {
      throw new AiProviderError(
        "INVALID_OUTPUT",
        "OpenAI returned a non-JSON HTTP response.",
        { provider: "openai", retryable: false, cause: err },
      );
    }

    const rawText = payload.choices?.[0]?.message?.content ?? "";
    const data = parseAndValidateStructuredJson(
      rawText,
      request.schema,
      "openai",
    );

    const inputTokens =
      payload.usage?.prompt_tokens ??
      estimateTokensFromText(request.systemPrompt) +
        estimateTokensFromText(userContent);
    const outputTokens =
      payload.usage?.completion_tokens ?? estimateTokensFromText(rawText);
    const totalTokens =
      payload.usage?.total_tokens ?? inputTokens + outputTokens;

    const estimatedCostUsd = Number(
      (
        (inputTokens / 1000) * OPENAI_INPUT_USD_PER_1K +
        (outputTokens / 1000) * OPENAI_OUTPUT_USD_PER_1K
      ).toFixed(6),
    );

    return {
      data,
      rawText,
      provider: "openai",
      locality: "cloud",
      model,
      finishReason: payload.choices?.[0]?.finish_reason,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs: Date.now() - started,
        isEstimated: payload.usage == null,
      },
    };
  }
}
