import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";
import { seedSystemSources } from "./seed/system";

export type AppDb = PgliteDatabase<typeof schema>;

type GlobalDbState = {
  db?: AppDb;
  pglite?: PGlite;
  readyPromise?: Promise<void>;
  overrideDb?: AppDb;
  signalsBound?: boolean;
};

const globalForDb = globalThis as unknown as { __catDbState?: GlobalDbState };
const state: GlobalDbState = globalForDb.__catDbState ?? (globalForDb.__catDbState = {});

function bindGracefulShutdown() {
  if (state.signalsBound || typeof process === "undefined") return;
  state.signalsBound = true;
  const cleanup = () => {
    if (state.pglite) {
      const client = state.pglite;
      state.pglite = undefined;
      void client.close().catch(() => {});
    }
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
  process.once("beforeExit", cleanup);
}

function createDefaultDb(): AppDb {
  if (env.DATABASE_URL) {
    const client = postgres(env.DATABASE_URL, { prepare: false });
    return drizzlePg(client, { schema }) as unknown as AppDb;
  }
  const isMemory = env.PGLITE_DATA_DIR === "memory://" || env.NODE_ENV === "test";
  if (isMemory) {
    const client = new PGlite();
    state.pglite = client;
    return drizzlePglite(client, { schema });
  }
  const absDir = resolve(/*turbopackIgnore: true*/ process.cwd(), env.PGLITE_DATA_DIR);
  mkdirSync(absDir, { recursive: true });
  const client = new PGlite(absDir);
  state.pglite = client;
  bindGracefulShutdown();
  return drizzlePglite(client, { schema });
}

export function getDb(): AppDb {
  if (state.overrideDb) return state.overrideDb;
  if (!state.db) {
    state.db = createDefaultDb();
  }
  return state.db;
}

export async function closeDb(): Promise<void> {
  if (state.pglite) {
    const client = state.pglite;
    state.pglite = undefined;
    state.db = undefined;
    state.readyPromise = undefined;
    await client.close();
  }
}

/** Used by integration tests to inject an isolated in-memory PGlite database. */
export function setTestDb(customDb: AppDb | undefined) {
  state.overrideDb = customDb;
  state.readyPromise = customDb ? Promise.resolve() : undefined;
}

const migrationsFolder = resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  "src/db/migrations",
);

export async function ensureDbReady(): Promise<AppDb> {
  const current = getDb();
  if (state.overrideDb) return current;
  if (!state.readyPromise) {
    state.readyPromise = (async () => {
      if (env.DATABASE_URL) {
        await migratePg(current as unknown as ReturnType<typeof drizzlePg>, {
          migrationsFolder,
        });
      } else {
        await migratePglite(current, { migrationsFolder });
      }
      await seedSystemSources(current);
    })().catch((err) => {
      state.readyPromise = undefined;
      throw err;
    });
  }
  await state.readyPromise;
  return current;
}
