#!/usr/bin/env node
/**
 * Report OpenCode token usage for one project only.
 *
 * Reads the local OpenCode database (read-only) and resolves the project that
 * contains the current working directory, then prints per-session, per-model,
 * and per-day token usage.
 *
 * Usage:
 *   node scripts/opencode-usage.mjs
 *   node scripts/opencode-usage.mjs --json
 *   node scripts/opencode-usage.mjs --project /path/to/project
 *   node scripts/opencode-usage.mjs --db ~/.local/share/opencode/opencode.db
 */
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    db: { type: "string" },
    project: { type: "string", short: "p" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(
    [
      "Usage: node scripts/opencode-usage.mjs [options]",
      "",
      "Options:",
      "  -p, --project <path|id>  Project to report (default: current directory)",
      "      --db <path>          Path to opencode.db (default: auto-detected)",
      "      --json               Print machine-readable JSON",
      "  -h, --help               Show this help",
    ].join("\n"),
  );
  process.exit(0);
}

function findDatabase() {
  const candidates = [
    values.db,
    process.env.OPENCODE_DB,
    process.env.XDG_DATA_HOME &&
      path.join(process.env.XDG_DATA_HOME, "opencode", "opencode.db"),
    path.join(homedir(), ".local", "share", "opencode", "opencode.db"),
    path.join(homedir(), "Library", "Application Support", "opencode", "opencode.db"),
    process.env.APPDATA &&
      path.join(process.env.APPDATA, "opencode", "opencode.db"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  console.error("Could not find opencode.db. Pass --db <path>.");
  process.exit(1);
}

const dbPath = findDatabase();
const db = new DatabaseSync(dbPath, { readOnly: true });

function hasTable(name) {
  return Boolean(
    db
      .prepare("select name from sqlite_master where type = 'table' and name = ?")
      .get(name),
  );
}

function resolveProject() {
  const projects = db
    .prepare("select id, worktree, name from project")
    .all();

  if (values.project) {
    const byId = projects.find((p) => p.id === values.project);
    if (byId) return byId;

    const target = realpathSync(path.resolve(values.project));
    const byPath = projects
      .filter((p) => target === p.worktree || target.startsWith(p.worktree + path.sep))
      .sort((a, b) => b.worktree.length - a.worktree.length)[0];
    if (byPath) return byPath;

    console.error(`No OpenCode project matches "${values.project}".`);
    process.exit(1);
  }

  const cwd = realpathSync(process.cwd());
  const match = projects
    .filter((p) => cwd === p.worktree || cwd.startsWith(p.worktree + path.sep))
    .sort((a, b) => b.worktree.length - a.worktree.length)[0];

  if (!match) {
    console.error(
      `No OpenCode project contains ${cwd}. Known projects:\n` +
        projects.map((p) => `  ${p.id}  ${p.worktree}`).join("\n"),
    );
    process.exit(1);
  }
  return match;
}

const project = resolveProject();

function parseModel(raw) {
  if (!raw) return "unknown";
  try {
    const value = JSON.parse(raw);
    return [value.providerID, value.id ?? value.modelID].filter(Boolean).join("/");
  } catch {
    return String(raw);
  }
}

function emptyTotals() {
  return { messages: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
}

function addTotals(target, source) {
  target.messages += Number(source.messages ?? 0);
  target.input += Number(source.input ?? 0);
  target.output += Number(source.output ?? 0);
  target.reasoning += Number(source.reasoning ?? 0);
  target.cacheRead += Number(source.cacheRead ?? 0);
  target.cacheWrite += Number(source.cacheWrite ?? 0);
  target.cost += Number(source.cost ?? 0);
}

const sessionMeta = new Map();

if (hasTable("session_v2")) {
  const rows = db
    .prepare(
      `select id, parent_id, title, directory, model, cost,
              tokens_input, tokens_output, tokens_reasoning,
              tokens_cache_read, tokens_cache_write,
              time_created, time_updated
         from session_v2
        where project_id = ?`,
    )
    .all(project.id);

  for (const row of rows) {
    sessionMeta.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      title: row.title || "(untitled)",
      directory: row.directory,
      model: parseModel(row.model),
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
      totals: {
        messages: 0,
        input: row.tokens_input,
        output: row.tokens_output,
        reasoning: row.tokens_reasoning,
        cacheRead: row.tokens_cache_read,
        cacheWrite: row.tokens_cache_write,
        cost: row.cost,
      },
      live: false,
    });
  }
}

if (hasTable("session")) {
  const rows = db
    .prepare(
      `select id, parent_id, title, directory, model, cost,
              tokens_input, tokens_output, tokens_reasoning,
              tokens_cache_read, tokens_cache_write,
              time_created, time_updated
         from session
        where project_id = ?`,
    )
    .all(project.id);

  for (const row of rows) {
    if (sessionMeta.has(row.id)) continue;
    sessionMeta.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      title: row.title || "(untitled)",
      directory: row.directory,
      model: parseModel(row.model),
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
      totals: {
        messages: 0,
        input: row.tokens_input,
        output: row.tokens_output,
        reasoning: row.tokens_reasoning,
        cacheRead: row.tokens_cache_read,
        cacheWrite: row.tokens_cache_write,
        cost: row.cost,
      },
      live: false,
    });
  }
}

