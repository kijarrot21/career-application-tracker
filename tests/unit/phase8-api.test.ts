import { NextResponse } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import {
  API_ERROR_CODES,
  ApiError,
  assertValidUuid,
  buildPaginationMeta,
  paginateArray,
} from "@/lib/api/v1";
import { InsufficientCreditsError } from "@/lib/domain/credits";
import { PaymentError, PaymentSignatureError } from "@/lib/domain/payments";
import { SyncForbiddenEntityError } from "@/lib/domain/sync";
import { AiProviderError } from "@/server/ai/providers";
import { v1Error, v1Success } from "@/server/api/v1-handler";

afterEach(() => {
  // No shared mutable globals
});

describe("Phase 8 Unit - Versioned API Standards", () => {
  it("builds accurate pagination metadata and slices collections safely", () => {
    const items = ["a", "b", "c", "d", "e"];
    const page1 = paginateArray(items, 1, 2);
    expect(page1.items).toEqual(["a", "b"]);
    expect(page1.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const page3 = paginateArray(items, 3, 2);
    expect(page3.items).toEqual(["e"]);
    expect(page3.pagination.hasNextPage).toBe(false);
    expect(page3.pagination.hasPrevPage).toBe(true);

    expect(buildPaginationMeta(0, 1, 20)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it("validates UUID path parameters strictly", () => {
    const valid = "11111111-2222-4333-8444-555555555555";
    expect(assertValidUuid(valid)).toBe(valid);
    expect(() => assertValidUuid("not-a-uuid", "archive ID")).toThrow(ApiError);
  });

  it("formats v1 success envelopes with API version, requestId, and rate limit headers", async () => {
    const res = v1Success(
      { hello: "world" },
      {
        status: 201,
        requestId: "req-unit-1",
        rateLimit: { limit: 60, remaining: 59 },
      },
    );

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(201);
    expect(res.headers.get("X-API-Version")).toBe("v1");
    expect(res.headers.get("X-Request-Id")).toBe("req-unit-1");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("59");

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      apiVersion: "v1",
      requestId: "req-unit-1",
      data: { hello: "world" },
    });
  });

  it("maps domain errors accurately and masks internal DB/runtime details on 500", async () => {
    const cases: Array<[unknown, number, string]> = [
      [
        new ZodError([
          {
            code: "custom",
            path: ["targetRole"],
            message: "Required",
          },
        ]),
        400,
        API_ERROR_CODES.VALIDATION_ERROR,
      ],
      [
        new InsufficientCreditsError({
          requiredCredits: 5,
          availableCredits: 1,
          pricingKey: "cv_evaluate",
        }),
        402,
        API_ERROR_CODES.INSUFFICIENT_CREDITS,
      ],
      [
        new PaymentSignatureError("Bad HMAC signature"),
        401,
        "INVALID_WEBHOOK_SIGNATURE",
      ],
      [
        new PaymentError("CONFLICT", "Already paid", 409),
        409,
        "CONFLICT",
      ],
      [
        new SyncForbiddenEntityError("credit_wallets"),
        403,
        "SYNC_FORBIDDEN_ENTITY",
      ],
      [
        new AiProviderError("CONSENT_REQUIRED", "Consent needed"),
        403,
        "CONSENT_REQUIRED",
      ],
      [new AiProviderError("TIMEOUT", "Timed out"), 504, "TIMEOUT"],
    ];

    for (const [err, expectedStatus, expectedCode] of cases) {
      const res = v1Error(err, { requestId: "req-err" });
      expect(res.status).toBe(expectedStatus);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.apiVersion).toBe("v1");
      expect(body.error.code).toBe(expectedCode);
    }

    // Never expose raw SQL / Postgres connection secrets on unexpected 500 errors
    const leakErr = new Error(
      "relation \"credit_wallets\" violates constraint on postgres://secret:pass@host/db",
    );
    const hiddenRes = v1Error(leakErr, { requestId: "req-leak" });
    expect(hiddenRes.status).toBe(500);
    const hiddenBody = await hiddenRes.json();
    expect(hiddenBody.error.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
    expect(hiddenBody.error.message).toBe("An unexpected internal error occurred.");
    expect(JSON.stringify(hiddenBody)).not.toContain("postgres://");
    expect(JSON.stringify(hiddenBody)).not.toContain("credit_wallets");
    expect(z).toBeDefined();
  });
});

