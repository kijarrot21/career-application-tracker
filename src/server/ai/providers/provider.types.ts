import type { z } from "zod";
import type {
  AiLocality,
  AiProviderId,
  AiTaskType,
  AiUsageMetadata,
} from "@/lib/domain/ai";

export type AiErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_UNAVAILABLE"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_OUTPUT"
  | "UNSUPPORTED_CAPABILITY"
  | "ENDPOINT_INVALID"
  | "CONSENT_REQUIRED"
  | "PRIVACY_MODE_BLOCKED"
  | "TASK_EXECUTION_FAILED";

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly provider?: AiProviderId;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    code: AiErrorCode,
    message: string,
    options?: {
      provider?: AiProviderId;
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AiProviderError";
    this.code = code;
    this.provider = options?.provider;
    this.retryable =
      options?.retryable ??
      (code === "TIMEOUT" ||
        code === "RATE_LIMITED" ||
        code === "PROVIDER_UNAVAILABLE");
    this.statusCode = options?.statusCode;
  }
}

export interface AiProviderCapabilities {
  locality: AiLocality;
  structuredOutput: "json_schema" | "json_object" | "json_format";
  jsonMode: boolean;
  streaming: boolean;
  vision: boolean;
  maxContextTokens: number;
  supportsSystemRole: boolean;
}

export interface AiModelConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  endpointOverride?: string | null;
}

export interface AiStructuredRequest<TSchema extends z.ZodTypeAny> {
  taskType: AiTaskType;
  systemPrompt: string;
  userPrompt: string;
  schema: TSchema;
  schemaName: string;
  outputContractHint?: string;
  modelConfig?: AiModelConfig;
  requiresVision?: boolean;
}

export interface AiStructuredResponse<TOutput> {
  data: TOutput;
  rawText: string;
  provider: AiProviderId;
  locality: AiLocality;
  model: string;
  usage: AiUsageMetadata;
  finishReason?: string;
}

export interface AiProviderHealth {
  provider: AiProviderId;
  locality: AiLocality;
  configured: boolean;
  available: boolean;
  defaultModel: string;
  models: string[];
  latencyMs?: number;
  reason?: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface AiProvider {
  readonly id: AiProviderId;
  readonly name: string;
  readonly locality: AiLocality;
  readonly capabilities: AiProviderCapabilities;
  isConfigured(config?: AiModelConfig): boolean;
  getDefaultModel(config?: AiModelConfig): string;
  checkHealth(config?: AiModelConfig): Promise<AiProviderHealth>;
  estimateUsage(request: {
    systemPrompt: string;
    userPrompt: string;
    modelConfig?: AiModelConfig;
  }): AiUsageMetadata;
  generateStructured<TSchema extends z.ZodTypeAny>(
    request: AiStructuredRequest<TSchema>,
  ): Promise<AiStructuredResponse<z.infer<TSchema>>>;
}
