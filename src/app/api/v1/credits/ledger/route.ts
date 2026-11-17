import type { NextRequest } from "next/server";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/api/v1";
import { CREDIT_LEDGER_ENTRY_TYPES } from "@/lib/domain/credits";
import {
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { listCreditLedgerPaginatedForUser } from "@/server/queries/credits";

const ledgerQuerySchema = paginationQuerySchema.extend({
  entryType: z.enum(CREDIT_LEDGER_ENTRY_TYPES).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "credits:ledger");
  if (!auth.ok) return auth.response;

  try {
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = ledgerQuerySchema.parse(sp);

    const { items, pagination } = await listCreditLedgerPaginatedForUser(
      auth.ctx.userId,
      {
        page: query.page,
        pageSize: query.pageSize,
        entryType: query.entryType,
      },
    );

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
