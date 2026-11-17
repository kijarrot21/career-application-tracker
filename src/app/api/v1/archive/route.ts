import type { NextRequest } from "next/server";
import { z } from "zod";
import { paginateArray, paginationQuerySchema } from "@/lib/api/v1";
import {
  ARCHIVE_OUTCOMES,
  CLOSURE_RECORD_STATUSES,
} from "@/lib/domain/archive";
import {
  parseV1JsonBody,
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import { listArchivedApplications } from "@/server/queries/archive";
import {
  archiveApplicationSchema,
  archiveApplicationService,
} from "@/server/services/archive";

const listArchiveQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  outcome: z.enum(["all", ...ARCHIVE_OUTCOMES]).optional(),
  status: z.enum(["all", ...CLOSURE_RECORD_STATUSES]).optional(),
  company: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "archive:list");
  if (!auth.ok) return auth.response;

  try {
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listArchiveQuerySchema.parse(sp);

    const result = await listArchivedApplications(auth.ctx.userId, {
      search: query.search,
      outcome: query.outcome,
      status: query.status,
      company: query.company,
      jobTitle: query.jobTitle,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    const { items, pagination } = paginateArray(
      result.items,
      query.page,
      query.pageSize,
    );

    return v1Success(
      {
        items,
        stats: result.stats,
        retentionPolicy: result.retentionPolicy,
      },
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

export async function POST(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "archive:create");
  if (!auth.ok) return auth.response;

  try {
    const body = await parseV1JsonBody(request);
    const parsed = archiveApplicationSchema.parse(body);
    const created = await archiveApplicationService(auth.ctx.userId, parsed);

    return v1Success(created, {
      status: 201,
      requestId: auth.ctx.requestId,
      rateLimit: auth.ctx.rateLimit,
    });
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
