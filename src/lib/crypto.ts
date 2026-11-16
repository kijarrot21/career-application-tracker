import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { env } from "@/lib/env";

function deriveKey32(): Buffer {
  const raw = env.ENCRYPTION_KEY || env.BETTER_AUTH_SECRET;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Encrypts a sensitive string (such as an OAuth 2.0 refresh token) using
 * AES-256-GCM with a random 96-bit IV.
 */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey32();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted secret format.");
  }
  const key = deriveKey32();
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** PKCE code_verifier and S256 code_challenge generator. */
export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function signOAuthState(data: Record<string, string>): string {
  const json = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  const sig = createHmac("sha256", deriveKey32())
    .update(json)
    .digest("base64url");
  return `${json}.${sig}`;
}

export function verifyOAuthState(
  token: string,
): Record<string, string> | null {
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", deriveKey32())
    .update(json)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
