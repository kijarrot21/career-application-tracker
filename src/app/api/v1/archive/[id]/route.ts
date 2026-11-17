import type { NextRequest } from "next/server";
import { API_ERROR_CODES, ApiError, assertValidUuid } from "@/lib/api/v1";
import {
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { getArchivedApplicationDetail } from "@/server/queries/archive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1AuthContext(request, "archive:detail");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const closureRecordId = assertValidUuid(id, "archive record ID");
    const detail = await getArchivedApplicationDetail(
      auth.ctx.userId,
      closureRecordId,
    );

    if (!detail) {
      throw new ApiError(
        API_ERROR_CODES.NOT_FOUND,
        "Archived application record not found.",
        404,
      );
    }

    return v1Success(detail, {
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
