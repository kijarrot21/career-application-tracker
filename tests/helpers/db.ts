import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setTestDb, type AppDb } from "@/db";
import * as schema from "@/db/schema";
import { seedCreditCatalog } from "@/db/seed/credits";
import { ensureUserInitialized, seedSystemSources } from "@/db/seed/system";

const migrationsFolder = resolve(process.cwd(), "src/db/migrations");

export async function createIsolatedTestDb(): Promise<{
  db: AppDb;
  cleanup: () => Promise<void>;
}> {
  const client = new PGlite();
  const testDb = drizzle(client, { schema });
  await migrate(testDb, { migrationsFolder });
  await seedSystemSources(testDb);
  await seedCreditCatalog(testDb);
  setTestDb(testDb);
  return {
    db: testDb,
    cleanup: async () => {
      setTestDb(undefined);
      await client.close();
    },
  };
}

export async function createTestUser(
  db: AppDb,
  params: { id: string; name: string; email: string },
) {
  await db.insert(schema.user).values({
    id: params.id,
    name: params.name,
    email: params.email,
    emailVerified: true,
  });
  await ensureUserInitialized(db, params.id);
  return params;
}
