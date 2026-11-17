import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/** Matches the 10-minute maxAge of the OAuth state cookie (start/route.ts). */
const OAUTH_STATE_TTL_MS = 600_000;

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
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [json, sig] = parts;
  if (!json || !sig) return null;
  const expected = createHmac("sha256", deriveKey32())
    .update(json)
    .digest("base64url");
  // Constant-time signature comparison (DEF-11-001): compare decoded bytes so
  // the mismatch signal does not leak through early-exit string equality.
  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // Replay protection (DEF-11-001): reject states older than the cookie TTL
  // (or implausibly future-dated) so a captured state cannot be reused later.
  const ts = Number(parsed?.ts);
  if (!Number.isFinite(ts)) return null;
  const age = Date.now() - ts;
  if (age > OAUTH_STATE_TTL_MS || age < -OAUTH_STATE_TTL_MS) return null;
  return parsed;
}

/**
 * Generates a short-lived HMAC-signed download token for secure, direct file
 * access without leaking credentials or enabling unbounded file harvesting.
 */
export function createSignedDownloadToken(params: {
  userId: string;
  versionId: string;
  expiresInSeconds?: number;
}): string {
  const expiresInSeconds = params.expiresInSeconds ?? 300; // 5 minutes default
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const rawPayload = JSON.stringify({
    u: params.userId,
    v: params.versionId,
    exp,
  });
  const encodedPayload = Buffer.from(rawPayload, "utf8").toString("base64url");
  const sig = createHmac("sha256", deriveKey32())
    .update(`${encodedPayload}`)
    .digest("base64url");
  return `${encodedPayload}.${sig}`;
}

/**
 * Validates a short-lived HMAC-signed download token and ensures it is unexpired
 * and untampered.
 */
export function verifySignedDownloadToken(
  token: string,
): { userId: string; versionId: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  const expectedSig = createHmac("sha256", deriveKey32())
    .update(encodedPayload)
    .digest("base64url");
  // Constant-time comparison (DEF-11-001, same defect class as OAuth state).
  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const raw = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { u?: string; v?: string; exp?: number };
    if (!parsed.u || !parsed.v || typeof parsed.exp !== "number") {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp < now) {
      return null; // Expired
    }
    return {
      userId: parsed.u,
      versionId: parsed.v,
    };
  } catch {
    return null;
  }
}
