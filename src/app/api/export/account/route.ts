import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/session";
import { exportAccountJsonService } from "@/server/services/settings";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await exportAccountJsonService(user.id);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="career-tracker-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
