import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JSON_CLIENTS } from "../src/clients/json.js";
import { loadMigrationSource, readJsonConfig, mergeServerEntry, writeJsonConfig, getSection } from "../src/mcp-writer.js";
import { resolveClientConfigKey } from "../src/clients/types.js";

/**
 * Regression guard: a PROJECT-scope setup must never pull the user's GLOBAL
 * config into the project file.
 *
 * The bug: `legacyPaths` listed both the global and the project `opencode.json`.
 * Whenever the project had no target file, the global one was treated as a
 * migration source and its providers/plugins/agents were cloned into the project.
 */

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
const url = "http://127.0.0.1:8000/mcp";
const key = "sk-need-SCOPETEST";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

const fakeGlobalDir = await mkdtemp(join(tmpdir(), "needmcp-global-"));
const projectDir = await mkdtemp(join(tmpdir(), "needmcp-project-"));

// A realistic global config: lots of things that must NOT leak into a project.
const globalConfig = {
  $schema: "https://opencode.ai/config.json",
  provider: { some: { options: { apiKey: "secret" } } },
  plugin: ["@example/plugin"],
  agent: { explorer: { model: "x" } },
  mcp: { context7: { type: "remote", url: "https://mcp.context7.com/mcp" } },
};
const globalJson = join(fakeGlobalDir, "opencode.jsonc");
await writeFile(globalJson, JSON.stringify(globalConfig, null, 2));

// Project has no opencode.json and no local opencode.jsonc.
const target = join(projectDir, "opencode.json");

// Mirrors setupJsonClient's project-scope candidate selection.
const legacyProject = (opencode.legacyProjectPaths ?? []).map((p) => join(projectDir, p));
const migration = await loadMigrationSource(target, legacyProject);

check("project scope finds no legacy source", migration === null,
  `would have read ${migration?.from ?? "nothing"}`);

const existing = migration ? migration.config : await readJsonConfig(target);
const serversAt = resolveClientConfigKey(opencode);
const { config } = mergeServerEntry(
  existing,
  serversAt,
  "needmcp",
  opencode.buildEntry!(key, url)
);
await writeJsonConfig(target, config);

const written = JSON.parse(await readFile(target, "utf-8"));
const keys = Object.keys(written);
check("only `mcp` is written", keys.length === 1 && keys[0] === "mcp", keys.join(", "));
check("no provider leaked", written.provider === undefined);
check("no plugin leaked", written.plugin === undefined);
check("no agent leaked", written.agent === undefined);
check("no global mcp server leaked", JSON.stringify(written).includes("context7") === false);

const servers = getSection(written, serversAt)!;
check("needmcp present at the layout's server path", servers.needmcp?.url === url, serversAt.join("."));
check("no sibling server cobbled in", JSON.stringify(Object.keys(servers)) === '["needmcp"]');

// And GLOBAL scope still migrates: the same fixture, passed as the global
// candidate, must be read (the real global path is swapped for the fixture).
const globalTarget = join(fakeGlobalDir, "opencode.json");
const direct = await loadMigrationSource(globalTarget, [globalJson]);
check("global scope DOES migrate the global file", direct !== null);

await rm(fakeGlobalDir, { recursive: true, force: true });
await rm(projectDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
