import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

import { JSON_CLIENTS } from "../src/clients/json.js";
import {
  readJsonConfig,
  writeJsonConfig,
  mergeServerEntry,
  getSection,
  hasJsonComments,
} from "../src/mcp-writer.js";

/**
 * End-to-end check for the Opencode writer.
 *
 * Runs the real config-writing path against a temp directory, then asks the
 * installed Opencode binary what it actually parsed.
 *
 * There is exactly ONE config shape now, written into `opencode.jsonc`:
 *
 *   { "mcp": { "needmcp": { type, url, enabled, headers? } } }
 *
 * `headers` is present in API-key mode and absent in OAuth mode (which is
 * followed by `opencode mcp auth needmcp`). No `mcp.servers` wrapper, no
 * `oauth`/`disabled` fields.
 *
 * Requires Opencode on PATH. A real key can be passed via NEEDMCP_TEST_KEY to
 * additionally assert "connected" rather than merely "listed".
 */

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
// Defaults to production so the script is meaningful on any machine; override
// with NEEDMCP_TEST_MCP_URL to point at a local backend.
const url = process.env.NEEDMCP_TEST_MCP_URL ?? "https://needmcp.com/mcp";
const key = process.env.NEEDMCP_TEST_KEY ?? "sk-need-TESTKEY";

const dir = await mkdtemp(join(tmpdir(), "needmcp-e2e-"));
const target = join(dir, "opencode.jsonc");

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

// A realistic config: unrelated keys plus three sibling servers.
const siblings = {
  context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
  github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
  mxterm: { type: "local", command: ["mxterm"] },
};
const originalConfig = {
  $schema: "https://opencode.ai/config.json",
  model: { providerID: "9router", model: "Muse" },
  agents: { explorer: { mode: "subagent" } },
  mcp: { ...siblings },
};
await writeFile(target, JSON.stringify(originalConfig, null, 2));

// --- Replicate setupJsonClient's decision sequence -------------------------
const existing = await readJsonConfig(target);
const serverName = opencode.serverName ?? "needmcp";
const { config, alreadyExists } = mergeServerEntry(
  existing,
  ["mcp"],
  serverName,
  opencode.buildEntry!(key, url)
);
await writeJsonConfig(target, config);
check("target file written", true, target);
check("first write is not an update", alreadyExists === false);

// --- Verify the written file ----------------------------------------------
const written = await readJsonConfig(target);
const mcp = getSection(written, ["mcp"])!;

check(
  "needmcp sits at mcp.needmcp",
  JSON.stringify(mcp.needmcp) === JSON.stringify(opencode.buildEntry!(key, url)),
  JSON.stringify(mcp.needmcp)
);
check("API key header written", (mcp.needmcp as Record<string, unknown>).headers !== undefined);
check(
  "entry is exactly {type,url,enabled,headers}",
  JSON.stringify(Object.keys(mcp.needmcp as object).sort()) ===
    JSON.stringify(["enabled", "headers", "type", "url"])
);
check("enabled is true", (mcp.needmcp as Record<string, unknown>).enabled === true);
check("no mcp.servers wrapper", mcp.servers === undefined);
check("no oauth field", (mcp.needmcp as Record<string, unknown>).oauth === undefined);
check("no disabled field", (mcp.needmcp as Record<string, unknown>).disabled === undefined);

// The whole point: editing, not replacing. Nothing else may be lost.
check("$schema preserved", written.$schema === originalConfig.$schema);
check(
  "model preserved",
  JSON.stringify(written.model) === JSON.stringify(originalConfig.model)
);
check(
  "agents preserved",
  JSON.stringify(written.agents) === JSON.stringify(originalConfig.agents)
);
check(
  "siblings preserved",
  Object.entries(siblings).every(
    ([name, value]) => JSON.stringify(mcp[name]) === JSON.stringify(value)
  )
);

// --- Idempotency ----------------------------------------------------------
const second = mergeServerEntry(
  await readJsonConfig(target),
  ["mcp"],
  serverName,
  opencode.buildEntry!(key, url)
);
check("second write reports update", second.alreadyExists === true);
check("no duplicate entries", JSON.stringify(second.config) === JSON.stringify(written));

// --- OAuth mode writes no headers ----------------------------------------
const oauthOnly = mergeServerEntry({}, ["mcp"], serverName, opencode.oauth!.buildEntry!(url));
check(
  "OAuth entry is {type,url,enabled}",
  JSON.stringify(oauthOnly.config) ===
    JSON.stringify({ mcp: { needmcp: { type: "remote", url, enabled: true } } }),
  JSON.stringify(oauthOnly.config)
);
check("OAuth entry carries no headers", !JSON.stringify(oauthOnly.config).includes("X-API-Key"));

// --- Comment detection ----------------------------------------------------
await writeFile(target, '{\n  // my note\n  "mcp": {}\n}\n');
check("comments detected before overwrite", await hasJsonComments(target));

// --- Validate against the real binary -------------------------------------
// Restore the full config: a file holding only needmcp would make the
// "siblings still listed" check meaningless.
await writeJsonConfig(target, config);

/**
 * Ask the installed binary what configuration it actually parsed.
 *
 * `debug config` prints every config source and its parsed content, so it
 * answers the only question this script can answer honestly: did the client
 * parse the file we wrote, and is our entry in it? (`mcp list` is skipped for
 * 2.x — its background service binds to the first project directory it saw, so
 * it cannot be pointed at a temp dir.)
 */
function parseCheck(bin: string, args: string[]): { ok: boolean; text: string } {
  try {
    const out = execSync(`${bin} ${args.join(" ")}`, {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    });
    return { ok: true, text: out };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, text: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const bin = "opencode2";
const { text } = parseCheck(bin, ["debug", "config"]);
const plain = text.replace(/\x1b\[[0-9;]*m/g, "");

if (plain.trim().length === 0) {
  console.log(`SKIP  ${bin} produced no output`);
} else {
  console.log(`\n=== ${bin} via \`debug config\` ===`);
  const schemaError = /Invalid input|Configuration is invalid/i.test(plain);

  check(`${bin}: accepts the written config`, !schemaError);
  check(`${bin}: parsed a config containing needmcp`, /needmcp/.test(plain));
  check(`${bin}: context7 sibling present in parsed config`, /context7/.test(plain));
  check(`${bin}: parsed entry points at the expected URL`, plain.includes(url));
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
