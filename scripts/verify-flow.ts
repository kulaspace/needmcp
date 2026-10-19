import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JSON_CLIENTS } from "../src/clients/json.js";
import {
  readJsonConfig,
  writeJsonConfig,
  mergeServerEntry,
  getSection,
  cleanupStrayEntry,
  loadMigrationSource,
} from "../src/mcp-writer.js";
import { resolveClientConfigKey } from "../src/clients/types.js";
import { detectOpencodeLayout, opencodeConfigKey } from "../src/clients/opencode-layout.js";

/**
 * Demonstrates the exact write sequence `setupJsonClient` performs, against a
 * copy of a realistic Opencode config, and prints what lands on disk.
 *
 * This does not call `runSetup` (it is interactive by design) — it mirrors the
 * ordered steps that function takes: migrate → clean stray → merge → write.
 */

const url = process.env.NEEDMCP_TEST_MCP_URL ?? "https://needmcp.com/mcp";
const key = process.env.NEEDMCP_TEST_KEY ?? "sk-need-TESTKEY";

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
const layout = detectOpencodeLayout();
const serversAt = resolveClientConfigKey(opencode)!;

// A realistic existing config for the detected layout, plus the stray key an
// older CLI release used to leave behind (1.x layout only).
const existing =
  layout === "v2"
    ? {
        $schema: "https://opencode.ai/config.json",
        model: "anthropic/claude",
        mcp: {
          servers: {
            context7: { type: "remote", url: "https://mcp.context7.com/mcp", disabled: false },
          },
        },
      }
    : {
        $schema: "https://opencode.ai/config.json",
        model: "anthropic/claude",
        mcp: {
          context7: { type: "remote", url: "https://mcp.context7.com/mcp", enabled: true },
          servers: { needmcp: { type: "remote", url: "https://stale.example/mcp" } },
        },
      };

const dir = await mkdtemp(join(tmpdir(), "needmcp-flow-"));
const target = join(dir, "opencode.json");
await writeJsonConfig(target, existing);

console.log(`layout: ${layout}   target: ${target}`);
console.log(`config key: ${serversAt.join(".")}\n`);

// --- the sequence setupJsonClient runs ------------------------------------
const migration = await loadMigrationSource(target, []); // target exists → null
const base = migration ? migration.config : await readJsonConfig(target);

const { config: cleaned, removed } = cleanupStrayEntry(base, serversAt, "needmcp");
const { config } = mergeServerEntry(
  cleaned,
  serversAt,
  "needmcp",
  opencode.buildEntry!(key, url)
);
await writeJsonConfig(target, config);

console.log(`stray entry removed: ${removed}`);
console.log(`\n--- ${target} ---`);
console.log(await readFile(target, "utf-8"));

// --- sanity ---------------------------------------------------------------
const written = JSON.parse(await readFile(target, "utf-8"));
const servers = getSection(written, serversAt)!;

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

console.log("--- checks ---");
check("unrelated top-level key kept", written.model === "anthropic/claude");
check("sibling server kept", servers.context7 !== undefined);
check("needmcp written", servers.needmcp?.url === url);
check("API key header present", servers.needmcp?.headers?.["X-API-Key"] === key);
check(
  "layout matches installed version",
  JSON.stringify(serversAt) === JSON.stringify(opencodeConfigKey(layout))
);
if (layout === "v1") {
  check("no mcp.servers in a 1.x config", written.mcp.servers === undefined);
  check("oauth disabled (1.x)", servers.needmcp.oauth === false);
} else {
  check("entry enabled (2.x)", servers.needmcp.disabled === false);
  check("no 1.x-only fields", servers.needmcp.oauth === undefined);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
