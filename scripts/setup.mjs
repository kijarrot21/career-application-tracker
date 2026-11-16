import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

let existing = "";
if (existsSync(envPath)) {
  existing = readFileSync(envPath, "utf8");
}

function hasKey(content, key) {
  const re = new RegExp(`^${key}=.+`, "m");
  return re.test(content);
}

const lines = existing ? existing.trimEnd().split("\n") : [];

if (!hasKey(existing, "PGLITE_DATA_DIR")) {
  lines.push("PGLITE_DATA_DIR=./.data/pglite");
}
if (!hasKey(existing, "BETTER_AUTH_URL")) {
  lines.push("BETTER_AUTH_URL=http://localhost:3000");
}
if (!hasKey(existing, "BETTER_AUTH_SECRET")) {
  lines.push(`BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`);
}
if (!hasKey(existing, "ENCRYPTION_KEY")) {
  lines.push(`ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`);
}

writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
console.log("Configured .env.local with generated secrets.");
