import type { NextRequest } from "next/server";
import { API_ERROR_CODES, ApiError } from "@/lib/api/v1";
import type { AiLocale } from "@/lib/domain/ai";
import { MAX_DOCUMENT_BYTES } from "@/lib/storage";
import {
  parseCvBufferWithAiService,
  parseCvInputSchema,
  parseCvWithAiService,
} from "@/server/ai/services";
import { getAiTaskHttpStatus } from "@/server/api/ai-v1";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";

const parseCvJsonSchema = parseCvInputSchema.refine(
  (d) => Boolean(d.documentVersionId || d.cvText),
  {
    message: "Either 'documentVersionId' or 'cvText' is required.",
  },
);

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "ai:cv:parse");
  if (!auth.ok) return auth.response;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw new ApiError(
          API_ERROR_CODES.VALIDATION_ERROR,
          "Invalid multipart form data.",
          400,
        );
      }

      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new ApiError(
          API_ERROR_CODES.VALIDATION_ERROR,
          "Missing uploaded CV file under 'file' field.",
          400,
        );
      }

      if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
        throw new ApiError(
          API_ERROR_CODES.VALIDATION_ERROR,
          "CV file must be between 1 byte and 10 MB.",
          400,
        );
      }

      const locale: AiLocale = formData.get("locale") === "id" ? "id" : "en";
      const consentGranted = formData.get("consentGranted") === "true";
      const requestedProviderRaw = formData.get("requestedProvider");
      const requestedProvider =
        requestedProviderRaw === "ollama" ||
        requestedProviderRaw === "openai" ||
        requestedProviderRaw === "gemini"
          ? requestedProviderRaw
          : undefined;
      const idempotencyKey =
        (typeof formData.get("idempotencyKey") === "string"
          ? (formData.get("idempotencyKey") as string).trim()
          : undefined) || auth.ctx.idempotencyKey;

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await parseCvBufferWithAiService(auth.ctx.userId, {
        buffer,
        filename: file.name,
        locale,
        consentGranted,
        requestedProvider,
        idempotencyKey,
      });

      return v1Success(result, {
        status: getAiTaskHttpStatus(result),
        requestId: auth.ctx.requestId,
        rateLimit: auth.ctx.rateLimit,
      });
    }

    const body = await parseV1JsonBody(request);
    const parsed = parseCvJsonSchema.parse({
      ...body,
      idempotencyKey:
        typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
          ? body.idempotencyKey
          : auth.ctx.idempotencyKey,
    });

    const result = await parseCvWithAiService(auth.ctx.userId, parsed);
    return v1Success(result, {
      status: getAiTaskHttpStatus(result),
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
