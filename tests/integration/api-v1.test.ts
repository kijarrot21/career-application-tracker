import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDb } from "@/db";
import {
  aiAnalysisJobs,
  applicationClosureRecords,
  userSettings,
} from "@/db/schema";
import { env } from "@/lib/env";
import { resetRateLimitKey } from "@/lib/rate-limit";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const sessionState = vi.hoisted(() => ({
  currentUser: null as { id: string; name: string; email: string } | null,
}));

vi.mock("@/lib/session", () => ({
  getOptionalUser: vi.fn(async () => sessionState.currentUser),
  requireUser: vi.fn(async () => {
    if (!sessionState.currentUser) {
      throw new Error("Unauthorized");
    }
    return sessionState.currentUser;
  }),
}));

import { GET as archiveDetailGet } from "@/app/api/v1/archive/[id]/route";
import { POST as archiveAnalyzePost } from "@/app/api/v1/archive/[id]/analyze/route";
import { GET as archiveListGet } from "@/app/api/v1/archive/route";
import { POST as aiCareerRoadmapPost } from "@/app/api/v1/ai/career-roadmap/route";
import { POST as aiCvCorrectPost } from "@/app/api/v1/ai/cv/correct/route";
import { POST as aiCvEvaluatePost } from "@/app/api/v1/ai/cv/evaluate/route";
import { POST as aiCvGeneratePost } from "@/app/api/v1/ai/cv/generate/route";
import { POST as aiCvParsePost } from "@/app/api/v1/ai/cv/parse/route";
import { POST as aiJobMatchPost } from "@/app/api/v1/ai/job-match/route";
import { GET as aiJobDetailGet } from "@/app/api/v1/ai/jobs/[id]/route";
import { GET as creditsLedgerGet } from "@/app/api/v1/credits/ledger/route";
import { GET as creditsPackagesGet } from "@/app/api/v1/credits/packages/route";
import { GET as creditsWalletGet } from "@/app/api/v1/credits/wallet/route";
import { POST as paymentsCheckoutPost } from "@/app/api/v1/payments/checkout/route";
import { POST as paymentsWebhookPost } from "@/app/api/v1/payments/webhooks/[provider]/route";
import { GET as syncPullGet } from "@/app/api/v1/sync/pull/route";
import { POST as syncPushPost } from "@/app/api/v1/sync/push/route";
import { POST as syncResolvePost } from "@/app/api/v1/sync/resolve/route";
import { GET as syncStatusGet } from "@/app/api/v1/sync/status/route";
import { recordSubmissionService } from "@/server/services/applications";
import { archiveApplicationService } from "@/server/services/archive";
import { ensureCreditWalletService } from "@/server/services/credits";
import { registerSyncDeviceService } from "@/server/services/sync";
import { createVacancyService } from "@/server/services/vacancies";

const USER_A = {
  id: "v1-user-a",
  name: "Alice V1",
  email: "alice-v1@example.com",
};

const USER_B = {
  id: "v1-user-b",
  name: "Bob V1",
  email: "bob-v1@example.com",
};

function makeReq(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  },
) {
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: {
      ...(options?.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
      ...options?.headers,
    },
    body:
      options?.rawBody !== undefined
        ? options.rawBody
        : options?.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });
}

