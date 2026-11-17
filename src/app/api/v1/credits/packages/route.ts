import type { NextRequest } from "next/server";
import { paginationQuerySchema } from "@/lib/api/v1";
import {
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { listCreditPackagesPaginated } from "@/server/queries/credits";

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "credits:packages");
  if (!auth.ok) return auth.response;

  try {
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = paginationQuerySchema.parse(sp);

    const { items, pagination } = await listCreditPackagesPaginated({
      page: query.page,
      pageSize: query.pageSize,
    });

    return v1Success(
      { items },
      {
        requestId: auth.ctx.requestId,
        rateLimit: auth.ctx.rateLimit,
        pagination,
      },
    );
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
