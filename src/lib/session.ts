import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDbReady } from "@/db";
import { ensureUserInitialized } from "@/db/seed/system";
import { getAuth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  await ensureDbReady();
  const hdrs = await headers();
  const session = await getAuth().api.getSession({ headers: hdrs });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/sign-in");
  }
  const db = await ensureDbReady();
  await ensureUserInitialized(db, user.id);
  return user;
}
