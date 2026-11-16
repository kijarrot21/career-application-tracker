import { closeDb, ensureDbReady } from "../src/db/index.ts";

await ensureDbReady();
await closeDb();
console.log("Database migrations and system seeds applied.");
process.exit(0);
