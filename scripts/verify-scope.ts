import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JSON_CLIENTS } from "../src/clients/json.js";
import { readJsonConfig, mergeServerEntry, writeJsonConfig, getSection } from "../src/mcp-writer.js";
import { resolveClientConfigKey } from "../src/clients/types.js";

/**
 * Regression guard: a PROJECT-scope setup must never pull the user's GLOBAL
 * config into the project file.
 *
 * There is no migration any more — `opencode.jsonc` is both the read and the
 * write target — so the only way global data could leak in is if the writer
 * ever read a different file. This asserts the project file starts empty and
 * ends up holding nothing but our own entry.
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
await writeFile(join(fakeGlobalDir, "opencode.jsonc"), JSON.stringify(globalConfig, null, 2));

// Project has no config file at all.
const target = join(projectDir, "opencode.jsonc");

const existing = await readJsonConfig(target);
check("project config starts empty", JSON.stringify(existing) === "{}", JSON.stringify(existing));

const serversAt = resolveClientConfigKey(opencode);
const { config } = mergeServerEntry(existing, serversAt, "needmcp", opencode.buildEntry!(key, url));
await writeJsonConfig(target, config);

const written = JSON.parse(await readFile(target, "utf-8"));
const keys = Object.keys(written);
check("only `mcp` is written", keys.length === 1 && keys[0] === "mcp", keys.join(", "));
check("no provider leaked", written.provider === undefined);
check("no plugin leaked", written.plugin === undefined);
check("no agent leaked", written.agent === undefined);
check("no global mcp server leaked", JSON.stringify(written).includes("context7") === false);

const servers = getSection(written, serversAt)!;
check("needmcp present at mcp.needmcp", (servers.needmcp as Record<string, unknown>)?.url === url);
check("no sibling server cobbled in", JSON.stringify(Object.keys(servers)) === '["needmcp"]');

// The global file must be untouched by the project run.
const globalAfter = JSON.parse(await readFile(join(fakeGlobalDir, "opencode.jsonc"), "utf-8"));
check(
  "global config untouched",
  JSON.stringify(globalAfter) === JSON.stringify(globalConfig)
);

await rm(fakeGlobalDir, { recursive: true, force: true });
await rm(projectDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
