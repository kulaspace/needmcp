import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JSON_CLIENTS } from "../src/clients/json.js";
import { readJsonConfig, mergeServerEntry, writeJsonConfig } from "../src/mcp-writer.js";

/**
 * Proves the Opencode file-write path writes ONLY the needmcp entry.
 *
 * The CLI no longer shells out to `opencode mcp add`: the entry is written into
 * `opencode.jsonc` by hand. Two things must stay true:
 *
 *  - it writes exactly one file, in the project directory, never anything else;
 *  - it never copies the user's global config (providers, plugins, agents) into
 *    the project file — the client already merges global and project config.
 */

const url = "http://127.0.0.1:8000/mcp";
const key = "sk-need-HARNESSKEY";

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

const dir = await mkdtemp(join(tmpdir(), "needmcp-add-"));
const target = join(dir, "opencode.jsonc");

// Mirrors setupJsonClient's project-scope write.
const existing = await readJsonConfig(target);
const { config } = mergeServerEntry(existing, ["mcp"], "needmcp", opencode.buildEntry!(key, url));
await writeJsonConfig(target, config);

const files = await readdir(dir);
check("wrote exactly one config file", files.length === 1, files.join(", "));
check("the file is opencode.jsonc", files[0] === "opencode.jsonc", files[0]);

const written = JSON.parse(await readFile(target, "utf-8"));
const topKeys = Object.keys(written);
check("file has a single top-level key", topKeys.length === 1, topKeys.join(", "));
check(
  "no provider/plugin/agent copied in",
  !topKeys.some((k) => ["provider", "plugin", "agent", "model"].includes(k))
);

const serialised = JSON.stringify(written);
check("needmcp is the only server", (serialised.match(/"type"\s*:\s*"remote"/g) ?? []).length === 1);
check("URL preserved", serialised.includes(url));
check("API key preserved", serialised.includes(key));

// A pre-existing project file keeps its own content.
const target2 = join(dir, "existing.jsonc");
await writeFile(target2, JSON.stringify({ $schema: "s", mcp: { other: { type: "remote" } } }));
const merged = mergeServerEntry(
  await readJsonConfig(target2),
  ["mcp"],
  "needmcp",
  opencode.buildEntry!(key, url)
);
check("existing sibling server kept", JSON.stringify(merged.config).includes('"other"'));
check("existing $schema kept", merged.config.$schema === "s");

console.log("\n--- written file ---");
console.log(await readFile(target, "utf-8"));

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
