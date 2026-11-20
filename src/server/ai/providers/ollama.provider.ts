import { z } from "zod";
import type { AiUsageMetadata } from "@/lib/domain/ai";
import { env } from "@/lib/env";
import { validateLocalAiEndpoint } from "../security/endpoint-validator";
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

export class OllamaProvider implements AiProvider {
  readonly id = "ollama" as const;
  readonly name = "Ollama (Local AI)";
  readonly locality = "local" as const;
  readonly capabilities: AiProviderCapabilities = {
    locality: "local",
    structuredOutput: "json_format",
    jsonMode: true,
    streaming: true,
    vision: false,
    maxContextTokens: 32_768,
    supportsSystemRole: true,
  };

  private readonly fetchFn?: FetchLike;

  constructor(options?: { fetchFn?: FetchLike }) {
    this.fetchFn = options?.fetchFn;
  }

  private resolveEndpoint(config?: AiModelConfig): string {
    const raw = config?.endpointOverride?.trim() || env.OLLAMA_BASE_URL.trim();
    const validation = validateLocalAiEndpoint(raw);
    if (!validation.valid || !validation.normalizedUrl) {
      throw new AiProviderError(
        "ENDPOINT_INVALID",
        validation.reason ?? "Invalid local Ollama endpoint configuration.",
        { provider: "ollama", retryable: false },
      );
    }
    return validation.normalizedUrl;
  }

  isConfigured(config?: AiModelConfig): boolean {
    const raw = config?.endpointOverride?.trim() || env.OLLAMA_BASE_URL.trim();
    return validateLocalAiEndpoint(raw).valid;
  }

  getDefaultModel(config?: AiModelConfig): string {
    return config?.model?.trim() || env.OLLAMA_MODEL || "qwen2.5:7b";
  }

  getDefaultTimeoutMs(): number {
    return env.OLLAMA_REQUEST_TIMEOUT_MS;
  }

  async checkHealth(config?: AiModelConfig): Promise<AiProviderHealth> {
    const defaultModel = this.getDefaultModel(config);
    let baseUrl: string;
    try {
      baseUrl = this.resolveEndpoint(config);
    } catch (err) {
      return {
        provider: "ollama",
        locality: "local",
        configured: false,
        available: false,
        defaultModel,
        models: [],
        reason: err instanceof Error ? err.message : "Invalid endpoint",
      };
    }

    const started = Date.now();
    try {
      const res = await fetchWithTimeout({
        url: `${baseUrl}/api/tags`,
        init: { method: "GET" },
        timeoutMs: Math.min(config?.timeoutMs ?? 5000, 10_000),
        provider: "ollama",
        fetchFn: this.fetchFn,
      });

      if (!res.ok) {
        return {
          provider: "ollama",
          locality: "local",
          configured: true,
          available: false,
          defaultModel,
          models: [],
          latencyMs: Date.now() - started,
          reason: `Ollama health check returned HTTP ${res.status}`,
        };
      }

      const body = (await res.json()) as {
        models?: Array<{ name?: string }>;
      };
      const models = (body.models ?? [])
        .map((m) => m.name)
        .filter((n): n is string => Boolean(n));

      return {
        provider: "ollama",
        locality: "local",
        configured: true,
        available: true,
        defaultModel,
        models,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        provider: "ollama",
        locality: "local",
        configured: true,
        available: false,
        defaultModel,
        models: [],
        latencyMs: Date.now() - started,
        reason:
          err instanceof Error
            ? err.message
            : "Local Ollama daemon unreachable.",
      };
    }
  }

  estimateUsage(request: {
    systemPrompt: string;
    userPrompt: string;
    modelConfig?: AiModelConfig;
  }): AiUsageMetadata {
    return buildEstimatedUsage({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      costPer1kInputUsd: 0,
      costPer1kOutputUsd: 0,
    });
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AiStructuredRequest<TSchema>,
  ): Promise<AiStructuredResponse<z.infer<TSchema>>> {
    if (request.requiresVision && !this.capabilities.vision) {
      throw new AiProviderError(
        "UNSUPPORTED_CAPABILITY",
        "Ollama adapter is not configured for vision input.",
        { provider: "ollama", retryable: false },
      );
    }

    const baseUrl = this.resolveEndpoint(request.modelConfig);
    const model = this.getDefaultModel(request.modelConfig);
    const started = Date.now();

    const userContent = request.outputContractHint
      ? `${request.userPrompt}\n\nOutput Schema Contract:\n${request.outputContractHint}`
      : request.userPrompt;

    // `format: "json"` only guarantees valid JSON, not the task's shape. Small
    // local models routinely return wrong-typed fields when the contract is
    // text-only. Passing the Zod-derived JSON Schema makes Ollama constrain
    // generation to the schema, so INVALID_OUTPUT becomes exceptional.
    const responseFormat = z.toJSONSchema(request.schema);

    const res = await fetchWithTimeout({
      url: `${baseUrl}/api/chat`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: responseFormat,
          options: {
            temperature: request.modelConfig?.temperature ?? 0.2,
            num_predict: request.modelConfig?.maxOutputTokens ?? 2048,
          },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      },
      timeoutMs: request.modelConfig?.timeoutMs,
      providerDefaultTimeoutMs: this.getDefaultTimeoutMs(),
      provider: "ollama",
      fetchFn: this.fetchFn,
      diagnostics: {
        taskType: request.taskType,
        model,
        promptChars: request.systemPrompt.length + userContent.length,
        estimatedInputTokens:
          estimateTokensFromText(request.systemPrompt) +
          estimateTokensFromText(userContent),
        outputTokenLimit: request.modelConfig?.maxOutputTokens ?? 2048,
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw normalizeHttpProviderError({
        provider: "ollama",
        status: res.status,
        bodyText,
      });
    }

    let jsonBody: {
      message?: { content?: string };
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    try {
      jsonBody = (await res.json()) as typeof jsonBody;
    } catch (err) {
      throw new AiProviderError(
        "INVALID_OUTPUT",
        "Ollama returned a non-JSON HTTP payload.",
        { provider: "ollama", retryable: false, cause: err },
      );
    }

    const rawText = jsonBody.message?.content ?? "";
    const data = parseAndValidateStructuredJson(
      rawText,
      request.schema,
      "ollama",
    );

    const inputTokens =
      jsonBody.prompt_eval_count ??
      estimateTokensFromText(request.systemPrompt) +
        estimateTokensFromText(userContent);
    const outputTokens =
      jsonBody.eval_count ?? estimateTokensFromText(rawText);

    return {
      data,
      rawText,
      provider: "ollama",
      locality: "local",
      model,
      finishReason: jsonBody.done_reason,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        isEstimated:
          jsonBody.prompt_eval_count == null || jsonBody.eval_count == null,
      },
    };
  }
}