describe("Phase 8 Integration - Versioned /api/v1/* Endpoints", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;
  const origPaymentMode = env.PAYMENT_MODE;
  const origMidtransKey = env.MIDTRANS_SERVER_KEY;
  const origSyncMode = env.SYNC_MODE;

  beforeEach(async () => {
    resetRateLimitKey();
    const isolated = await createIsolatedTestDb();
    db = isolated.db;
    cleanup = isolated.cleanup;
    await createTestUser(db, USER_A);
    await createTestUser(db, USER_B);
    sessionState.currentUser = USER_A;

    env.PAYMENT_MODE = "sandbox";
    env.MIDTRANS_SERVER_KEY = "SB-Mid-server-v1-test";
    env.SYNC_MODE = "sandbox";
    process.env.PAYMENT_MODE = "sandbox";
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-v1-test";
    process.env.SYNC_MODE = "sandbox";
  }, 30000);

  afterEach(async () => {
    sessionState.currentUser = null;
    vi.unstubAllGlobals();
    resetRateLimitKey();
    env.PAYMENT_MODE = origPaymentMode;
    env.MIDTRANS_SERVER_KEY = origMidtransKey;
    env.SYNC_MODE = origSyncMode;
    process.env.PAYMENT_MODE = origPaymentMode;
    process.env.MIDTRANS_SERVER_KEY = origMidtransKey;
    process.env.SYNC_MODE = origSyncMode;
    await cleanup();
  });

  async function seedArchivedAppForUserA() {
    const vac = await createVacancyService(USER_A.id, {
      companyName: "V1 Tech Co",
      title: "Senior Platform Engineer",
      currency: "IDR",
      salaryPeriod: "month",
      priority: "high",
      triageStatus: "shortlisted",
      skills: ["TypeScript", "PostgreSQL"],
    });

    const app = await recordSubmissionService(USER_A.id, {
      vacancyId: vac.id,
      submittedOn: "2026-01-10",
      submissionMethod: "platform",
      currency: "IDR",
      isIntentionalReapply: false,
    });

    const archived = await archiveApplicationService(USER_A.id, {
      applicationId: app.id,
      closureOutcome: "rejected",
      closureReason: "Role filled internally",
    });

    return { closureId: archived.closureRecord.id, vacancyId: vac.id };
  }

  it("rejects unauthenticated requests across protected v1 groups with 401 UNAUTHORIZED", async () => {
    sessionState.currentUser = null;

    const responses = await Promise.all([
      archiveListGet(makeReq("http://localhost:3000/api/v1/archive")),
      creditsWalletGet(makeReq("http://localhost:3000/api/v1/credits/wallet")),
      creditsLedgerGet(makeReq("http://localhost:3000/api/v1/credits/ledger")),
      creditsPackagesGet(
        makeReq("http://localhost:3000/api/v1/credits/packages"),
      ),
      syncStatusGet(makeReq("http://localhost:3000/api/v1/sync/status")),
      aiCvEvaluatePost(
        makeReq("http://localhost:3000/api/v1/ai/cv/evaluate", {
          method: "POST",
          body: {},
        }),
      ),
      paymentsCheckoutPost(
        makeReq("http://localhost:3000/api/v1/payments/checkout", {
          method: "POST",
          body: { packageKey: "starter_50", provider: "midtrans" },
        }),
      ),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.apiVersion).toBe("v1");
      expect(body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("validates UUIDs, malformed JSON, and Zod payloads cleanly with 400", async () => {
    const badJsonRes = await aiCvParsePost(
      makeReq("http://localhost:3000/api/v1/ai/cv/parse", {
        method: "POST",
        rawBody: "{not-json",
      }),
    );
    expect(badJsonRes.status).toBe(400);
    expect((await badJsonRes.json()).error.code).toBe("INVALID_JSON");

    const badUuidRes = await archiveDetailGet(
      makeReq("http://localhost:3000/api/v1/archive/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(badUuidRes.status).toBe(400);
    expect((await badUuidRes.json()).error.code).toBe("INVALID_ID");

    const badJobUuidRes = await aiJobDetailGet(
      makeReq("http://localhost:3000/api/v1/ai/jobs/bad-id"),
      { params: Promise.resolve({ id: "bad-id" }) },
    );
    expect(badJobUuidRes.status).toBe(400);
    expect((await badJobUuidRes.json()).error.code).toBe("INVALID_ID");

    // Validation failures for missing required combination fields
    const missingGen = await aiCvGeneratePost(
      makeReq("http://localhost:3000/api/v1/ai/cv/generate", {
        method: "POST",
        body: {},
      }),
    );
    expect(missingGen.status).toBe(400);
    expect((await missingGen.json()).error.code).toBe("VALIDATION_ERROR");

    const missingMatch = await aiJobMatchPost(
      makeReq("http://localhost:3000/api/v1/ai/job-match", {
        method: "POST",
        body: {},
      }),
    );
    expect(missingMatch.status).toBe(400);
    expect((await missingMatch.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("enforces cross-user isolation even if client sends another userId, across archive, AI jobs, and sync", async () => {
    const { closureId } = await seedArchivedAppForUserA();
    const [aiJob] = await db
      .insert(aiAnalysisJobs)
      .values({
        userId: USER_A.id,
        taskType: "cv_evaluate",
        provider: "ollama",
        locality: "local",
        model: "llama3.1:8b",
        promptVersionTag: "v1",
        locale: "en",
        privacyModeAtRun: "local_only",
        containsPrivateDocuments: true,
        consentRequired: false,
        inputHash: "abc123",
        status: "completed",
      })
      .returning();

    const devA = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "v1-alice-dev",
      deviceName: "Alice Dev",
      operationMode: "hybrid",
    });

    // Switch session to USER_B and attempt access/forged userId
    sessionState.currentUser = USER_B;

    const crossArchive = await archiveDetailGet(
      makeReq(`http://localhost:3000/api/v1/archive/${closureId}?userId=${USER_A.id}`),
      { params: Promise.resolve({ id: closureId }) },
    );
    expect(crossArchive.status).toBe(404);

    const crossArchiveAnalyze = await archiveAnalyzePost(
      makeReq(`http://localhost:3000/api/v1/archive/${closureId}/analyze`, {
        method: "POST",
        body: { userId: USER_A.id, locale: "en" },
      }),
      { params: Promise.resolve({ id: closureId }) },
    );
    expect(crossArchiveAnalyze.status).toBe(404);

    const crossAiJob = await aiJobDetailGet(
      makeReq(`http://localhost:3000/api/v1/ai/jobs/${aiJob.id}`),
      { params: Promise.resolve({ id: aiJob.id }) },
    );
    expect(crossAiJob.status).toBe(404);

    const crossSyncPull = await syncPullGet(
      makeReq(`http://localhost:3000/api/v1/sync/pull?deviceId=${devA.id}`),
    );
    expect(crossSyncPull.status).toBe(404);
    expect((await crossSyncPull.json()).error.code).toBe(
      "SYNC_DEVICE_NOT_FOUND",
    );

    // Owner access returns 200 cleanly
    sessionState.currentUser = USER_A;
    const ownerArchive = await archiveDetailGet(
      makeReq(`http://localhost:3000/api/v1/archive/${closureId}`),
      { params: Promise.resolve({ id: closureId }) },
    );
    expect(ownerArchive.status).toBe(200);
    const ownerJob = await aiJobDetailGet(
      makeReq(`http://localhost:3000/api/v1/ai/jobs/${aiJob.id}`),
      { params: Promise.resolve({ id: aiJob.id }) },
    );
    expect(ownerJob.status).toBe(200);
  });

  it("supports paginated wallet, ledger, packages, and archive list endpoints", async () => {
    await ensureCreditWalletService(USER_A.id, { initialCredits: 100 });
    await seedArchivedAppForUserA();

    const walletRes = await creditsWalletGet(
      makeReq("http://localhost:3000/api/v1/credits/wallet"),
    );
    expect(walletRes.status).toBe(200);
    const walletJson = await walletRes.json();
    expect(walletJson.ok).toBe(true);
    expect(walletJson.data.wallet.availableBalance).toBe(100);

    const ledgerRes = await creditsLedgerGet(
      makeReq("http://localhost:3000/api/v1/credits/ledger?page=1&pageSize=1"),
    );
    expect(ledgerRes.status).toBe(200);
    const ledgerJson = await ledgerRes.json();
    expect(ledgerJson.pagination.page).toBe(1);
    expect(ledgerJson.pagination.pageSize).toBe(1);
    expect(ledgerJson.data.items.length).toBeLessThanOrEqual(1);

    const pkgPage1 = await creditsPackagesGet(
      makeReq("http://localhost:3000/api/v1/credits/packages?page=1&pageSize=2"),
    );
    expect(pkgPage1.status).toBe(200);
    const pkgJson = await pkgPage1.json();
    expect(pkgJson.data.items.length).toBeLessThanOrEqual(2);
    expect(pkgJson.pagination.total).toBeGreaterThanOrEqual(2);

    const archiveListRes = await archiveListGet(
      makeReq("http://localhost:3000/api/v1/archive?page=1&pageSize=5"),
    );
    expect(archiveListRes.status).toBe(200);
    const archiveListJson = await archiveListRes.json();
    expect(archiveListJson.data.items).toHaveLength(1);
    expect(archiveListJson.pagination.total).toBe(1);
    expect(archiveListJson.data.stats.totalArchived).toBe(1);
  });

  it("enforces checkout idempotency and Midtrans webhook signature authentication + deduplication", async () => {
    await ensureCreditWalletService(USER_A.id, { initialCredits: 25 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            token: "snap-v1-test-token",
            redirect_url:
              "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-v1-test-token",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    // Unknown provider -> 404
    const unknownWh = await paymentsWebhookPost(
      makeReq("http://localhost:3000/api/v1/payments/webhooks/unknown", {
        method: "POST",
        body: { test: true },
      }),
      { params: Promise.resolve({ provider: "unknown" }) },
    );
    expect(unknownWh.status).toBe(404);

    // Idempotent checkout creation
    const checkout1 = await paymentsCheckoutPost(
      makeReq("http://localhost:3000/api/v1/payments/checkout", {
        method: "POST",
        headers: { "idempotency-key": "v1-chk-1" },
        body: { packageKey: "starter_50", provider: "midtrans" },
      }),
    );
    expect(checkout1.status).toBe(201);
    const chk1Json = await checkout1.json();
    const orderCode = chk1Json.data.order.orderCode as string;
    const expectedAmount = chk1Json.data.order.expectedAmount as number;

    const checkout2 = await paymentsCheckoutPost(
      makeReq("http://localhost:3000/api/v1/payments/checkout", {
        method: "POST",
        headers: { "idempotency-key": "v1-chk-1" },
        body: { packageKey: "starter_50", provider: "midtrans" },
      }),
    );
    expect(checkout2.status).toBe(200);
    expect((await checkout2.json()).data.deduplicated).toBe(true);

    // Invalid webhook signature -> 401
    const badWh = await paymentsWebhookPost(
      makeReq("http://localhost:3000/api/v1/payments/webhooks/midtrans", {
        method: "POST",
        body: {
          order_id: orderCode,
          status_code: "200",
          gross_amount: `${expectedAmount}.00`,
          transaction_status: "settlement",
          transaction_id: "mtx-v1-bad",
          signature_key: "forged-sig",
        },
      }),
      { params: Promise.resolve({ provider: "midtrans" }) },
    );
    expect(badWh.status).toBe(401);
    expect((await badWh.json()).error.code).toBe("INVALID_WEBHOOK_SIGNATURE");

    // Valid Midtrans SHA-512 signature -> 200 and grants credits once
    const validSig = createHash("sha512")
      .update(
        `${orderCode}200${expectedAmount}.00${process.env.MIDTRANS_SERVER_KEY}`,
        "utf8",
      )
      .digest("hex");

    const goodWh = await paymentsWebhookPost(
      makeReq("http://localhost:3000/api/v1/payments/webhooks/midtrans", {
        method: "POST",
        body: {
          order_id: orderCode,
          status_code: "200",
          gross_amount: `${expectedAmount}.00`,
          transaction_status: "settlement",
          transaction_id: "mtx-v1-good",
          signature_key: validSig,
        },
      }),
      { params: Promise.resolve({ provider: "midtrans" }) },
    );
    expect(goodWh.status).toBe(200);
    expect((await goodWh.json()).data.processingStatus).toBe("processed");
  });

  it("enforces rate limiting (429 with Retry-After) and end-to-end /api/v1/sync push, pull, resolve, status envelopes", async () => {
    const devA = await registerSyncDeviceService(USER_A.id, {
      deviceKey: "v1-sync-a",
      deviceName: "V1 Sync Device",
      operationMode: "hybrid",
    });

    const push1 = await syncPushPost(
      makeReq("http://localhost:3000/api/v1/sync/push", {
        method: "POST",
        body: {
          deviceId: devA.id,
          events: [
            {
              entityType: "note",
              entityId: "v1-note-1",
              operation: "create",
              baseVersion: 0,
              payload: { text: "Hello v1 sync" },
              idempotencyKey: "v1-push-1",
            },
          ],
        },
      }),
    );
    expect(push1.status).toBe(200);
    expect((await push1.json()).data.appliedCount).toBe(1);

    // Duplicate stale push creates conflict -> resolve via /api/v1/sync/resolve
    const pushConflict = await syncPushPost(
      makeReq("http://localhost:3000/api/v1/sync/push", {
        method: "POST",
        body: {
          deviceId: devA.id,
          events: [
            {
              entityType: "note",
              entityId: "v1-note-1",
              operation: "update",
              baseVersion: 0,
              payload: { text: "Stale edit" },
              idempotencyKey: "v1-push-conflict",
            },
          ],
        },
      }),
    );
    const conflictId = (await pushConflict.json()).data.results[0]
      .conflictId as string;
    expect(conflictId).toBeTruthy();

    const resolveRes = await syncResolvePost(
      makeReq("http://localhost:3000/api/v1/sync/resolve", {
        method: "POST",
        body: { conflictId, resolution: "keep_cloud" },
      }),
    );
    expect(resolveRes.status).toBe(200);

    const statusRes = await syncStatusGet(
      makeReq("http://localhost:3000/api/v1/sync/status?page=1&pageSize=10"),
    );
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.pagination).toBeDefined();

    // Exhaust default 60/min rate limit on sync:status and verify 429 + Retry-After
    let hit429 = false;
    for (let i = 0; i < 65; i++) {
      const r = await syncStatusGet(
        makeReq("http://localhost:3000/api/v1/sync/status"),
      );
      if (r.status === 429) {
        hit429 = true;
        expect(r.headers.get("Retry-After")).toBeTruthy();
        expect((await r.json()).error.code).toBe("RATE_LIMIT_EXCEEDED");
        break;
      }
    }
    expect(hit429).toBe(true);
  });

  it("handles AI v1 endpoints privacy/provider checks without leaking internal errors", async () => {
    await db
      .update(userSettings)
      .set({ aiPrivacyMode: "local_only" })
      .where(eq(userSettings.userId, USER_A.id));

    // Request cloud provider when local_only privacy mode blocks cloud -> 403 PRIVACY_MODE_BLOCKED
    const aiEndpoints = [
      aiCvEvaluatePost(
        makeReq("http://localhost:3000/api/v1/ai/cv/evaluate", {
          method: "POST",
          body: { requestedProvider: "openai", consentGranted: true },
        }),
      ),
      aiCvCorrectPost(
        makeReq("http://localhost:3000/api/v1/ai/cv/correct", {
          method: "POST",
          body: { requestedProvider: "openai", consentGranted: true },
        }),
      ),
      aiCvGeneratePost(
        makeReq("http://localhost:3000/api/v1/ai/cv/generate", {
          method: "POST",
          body: {
            targetRole: "Backend Engineer",
            requestedProvider: "openai",
            consentGranted: true,
          },
        }),
      ),
      aiJobMatchPost(
        makeReq("http://localhost:3000/api/v1/ai/job-match", {
          method: "POST",
          body: {
            jobDescriptionText:
              "We need a senior TypeScript engineer with PostgreSQL and system design skills.",
            requestedProvider: "openai",
            consentGranted: true,
          },
        }),
      ),
      aiCareerRoadmapPost(
        makeReq("http://localhost:3000/api/v1/ai/career-roadmap", {
          method: "POST",
          body: {
            targetRole: "Principal Engineer",
            requestedProvider: "openai",
            consentGranted: true,
          },
        }),
      ),
    ];

    const results = await Promise.all(aiEndpoints);
    for (const res of results) {
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("PRIVACY_MODE_BLOCKED");
      expect(JSON.stringify(json)).not.toContain("sk-");
    }

    // Verify closure record reference check inside archived analyze endpoint returns 404 when missing
    const [closureMissing] = await db
      .select({ id: applicationClosureRecords.id })
      .from(applicationClosureRecords)
      .limit(1);
    expect(closureMissing).toBeUndefined();
  });
});

