import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { ensureUserInitialized } from "@/db/seed/system";
import { env } from "@/lib/env";

type AuthInstance = ReturnType<typeof createAuth>;

function createAuth() {
  const db = getDb();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await ensureUserInitialized(getDb(), createdUser.id);
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const globalForAuth = globalThis as unknown as { __catAuth?: AuthInstance };

export function getAuth(): AuthInstance {
  if (!globalForAuth.__catAuth) {
    globalForAuth.__catAuth = createAuth();
  }
  return globalForAuth.__catAuth;
}