const sessionIds = new Set(sessionMeta.keys());
const byDay = new Map();
const byModel = new Map();

function accumulate(key, totals) {
  if (!key) return;
  if (!byModel.has(key)) byModel.set(key, emptyTotals());
  addTotals(byModel.get(key), totals);
}

function readMessageStats(query, mapper) {
  const rows = db.prepare(query).all();
  for (const row of rows) {
    if (!sessionIds.has(row.session_id)) continue;

    const meta = sessionMeta.get(row.session_id);
    const totals = mapper(row);
    meta.totals = totals;
    meta.live = true;

    const day = row.day;
    if (day) {
      if (!byDay.has(day)) byDay.set(day, emptyTotals());
      addTotals(byDay.get(day), totals);
    }
    accumulate(row.model, totals);
  }
}

const tokenColumns = `
  count(*) as messages,
  coalesce(sum(json_extract(data, '$.tokens.input')), 0) as input,
  coalesce(sum(json_extract(data, '$.tokens.output')), 0) as output,
  coalesce(sum(json_extract(data, '$.tokens.reasoning')), 0) as reasoning,
  coalesce(sum(json_extract(data, '$.tokens.cache.read')), 0) as cacheRead,
  coalesce(sum(json_extract(data, '$.tokens.cache.write')), 0) as cacheWrite,
  coalesce(sum(json_extract(data, '$.cost')), 0) as cost
`;

if (hasTable("session_message")) {
  readMessageStats(
    `select session_id,
            date(time_created / 1000, 'unixepoch', 'localtime') as day,
            json_extract(data, '$.model.providerID') || '/' || json_extract(data, '$.model.id') as model,
            ${tokenColumns}
       from session_message
      where type = 'assistant'
      group by session_id, day, model`,
    (row) => ({
      messages: row.messages,
      input: row.input,
      output: row.output,
      reasoning: row.reasoning,
      cacheRead: row.cacheRead,
      cacheWrite: row.cacheWrite,
      cost: row.cost,
    }),
  );
}

if (hasTable("message")) {
  readMessageStats(
    `select session_id,
            date(time_created / 1000, 'unixepoch', 'localtime') as day,
            json_extract(data, '$.providerID') || '/' || json_extract(data, '$.modelID') as model,
            ${tokenColumns}
       from message
      where json_extract(data, '$.role') = 'assistant'
      group by session_id, day, model`,
    (row) => ({
      messages: row.messages,
      input: row.input,
      output: row.output,
      reasoning: row.reasoning,
      cacheRead: row.cacheRead,
      cacheWrite: row.cacheWrite,
      cost: row.cost,
    }),
  );
}

const sessions = [...sessionMeta.values()].sort(
  (a, b) => a.timeCreated - b.timeCreated,
);

const totals = emptyTotals();
for (const session of sessions) addTotals(totals, session.totals);

const totalAllTokens =
  totals.input + totals.output + totals.reasoning + totals.cacheRead + totals.cacheWrite;

const byDayRows = [...byDay.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([day, value]) => ({ day, ...value }));

const byModelRows = [...byModel.entries()]
  .sort(([, a], [, b]) => b.input + b.output - (a.input + a.output))
  .map(([model, value]) => ({ model, ...value }));

