import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  API_ERROR_CODES,
  API_VERSION,
  ApiError,
  type ApiErrorEnvelope,
  type ApiPaginationMeta,
  type ApiSuccessEnvelope,
} from "@/lib/api/v1";
import { InsufficientCreditsError } from "@/lib/domain/credits";
import { PaymentError, PaymentSignatureError } from "@/lib/domain/payments";
import { SyncError } from "@/lib/domain/sync";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOptionalUser } from "@/lib/session";
import { UnsupportedDocumentFormatError } from "@/server/ai/extractors/document-text-extractor";
import { AiProviderError } from "@/server/ai/providers";

export interface V1AuthContext {
  userId: string;
  requestId: string;
  idempotencyKey?: string;
  rateLimit: {
    limit: number;
    remaining: number;
  };
}

export interface V1WebhookContext {
  requestId: string;
  rateLimit: {
    limit: number;
    remaining: number;
  };
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  retryAfterSeconds?: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
  };
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return headers;
}

export async function requireV1AuthContext(
  request: NextRequest,
  scope: string,
  maxRequestsPerMin = env.SYNC_RATE_LIMIT_PER_MIN || 60,
): Promise<
  | { ok: true; ctx: V1AuthContext }
  | { ok: false; response: NextResponse<ApiErrorEnvelope> }
> {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const user = await getOptionalUser();
  if (!user) {
    return {
      ok: false,
      response: v1Error(
        new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          "Authentication required.",
          401,
        ),
        { requestId },
      ),
    };
  }

  const limit = Math.max(1, maxRequestsPerMin);
  const rl = checkRateLimit({
    key: `v1:${user.id}:${scope}`,
    maxRequests: limit,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return {
      ok: false,
      response: v1Error(
        new ApiError(
          API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          "Rate limit exceeded. Please retry shortly.",
          429,
        ),
        {
          requestId,
          headers: buildRateLimitHeaders(limit, 0, rl.retryAfterSeconds),
        },
      ),
    };
  }

  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() || undefined;

  return {
    ok: true,
    ctx: {
      userId: user.id,
      requestId,
      idempotencyKey,
      rateLimit: {
        limit,
        remaining: rl.remaining,
      },
    },
  };
}

export function requireV1WebhookContext(
  request: NextRequest,
  provider: string,
  maxRequestsPerMin = 120,
):
  | { ok: true; ctx: V1WebhookContext }
  | { ok: false; response: NextResponse<ApiErrorEnvelope> } {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const limit = Math.max(1, maxRequestsPerMin);
  const ip = getClientIp(request);
  const rl = checkRateLimit({
    key: `v1:webhook:${provider}:${ip}`,
    maxRequests: limit,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return {
      ok: false,
      response: v1Error(
        new ApiError(
          API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          "Webhook rate limit exceeded.",
          429,
        ),
        {
          requestId,
          headers: buildRateLimitHeaders(limit, 0, rl.retryAfterSeconds),
        },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      requestId,
      rateLimit: {
        limit,
        remaining: rl.remaining,
      },
    },
  };
}

export async function parseV1JsonBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiError(
      API_ERROR_CODES.INVALID_JSON,
      "Request body must be valid JSON.",
      400,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(
      API_ERROR_CODES.VALIDATION_ERROR,
      "Request body must be a JSON object.",
      400,
    );
  }

  return parsed as Record<string, unknown>;
}

export function v1Success<T>(
  data: T,
  options?: {
    status?: number;
    pagination?: ApiPaginationMeta;
    requestId?: string;
    rateLimit?: { limit: number; remaining: number };
    headers?: Record<string, string>;
  },
): NextResponse<ApiSuccessEnvelope<T>> {
  const requestId = options?.requestId ?? randomUUID();
  const payload: ApiSuccessEnvelope<T> = {
    ok: true,
    apiVersion: API_VERSION,
    requestId,
    data,
    ...(options?.pagination ? { pagination: options.pagination } : {}),
  };

  const headers: Record<string, string> = {
    "X-API-Version": API_VERSION,
    "X-Request-Id": requestId,
    "Cache-Control": "no-store",
    ...(options?.rateLimit
      ? buildRateLimitHeaders(
          options.rateLimit.limit,
          options.rateLimit.remaining,
        )
      : {}),
    ...options?.headers,
  };

  return NextResponse.json(payload, {
    status: options?.status ?? 200,
    headers,
  });
}

function classifyKnownError(err: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: "Request validation failed.",
      details: err.flatten(),
    };
  }

  if (err instanceof SyncError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
    };
  }

  if (err instanceof PaymentSignatureError) {
    return {
      statusCode: 401,
      code: err.code,
      message: err.message,
    };
  }

  if (err instanceof PaymentError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
    };
  }

  if (err instanceof InsufficientCreditsError) {
    return {
      statusCode: 402,
      code: API_ERROR_CODES.INSUFFICIENT_CREDITS,
      message: err.message,
    };
  }

  if (err instanceof UnsupportedDocumentFormatError) {
    return {
      statusCode: 400,
      code: API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: err.message,
    };
  }

  if (err instanceof AiProviderError) {
    const statusCode =
      err.code === "PRIVACY_MODE_BLOCKED" || err.code === "CONSENT_REQUIRED"
        ? 403
        : err.code === "TIMEOUT"
          ? 504
          : err.code === "RATE_LIMITED"
            ? 429
            : err.statusCode && err.statusCode >= 400 && err.statusCode < 600
              ? err.statusCode
              : 502;
    return {
      statusCode,
      code: err.code,
      message: err.message,
    };
  }

  // Never leak raw Error messages, SQL errors, file paths, or secrets on unexpected failures
  return {
    statusCode: 500,
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message: "An unexpected internal error occurred.",
  };
}

export function v1Error(
  err: unknown,
  options?: {
    requestId?: string;
    headers?: Record<string, string>;
  },
): NextResponse<ApiErrorEnvelope> {
  const requestId = options?.requestId ?? randomUUID();
  const mapped = classifyKnownError(err);

  const payload: ApiErrorEnvelope = {
    ok: false,
    apiVersion: API_VERSION,
    requestId,
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details !== undefined ? { details: mapped.details } : {}),
    },
  };

  return NextResponse.json(payload, {
    status: mapped.statusCode,
    headers: {
      "X-API-Version": API_VERSION,
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
      ...options?.headers,
    },
  });
}
