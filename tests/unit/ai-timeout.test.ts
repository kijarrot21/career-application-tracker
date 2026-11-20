import { describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { mergeExecutionModelConfig } from "@/server/ai/router/ai-task-router";
import {
  AiProviderError,
  OllamaProvider,
  type FetchLike,
} from "@/server/ai/providers";
import {
  fetchWithTimeout,
  resolveRequestTimeoutMs,
} from "@/server/ai/providers/json-output";
import { cvDataSchema, skillGapSchema } from "@/server/ai/schemas";

const LOCAL_URL = "http://127.0.0.1:11434";

function validCvPayload() {
  return {
    message: {
      content: JSON.stringify({
        profile: { fullName: "Test User", totalExperienceYears: 3 },
        experiences: [],
        skills: [],
        spokenLanguages: ["English"],
      }),
    },
    prompt_eval_count: 10,
    eval_count: 20,
    done_reason: "stop",
  };
}

function abortingFetch(): FetchLike {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
}

function stalledBodyFetch(): FetchLike {
  return (_url, init) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              controller.error(err);
            });
          },
        }),
        { status: 200 },
      ),
    );
}

describe("AI timeout resolution", () => {
  it("preserves an explicit per-task timeout", () => {
    expect(
      resolveRequestTimeoutMs({
        explicitTimeoutMs: 45_000,
        providerDefaultTimeoutMs: 120_000,
      }),
    ).toBe(45_000);
  });

  it("uses the provider default when the task timeout is undefined or null", () => {
    expect(
      resolveRequestTimeoutMs({ providerDefaultTimeoutMs: 120_000 }),
    ).toBe(120_000);
    expect(
      resolveRequestTimeoutMs({
        explicitTimeoutMs: null,
        providerDefaultTimeoutMs: 120_000,
      }),
    ).toBe(120_000);
  });

  it("falls back to the environment default when no override exists", () => {
    expect(resolveRequestTimeoutMs({})).toBe(env.AI_REQUEST_TIMEOUT_MS);
  });

  it("never lets undefined or null task values erase selected model config", () => {
    expect(
      mergeExecutionModelConfig(
        {
          model: "qwen2.5:3b",
          temperature: 0.4,
          maxOutputTokens: 1024,
          timeoutMs: 90_000,
        },
        {},
      ),
    ).toEqual({
      model: "qwen2.5:3b",
      temperature: 0.4,
      maxOutputTokens: 1024,
      timeoutMs: 90_000,
    });
    expect(
      mergeExecutionModelConfig(
        { timeoutMs: 90_000 },
        { timeoutMs: null },
      ).timeoutMs,
    ).toBe(90_000);
    expect(
      mergeExecutionModelConfig({ timeoutMs: 90_000 }, { timeoutMs: 1_000 })
        .timeoutMs,
    ).toBe(1_000);
  });
});

