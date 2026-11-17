/**
 * Hybrid AI Engine domain types, enums, privacy modes, and usage metadata.
 * Pure, isomorphic definitions shared across DB schema, server AI router/services, and UI settings.
 */

export const AI_PROVIDERS = ["ollama", "openai", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_PREFERRED_PROVIDERS = ["auto", ...AI_PROVIDERS] as const;
export type AiPreferredProvider = (typeof AI_PREFERRED_PROVIDERS)[number];

export const AI_LOCALITIES = ["local", "cloud"] as const;
export type AiLocality = (typeof AI_LOCALITIES)[number];

export const AI_PRIVACY_MODES = [
  "local_only",
  "cloud_allowed",
  "ask_before_each",
] as const;
export type AiPrivacyMode = (typeof AI_PRIVACY_MODES)[number];

export const AI_PRIVACY_MODE_LABELS: Record<AiPrivacyMode, string> = {
  local_only: "Local AI Only",
  cloud_allowed: "Cloud AI (With Document Consent)",
  ask_before_each: "Ask Before Every AI Task",
};

export const AI_PRIVACY_MODE_DESCRIPTIONS: Record<AiPrivacyMode, string> = {
  local_only:
    "Strictly process career data on your local AI endpoint (e.g. Ollama). Cloud AI providers are blocked.",
  cloud_allowed:
    "Allow cloud AI providers (OpenAI / Gemini) when configured, while still requiring explicit consent before sending private career documents.",
  ask_before_each:
    "Pause every AI task for explicit confirmation before transmitting or processing data.",
};

export const AI_PROVIDER_LABELS: Record<AiPreferredProvider, string> = {
  auto: "Automatic (Respect Privacy Mode)",
  ollama: "Ollama (Local)",
  openai: "OpenAI (Cloud)",
  gemini: "Google Gemini (Cloud)",
};

export const AI_TASK_TYPES = [
  "cv_parse",
  "cv_evaluate",
  "job_match",
  "cv_correction",
  "cv_generate",
  "skill_gap",
  "career_roadmap",
  "interview_coach",
] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_JOB_STATUSES = [
  "awaiting_consent",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const AI_SOURCE_TYPES = [
  "career_profile",
  "document_version",
  "job_vacancy",
  "application",
  "archive_snapshot",
  "interview",
  "raw_text",
] as const;
export type AiSourceType = (typeof AI_SOURCE_TYPES)[number];

export const AI_FEEDBACK_ACTIONS = [
  "accepted",
  "partially_accepted",
  "rejected",
  "edited",
  "reported_hallucination",
  "comment_only",
] as const;
export type AiFeedbackAction = (typeof AI_FEEDBACK_ACTIONS)[number];

export const AI_LOCALES = ["id", "en"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

export interface AiUsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  isEstimated: boolean;
}

export interface AiProviderSanitizedStatus {
  id: AiProviderId;
  label: string;
  locality: AiLocality;
  configured: boolean;
  defaultModel: string;
}

export const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
