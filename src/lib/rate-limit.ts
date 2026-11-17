/**
 * Lightweight in-memory sliding-window rate limiter keyed by scope + identifier
 * (e.g. `sync-push:${userId}`). Safe for Next.js Route Handlers and Vitest.
 */

type BucketEntry = {
  timestamps: number[];
};

const globalRateLimiter = globalThis as unknown as {
  __catRateLimiter?: Map<string, BucketEntry>;
};

const buckets =
  globalRateLimiter.__catRateLimiter ??
  (globalRateLimiter.__catRateLimiter = new Map<string, BucketEntry>());

export function checkRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMs: number;
  nowMs?: number;
}): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = params.nowMs ?? Date.now();
  const cutoff = now - params.windowMs;
  const entry = buckets.get(params.key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= params.maxRequests) {
    const oldest = entry.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + params.windowMs - now) / 1000),
    );
    buckets.set(params.key, entry);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  entry.timestamps.push(now);
  buckets.set(params.key, entry);
  return {
    allowed: true,
    remaining: Math.max(0, params.maxRequests - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitKey(keyPrefix?: string) {
  if (!keyPrefix) {
    buckets.clear();
    return;
  }
  for (const key of buckets.keys()) {
    if (key.startsWith(keyPrefix)) buckets.delete(key);
  }
}