if (values.json) {
  console.log(
    JSON.stringify(
      {
        project: {
          id: project.id,
          name: project.name,
          worktree: project.worktree,
        },
        database: dbPath,
        totals: { ...totals, totalTokens: totalAllTokens },
        sessions: sessions.map((session) => ({
          id: session.id,
          parentId: session.parentId,
          title: session.title,
          model: session.model,
          createdAt: new Date(session.timeCreated).toISOString(),
          updatedAt: new Date(session.timeUpdated).toISOString(),
          ...session.totals,
        })),
        byDay: byDayRows,
        byModel: byModelRows,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function money(value) {
  if (!value) return "$0.00";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function truncate(value, width) {
  const text = String(value);
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}

function renderTable(headers, rows, align) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
  );
  const line = (cells) =>
    cells
      .map((cell, index) =>
        align[index] === "right"
          ? String(cell).padStart(widths[index])
          : String(cell).padEnd(widths[index]),
      )
      .join("  ");
  return [
    line(headers),
    widths.map((width) => "─".repeat(width)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

const range =
  sessions.length === 0
    ? "no sessions"
    : `${new Date(sessions[0].timeCreated).toLocaleString()} → ${new Date(
        sessions[sessions.length - 1].timeUpdated,
      ).toLocaleString()}`;

console.log(`OpenCode token usage - ${project.name ?? project.worktree}`);
console.log(`Project:  ${project.worktree}`);
console.log(`Project ID: ${project.id}`);
console.log(`Database: ${dbPath}`);
console.log(`Range:    ${range}`);
console.log("");

const sessionRows = sessions.map((session) => {
  const title = session.parentId ? `↳ ${session.title}` : session.title;
  return [
    truncate(title, 42),
    truncate(session.model, 30),
    number.format(session.totals.messages),
    number.format(session.totals.input),
    number.format(session.totals.output),
    number.format(session.totals.reasoning),
    number.format(session.totals.cacheRead),
    number.format(session.totals.cacheWrite),
    money(session.totals.cost),
  ];
});

sessionRows.push([
  "TOTAL",
  "",
  number.format(totals.messages),
  number.format(totals.input),
  number.format(totals.output),
  number.format(totals.reasoning),
  number.format(totals.cacheRead),
  number.format(totals.cacheWrite),
  money(totals.cost),
]);

console.log(
  renderTable(
    [
      "Session",
      "Model",
      "Msgs",
      "Input",
      "Output",
      "Reasoning",
      "Cache read",
      "Cache write",
      "Cost",
    ],
    sessionRows,
    ["left", "left", "right", "right", "right", "right", "right", "right", "right"],
  ),
);
console.log("");

console.log("Totals");
console.log(`  Input tokens:        ${number.format(totals.input)}`);
console.log(`  Output tokens:       ${number.format(totals.output)}`);
console.log(`  Reasoning tokens:    ${number.format(totals.reasoning)}`);
console.log(`  Cache read tokens:   ${number.format(totals.cacheRead)}`);
console.log(`  Cache write tokens:  ${number.format(totals.cacheWrite)}`);
console.log(`  Total (incl. cache): ${number.format(totalAllTokens)} (${compact.format(totalAllTokens)})`);
console.log(`  Cost:                ${money(totals.cost)}`);
console.log("");

if (byModelRows.length > 0) {
  console.log("By model");
  console.log(
    renderTable(
      ["Model", "Msgs", "Input", "Output", "Reasoning", "Cache read", "Total", "Cost"],
      byModelRows.map((row) => {
        const total = row.input + row.output + row.reasoning + row.cacheRead + row.cacheWrite;
        return [
          truncate(row.model, 40),
          number.format(row.messages),
          number.format(row.input),
          number.format(row.output),
          number.format(row.reasoning),
          number.format(row.cacheRead),
          compact.format(total),
          money(row.cost),
        ];
      }),
      ["left", "right", "right", "right", "right", "right", "right", "right"],
    ),
  );
  console.log("");
}

if (byDayRows.length > 0) {
  console.log("By day");
  console.log(
    renderTable(
      ["Day", "Msgs", "Input", "Output", "Reasoning", "Cache read", "Total"],
      byDayRows.map((row) => {
        const total = row.input + row.output + row.reasoning + row.cacheRead + row.cacheWrite;
        return [
          row.day,
          number.format(row.messages),
          number.format(row.input),
          number.format(row.output),
          number.format(row.reasoning),
          number.format(row.cacheRead),
          compact.format(total),
        ];
      }),
      ["left", "right", "right", "right", "right", "right", "right"],
    ),
  );
}

db.close();
