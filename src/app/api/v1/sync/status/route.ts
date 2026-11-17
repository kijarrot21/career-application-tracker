import type { NextRequest } from "next/server";
import { paginateArray, paginationQuerySchema } from "@/lib/api/v1";
import {
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { getSyncDashboardDataForUser } from "@/server/queries/sync";

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "sync:status");
  if (!auth.ok) return auth.response;

  try {
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = paginationQuerySchema.parse(sp);
    const data = await getSyncDashboardDataForUser(auth.ctx.userId);
    const pagedEvents = paginateArray(data.events, query.page, query.pageSize);

    return v1Success(
      {
        ...data,
        events: pagedEvents.items,
      },
      {
        requestId: auth.ctx.requestId,
        rateLimit: auth.ctx.rateLimit,
        pagination: pagedEvents.pagination,
      },
    );
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
