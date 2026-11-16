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
