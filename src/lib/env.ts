import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional().default(""),
  PGLITE_DATA_DIR: z.string().default("./.data/pglite"),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_TENANT_ID: z.string().optional().default("common"),
  // Hybrid AI Provider Configuration (strictly server-side)
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_BASE_URL: z.string().optional().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_BASE_URL: z
    .string()
    .optional()
    .default("https://generativelanguage.googleapis.com/v1beta"),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
  OLLAMA_BASE_URL: z.string().optional().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().optional().default("qwen2.5:7b"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(30000),
  AI_ALLOW_PRIVATE_LOCAL_ENDPOINT: z.string().optional().default("false"),
  // Payment Gateway Sandbox Configuration (real-money checkout requires explicit owner approval)
  PAYMENT_MODE: z.enum(["disabled", "sandbox"]).default("disabled"),
  MIDTRANS_SERVER_KEY: z.string().optional().default(""),
  MIDTRANS_CLIENT_KEY: z.string().optional().default(""),
  MIDTRANS_SNAP_BASE_URL: z
    .string()
    .optional()
    .default("https://app.sandbox.midtrans.com/snap/v1"),
  MIDTRANS_API_BASE_URL: z
    .string()
    .optional()
    .default("https://api.sandbox.midtrans.com/v2"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_API_BASE_URL: z.string().optional().default("https://api.stripe.com/v1"),
  PAYMENT_WEBHOOK_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(86400)
    .default(300),
  // Hybrid Sync Subsystem (disabled until explicitly configured & approved)
  SYNC_MODE: z.enum(["disabled", "sandbox"]).default("disabled"),
  SYNC_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(5).max(1000).default(60),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const data = parsed.data;
  if (data.NODE_ENV === "production" && !data.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is required in production. Run `npm run setup` or set it in environment variables.",
    );
  }
  return {
    ...data,
    BETTER_AUTH_SECRET:
      data.BETTER_AUTH_SECRET ??
      "local-dev-only-secret-run-npm-run-setup-to-replace-32b",
  };
}

export const env = loadEnv();

export function isGmailOAuthConfigured(): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID.trim() && env.GOOGLE_CLIENT_SECRET.trim(),
  );
}

export function isOutlookOAuthConfigured(): boolean {
  return Boolean(
    env.MICROSOFT_CLIENT_ID.trim() && env.MICROSOFT_CLIENT_SECRET.trim(),
  );
}

export function isOpenAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY.trim());
}

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY.trim());
}

export function isOllamaConfigured(): boolean {
  return Boolean(env.OLLAMA_BASE_URL.trim());
}

export function isMidtransSandboxConfigured(): boolean {
  return (
    env.PAYMENT_MODE === "sandbox" &&
    Boolean(env.MIDTRANS_SERVER_KEY.trim()) &&
    !env.MIDTRANS_SERVER_KEY.startsWith("Mid-server-") // live prefix blocked without explicit prod enablement
  );
}

export function isStripeSandboxConfigured(): boolean {
  return (
    env.PAYMENT_MODE === "sandbox" &&
    Boolean(env.STRIPE_SECRET_KEY.trim()) &&
    !env.STRIPE_SECRET_KEY.startsWith("sk_live_")
  );
}

export function isHybridSyncEnabled(): boolean {
  return env.SYNC_MODE === "sandbox";
}
