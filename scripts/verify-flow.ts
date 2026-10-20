import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JSON_CLIENTS } from "../src/clients/json.js";
import { readJsonConfig, writeJsonConfig, mergeServerEntry, getSection } from "../src/mcp-writer.js";
import { resolveClientConfigKey } from "../src/clients/types.js";

/**
 * Demonstrates the exact write sequence `setupJsonClient` performs, against a
 * copy of a realistic Opencode config, and prints what lands on disk.
 *
 * This does not call `runSetup` (it is interactive by design) — it mirrors the
 * ordered steps that function takes: read the existing file → merge one entry →
 * write the whole document back.
 */

const url = process.env.NEEDMCP_TEST_MCP_URL ?? "https://needmcp.com/mcp";
const key = process.env.NEEDMCP_TEST_KEY ?? "sk-need-TESTKEY";

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
const serversAt = resolveClientConfigKey(opencode);
const path = Array.isArray(serversAt) ? serversAt : [serversAt];

// A realistic global config: unrelated keys plus a sibling server.
const existing = {
  $schema: "https://opencode.ai/config.json",
  model: { providerID: "9router", model: "Muse" },
  agents: { explorer: { mode: "subagent" } },
  mcp: {
    context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
    github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
  },
};

const dir = await mkdtemp(join(tmpdir(), "needmcp-flow-"));
const target = join(dir, "opencode.jsonc");
await writeFile(target, JSON.stringify(existing, null, 2));

console.log(`target: ${target}`);
console.log(`config key: ${path.join(".")}\n`);

// --- the sequence setupJsonClient runs ------------------------------------
const base = await readJsonConfig(target);
const { config, alreadyExists } = mergeServerEntry(
  base,
  serversAt,
  "needmcp",
  opencode.buildEntry!(key, url)
);
await writeJsonConfig(target, config);

console.log(`pre-existing entry: ${alreadyExists}`);
console.log(`\n--- ${target} ---`);
console.log(await readFile(target, "utf-8"));

// --- sanity ---------------------------------------------------------------
const written = JSON.parse(await readFile(target, "utf-8"));
const mcp = getSection(written, path)!;
const needmcp = mcp.needmcp as Record<string, unknown>;

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

console.log("--- checks ---");
check("$schema kept", written.$schema === existing.$schema);
check("model kept", JSON.stringify(written.model) === JSON.stringify(existing.model));
check("agents kept", JSON.stringify(written.agents) === JSON.stringify(existing.agents));
check("sibling context7 kept", mcp.context7 !== undefined);
check("sibling github kept", mcp.github !== undefined);
check("needmcp written", needmcp?.url === url);
check("API key header present", (needmcp.headers as Record<string, string>)?.["X-API-Key"] === key);
check("enabled is true", needmcp.enabled === true);
check("no mcp.servers wrapper", mcp.servers === undefined);
check("no oauth field", needmcp.oauth === undefined);
check("no disabled field", needmcp.disabled === undefined);

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
