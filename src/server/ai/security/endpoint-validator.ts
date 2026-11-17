import { env } from "@/lib/env";

const BLOCKED_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  "100.100.100.200",
  "0.0.0.0",
]);

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower.endsWith(".localhost")
  );
}

function isPrivateLanIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export interface LocalEndpointValidationResult {
  valid: boolean;
  normalizedUrl: string | null;
  reason?: string;
}

/**
 * Validates that a configured local AI endpoint (e.g. Ollama) points to a
 * legitimate local/loopback HTTP(S) target, preventing SSRF and preventing
 * "Local AI Only" mode from silently routing career data to remote cloud hosts.
 */
export function validateLocalAiEndpoint(
  rawUrl: string,
  options?: { allowPrivateNetwork?: boolean },
): LocalEndpointValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: null,
      reason: "Local AI endpoint URL cannot be empty.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      reason: "Local AI endpoint must be a valid URL (e.g. http://127.0.0.1:11434).",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      normalizedUrl: null,
      reason: "Local AI endpoint protocol must be http: or https:.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      normalizedUrl: null,
      reason: "Local AI endpoint URL must not embed credentials.",
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_METADATA_HOSTS.has(host) ||
    host.startsWith("169.254.")
  ) {
    return {
      valid: false,
      normalizedUrl: null,
      reason: "Cloud metadata and wildcard addresses are not allowed for local AI endpoints.",
    };
  }

  const allowPrivate =
    options?.allowPrivateNetwork ??
    env.AI_ALLOW_PRIVATE_LOCAL_ENDPOINT.toLowerCase() === "true";

  const allowed =
    isLoopbackHost(host) || (allowPrivate && isPrivateLanIpv4(host));

  if (!allowed) {
    return {
      valid: false,
      normalizedUrl: null,
      reason: allowPrivate
        ? "Local AI endpoint must target localhost, 127.0.0.1, ::1, or a private RFC1918 LAN IP."
        : "Local AI endpoint must target localhost, 127.0.0.1, or ::1.",
    };
  }

  // Strip query/hash and trailing slash for deterministic requests
  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  const normalizedUrl = `${parsed.protocol}//${parsed.host}${cleanPath}`;

  return {
    valid: true,
    normalizedUrl,
  };
}
