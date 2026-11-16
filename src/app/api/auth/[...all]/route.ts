import { ensureDbReady } from "@/db";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request) {
  await ensureDbReady();
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  await ensureDbReady();
  return getAuth().handler(request);
}
