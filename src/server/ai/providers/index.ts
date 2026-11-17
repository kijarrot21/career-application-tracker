import type {
  AiProviderId,
  AiProviderSanitizedStatus,
} from "@/lib/domain/ai";
import { GeminiProvider } from "./gemini.provider";
import { OllamaProvider } from "./ollama.provider";
import { OpenAiProvider } from "./openai.provider";
import type { AiProvider, FetchLike } from "./provider.types";

export * from "./provider.types";
export { OllamaProvider } from "./ollama.provider";
export { OpenAiProvider } from "./openai.provider";
export { GeminiProvider } from "./gemini.provider";

export type AiProviderRegistry = Record<AiProviderId, AiProvider>;

export function createDefaultProviderRegistry(options?: {
  fetchFn?: FetchLike;
}): AiProviderRegistry {
  return {
    ollama: new OllamaProvider({ fetchFn: options?.fetchFn }),
    openai: new OpenAiProvider({ fetchFn: options?.fetchFn }),
    gemini: new GeminiProvider({ fetchFn: options?.fetchFn }),
  };
}

/**
 * Returns non-secret provider availability metadata safe to pass to Settings UI.
 * Never exposes API keys or credentials.
 */
export function getSanitizedProviderStatuses(
  registry: AiProviderRegistry = createDefaultProviderRegistry(),
): AiProviderSanitizedStatus[] {
  return (["ollama", "openai", "gemini"] as const).map((id) => {
    const provider = registry[id];
    return {
      id: provider.id,
      label: provider.name,
      locality: provider.locality,
      configured: provider.isConfigured(),
      defaultModel: provider.getDefaultModel(),
    };
  });
}
