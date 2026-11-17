import type {
  AiLocality,
  AiPreferredProvider,
  AiPrivacyMode,
  AiProviderId,
} from "@/lib/domain/ai";
import { validateLocalAiEndpoint } from "../security/endpoint-validator";
import {
  AiProviderError,
  type AiModelConfig,
  type AiProvider,
  type AiProviderRegistry,
  createDefaultProviderRegistry,
} from "../providers";

export interface ProviderSelectionInput {
  privacyMode: AiPrivacyMode;
  preferredProvider: AiPreferredProvider;
  requestedProvider?: AiProviderId;
  requestedModel?: string;
  ollamaEndpoint?: string | null;
  ollamaModel?: string | null;
  cloudDocumentConsent: boolean;
  containsPrivateDocuments: boolean;
  perTaskConsentGranted?: boolean;
  checkAvailability?: boolean;
  registry?: AiProviderRegistry;
}

export interface ProviderSelectionResult {
  provider: AiProvider;
  providerId: AiProviderId;
  locality: AiLocality;
  modelConfig: AiModelConfig;
  resolvedModel: string;
  consentRequired: boolean;
  consentGranted: boolean;
  consentReason: string | null;
}

const DEFAULT_PRIORITY_ORDER: AiProviderId[] = ["ollama", "openai", "gemini"];

export async function selectAiProvider(
  input: ProviderSelectionInput,
): Promise<ProviderSelectionResult> {
  const registry = input.registry ?? createDefaultProviderRegistry();

  const buildConfigFor = (id: AiProviderId): AiModelConfig => {
    if (id === "ollama") {
      return {
        model: input.requestedModel || input.ollamaModel || undefined,
        endpointOverride: input.ollamaEndpoint || undefined,
      };
    }
    return {
      model: input.requestedModel || undefined,
    };
  };

  // Validate custom local endpoint early if provided
  if (input.ollamaEndpoint && input.ollamaEndpoint.trim()) {
    const check = validateLocalAiEndpoint(input.ollamaEndpoint);
    if (!check.valid) {
      throw new AiProviderError(
        "ENDPOINT_INVALID",
        check.reason ?? "Invalid local AI endpoint configuration.",
        { provider: "ollama", retryable: false },
      );
    }
  }

  const explicitTarget: AiProviderId | "auto" =
    input.requestedProvider ?? input.preferredProvider;

  // Enforce Local AI Only boundary strictly
  if (input.privacyMode === "local_only") {
    if (explicitTarget !== "auto" && explicitTarget !== "ollama") {
      throw new AiProviderError(
        "PRIVACY_MODE_BLOCKED",
        `Provider '${explicitTarget}' is blocked because AI Privacy Mode is set to 'Local AI Only'.`,
        { provider: explicitTarget, retryable: false },
      );
    }
  }

  let selected: AiProvider | undefined;
  let selectedConfig: AiModelConfig = {};

  if (explicitTarget !== "auto") {
    const candidate = registry[explicitTarget];
    const cfg = buildConfigFor(explicitTarget);
    if (!candidate.isConfigured(cfg)) {
      throw new AiProviderError(
        "PROVIDER_NOT_CONFIGURED",
        `Selected AI provider '${explicitTarget}' is not configured.`,
        { provider: explicitTarget, retryable: false },
      );
    }
    if (input.checkAvailability) {
      const health = await candidate.checkHealth(cfg);
      if (!health.available) {
        throw new AiProviderError(
          "PROVIDER_UNAVAILABLE",
          health.reason ?? `Provider '${explicitTarget}' is currently unavailable.`,
          { provider: explicitTarget, retryable: true },
        );
      }
    }
    selected = candidate;
    selectedConfig = cfg;
  } else {
    const candidates =
      input.privacyMode === "local_only"
        ? (["ollama"] as AiProviderId[])
        : DEFAULT_PRIORITY_ORDER;

    for (const id of candidates) {
      const candidate = registry[id];
      const cfg = buildConfigFor(id);
      if (!candidate.isConfigured(cfg)) continue;

      if (input.checkAvailability) {
        const health = await candidate.checkHealth(cfg);
        if (!health.available) continue;
      }

      selected = candidate;
      selectedConfig = cfg;
      break;
    }
  }

  if (!selected) {
    throw new AiProviderError(
      "PROVIDER_UNAVAILABLE",
      input.privacyMode === "local_only"
        ? "No local AI provider is available. Verify your Ollama endpoint configuration."
        : "No configured or reachable AI provider is available.",
      { retryable: true },
    );
  }

  // Evaluate privacy mode & cloud document consent policy
  const isCloud = selected.locality === "cloud";
  let consentRequired = false;
  let consentReason: string | null = null;

  if (input.privacyMode === "ask_before_each") {
    consentRequired = true;
    consentReason = isCloud
      ? `AI Privacy Mode is 'Ask Before Every AI Task' and provider '${selected.id}' uses cloud processing.`
      : `AI Privacy Mode is 'Ask Before Every AI Task'. Confirm before running '${selected.id}'.`;
  } else if (
    isCloud &&
    input.containsPrivateDocuments &&
    !input.cloudDocumentConsent
  ) {
    consentRequired = true;
    consentReason = `Explicit user consent is required before sending private career documents to cloud provider '${selected.id}'.`;
  }

  const consentGranted = consentRequired
    ? input.perTaskConsentGranted === true
    : true;

  return {
    provider: selected,
    providerId: selected.id,
    locality: selected.locality,
    modelConfig: selectedConfig,
    resolvedModel: selected.getDefaultModel(selectedConfig),
    consentRequired,
    consentGranted,
    consentReason,
  };
}