describe("fetchWithTimeout lifecycle", () => {
  it("completes successfully with injected fetch and preserves status, headers and body", async () => {
    const fetchFn = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const res = await fetchWithTimeout({
      url: `${LOCAL_URL}/api/chat`,
      init: { method: "POST" },
      timeoutMs: 1_000,
      provider: "ollama",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("uses the provider default timeout when no explicit value is supplied", async () => {
    const timerSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      await fetchWithTimeout({
        url: `${LOCAL_URL}/api/chat`,
        init: { method: "POST" },
        providerDefaultTimeoutMs: 45_000,
        provider: "ollama",
        fetchFn: async () => new Response("ok"),
      });
      expect(timerSpy).toHaveBeenCalledWith(
        expect.any(Function),
        45_000,
      );
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("normalizes a connection timeout as a retryable TIMEOUT", async () => {
    await expect(
      fetchWithTimeout({
        url: `${LOCAL_URL}/api/chat`,
        init: { method: "POST" },
        timeoutMs: 20,
        provider: "ollama",
        fetchFn: abortingFetch(),
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("bounds response-body consumption with the same timeout", async () => {
    await expect(
      fetchWithTimeout({
        url: `${LOCAL_URL}/api/chat`,
        init: { method: "POST" },
        timeoutMs: 20,
        provider: "ollama",
        fetchFn: stalledBodyFetch(),
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("normalizes network failures as PROVIDER_UNAVAILABLE", async () => {
    await expect(
      fetchWithTimeout({
        url: `${LOCAL_URL}/api/chat`,
        init: { method: "POST" },
        timeoutMs: 1_000,
        provider: "ollama",
        fetchFn: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });

  it("clears the timer on success", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    try {
      const res = await fetchWithTimeout({
        url: `${LOCAL_URL}/api/chat`,
        init: { method: "POST" },
        timeoutMs: 1_000,
        provider: "ollama",
        fetchFn: async () => new Response("ok"),
      });
      expect(await res.text()).toBe("ok");
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      clearSpy.mockRestore();
    }
  });
});

describe("OllamaProvider timeout and error behavior", () => {
  it("uses the bounded local timeout as its provider default", () => {
    expect(new OllamaProvider().getDefaultTimeoutMs()).toBe(
      env.OLLAMA_REQUEST_TIMEOUT_MS,
    );
  });

  it("returns valid structured JSON and propagates model + generation config", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    let capturedSignal: AbortSignal | undefined;
    const provider = new OllamaProvider({
      fetchFn: (_url, init) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        capturedSignal = init?.signal ?? undefined;
        return Promise.resolve(
          new Response(JSON.stringify(validCvPayload()), { status: 200 }),
        );
      },
    });

    const result = await provider.generateStructured({
      taskType: "cv_parse",
      systemPrompt: "Parse the CV",
      userPrompt: "Synthetic CV text",
      outputContractHint: "Return the cvDataSchema shape",
      schema: cvDataSchema,
      schemaName: "CvData",
      modelConfig: {
        model: "qwen2.5:3b",
        maxOutputTokens: 512,
        timeoutMs: 60_000,
      },
    });

    expect(result.provider).toBe("ollama");
    expect(result.locality).toBe("local");
    expect(result.model).toBe("qwen2.5:3b");
    expect(result.data.profile.fullName).toBe("Test User");
    expect(capturedBody).toMatchObject({
      model: "qwen2.5:3b",
      stream: false,
      options: { temperature: 0.2, num_predict: 512 },
      format: {
        type: "object",
        properties: { profile: { type: "object" } },
      },
    });
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("sends a JSON Schema grammar so field types are constrained, not just JSON validity", async () => {
    let sentFormat: unknown;
    const provider = new OllamaProvider({
      fetchFn: (_url, init) => {
        sentFormat = (JSON.parse(String(init?.body)) as { format?: unknown })
          .format;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message: {
                content: JSON.stringify({ readinessScore: 70, summary: "ok" }),
              },
            }),
            { status: 200 },
          ),
        );
      },
    });

    await provider.generateStructured({
      taskType: "skill_gap",
      systemPrompt: "sys",
      userPrompt: "usr",
      schema: skillGapSchema,
      schemaName: "SkillGap",
    });

    expect(sentFormat).toMatchObject({
      type: "object",
      properties: {
        matchedSkills: { type: "array", items: { type: "string" } },
      },
    });
  });

  it("normalizes malformed JSON and schema failures as INVALID_OUTPUT", async () => {
    const malformed = new OllamaProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({ message: { content: "not json" } }),
          { status: 200 },
        ),
    });
    await expect(
      malformed.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OUTPUT", retryable: false });

    const wrongShape = new OllamaProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({ message: { content: "{\"unexpected\": true}" } }),
          { status: 200 },
        ),
    });
    await expect(
      wrongShape.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OUTPUT", retryable: false });
  });

  it("preserves HTTP error normalization without leaking response content", async () => {
    const provider = new OllamaProvider({
      fetchFn: async () =>
        new Response("secret-upstream-detail", { status: 401 }),
    });
    await expect(
      provider.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
      }),
    ).rejects.toMatchObject({
      code: "AUTH_ERROR",
      retryable: false,
      statusCode: 401,
    });

    const serverError = new OllamaProvider({
      fetchFn: async () => new Response("boom", { status: 503 }),
    });
    await expect(
      serverError.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });

  it("normalizes inference and response-body timeouts as TIMEOUT", async () => {
    const inference = new OllamaProvider({ fetchFn: abortingFetch() });
    await expect(
      inference.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
        modelConfig: { timeoutMs: 20 },
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });

    const body = new OllamaProvider({ fetchFn: stalledBodyFetch() });
    await expect(
      body.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
        modelConfig: { timeoutMs: 20 },
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("reports no retryable code for privacy/capability errors", async () => {
    const provider = new OllamaProvider({
      fetchFn: async () => new Response("unused"),
    });
    await expect(
      provider.generateStructured({
        taskType: "cv_parse",
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: cvDataSchema,
        schemaName: "CvData",
        requiresVision: true,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});
