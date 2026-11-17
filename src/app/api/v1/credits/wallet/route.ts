import type { NextRequest } from "next/server";
import {
  requireV1AuthContext,
  v1Error,
  v1Success,
} from "@/server/api/v1-handler";
import {
  getWalletSummaryForUser,
  listAiCreditPricing,
  listCreditReservationsForUser,
} from "@/server/queries/credits";

export async function GET(request: NextRequest) {
  const auth = await requireV1AuthContext(request, "credits:wallet");
  if (!auth.ok) return auth.response;

  try {
    const [wallet, pricing, reservations] = await Promise.all([
      getWalletSummaryForUser(auth.ctx.userId),
      listAiCreditPricing(),
      listCreditReservationsForUser(auth.ctx.userId, 20),
    ]);

    return v1Success(
      {
        wallet,
        activeReservations: reservations.filter((r) => r.status === "reserved"),
        pricing,
      },
      {
        requestId: auth.ctx.requestId,
        rateLimit: auth.ctx.rateLimit,
      },
    );
  } catch (err) {
    return v1Error(err, { requestId: auth.ctx.requestId });
  }
}
