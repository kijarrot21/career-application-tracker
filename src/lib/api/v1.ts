import { z } from "zod";

export const API_VERSION = "v1" as const;

export const API_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_WEBHOOK_SIGNATURE: "INVALID_WEBHOOK_SIGNATURE",
  NOT_FOUND: "NOT_FOUND",
  INVALID_ID: "INVALID_ID",
  INVALID_JSON: "INVALID_JSON",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface ApiPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccessEnvelope<T> {
  ok: true;
  apiVersion: typeof API_VERSION;
  requestId: string;
  data: T;
  pagination?: ApiPaginationMeta;
}

export interface ApiErrorEnvelope {
  ok: false;
  apiVersion: typeof API_VERSION;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number,
): ApiPaginationMeta {
  const safeTotal = Math.max(0, total);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.max(1, page);

  return {
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; pagination: ApiPaginationMeta } {
  const pagination = buildPaginationMeta(items.length, page, pageSize);
  const offset = (pagination.page - 1) * pagination.pageSize;
  return {
    items: items.slice(offset, offset + pagination.pageSize),
    pagination,
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidUuid(id: string, label = "resource ID"): string {
  const trimmed = id.trim();
  if (!UUID_REGEX.test(trimmed)) {
    throw new ApiError(
      API_ERROR_CODES.INVALID_ID,
      `Invalid ${label} format; expected UUID.`,
      400,
    );
  }
  return trimmed;
}
