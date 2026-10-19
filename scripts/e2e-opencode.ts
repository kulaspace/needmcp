import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

import { JSON_CLIENTS } from "../src/clients/json.js";
import { detectOpencodeLayout, opencodeConfigKey } from "../src/clients/opencode-layout.js";
import {
  readJsonConfig,
  writeJsonConfig,
  mergeServerEntry,
  getSection,
  loadMigrationSource,
  cleanupStrayEntry,
  hasJsonComments,
} from "../src/mcp-writer.js";

/**
 * End-to-end check for the Opencode writer.
 *
 * Runs the real config-writing path against a temp directory, then asks the
 * installed Opencode binary to list the servers.
 *
 * The layout is NOT arbitrary: Opencode 1.x and 2.x use incompatible shapes and
 * each rejects the other. This script detects the installed version and asserts
 * against that version's real shape, so a regression in either branch shows up.
 *
 *   layout   config root         entry
 *   v1       mcp.<name>          { type, url, enabled, oauth, headers }
 *   v2       mcp.servers.<name>  { type, url, headers, disabled }
 *
 * Requires Opencode on PATH. A real key can be passed via NEEDMCP_TEST_KEY to
 * additionally assert "connected" rather than merely "listed".
 */

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
// Defaults to production so the script is meaningful on any machine; override
// with NEEDMCP_TEST_MCP_URL to point at a local backend.
const url = process.env.NEEDMCP_TEST_MCP_URL ?? "https://needmcp.com/mcp";
const key = process.env.NEEDMCP_TEST_KEY ?? "sk-need-TESTKEY";
const layout = detectOpencodeLayout();
const serversAt = opencodeConfigKey(layout);

const dir = await mkdtemp(join(tmpdir(), "needmcp-e2e-"));
const target = join(dir, "opencode.json");
const legacy = join(dir, "opencode.jsonc");

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

// A realistic config: three sibling servers, placed where the installed client
// reads them. 1.x additionally carries the stray `mcp.servers` key left behind
// by an older CLI release — the thing this writer has to clean up.
const siblings = {
  context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
  github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
  mxterm: { type: "local", command: ["mxterm"] },
};
const legacyConfig =
  layout === "v2"
    ? { $schema: "https://opencode.ai/config.json", mcp: { servers: { ...siblings } } }
    : {
        $schema: "https://opencode.ai/config.json",
        mcp: { ...siblings, servers: { needmcp: { type: "remote", url } } },
      };
await writeFile(legacy, JSON.stringify(legacyConfig, null, 2));

console.log(`layout: ${layout}  (servers at ${serversAt.join(".")})\n`);

// --- Replicate setupJsonClient's decision sequence -------------------------
const migration = await loadMigrationSource(target, [legacy]);
check("migration detected from opencode.jsonc", migration !== null);

const existing = migration ? migration.config : await readJsonConfig(target);
const { config: cleaned, removed: strayRemoved } = cleanupStrayEntry(existing, serversAt, "needmcp");
if (layout === "v1") {
  check("stray mcp.servers.needmcp removed", strayRemoved);
}

const { config, alreadyExists } = mergeServerEntry(
  cleaned,
  serversAt,
  "needmcp",
  opencode.buildEntry!(key, url)
);
await writeJsonConfig(target, config);
check("target file written", true, target);
check("first write is not an update", alreadyExists === false);

// --- Verify the written file ----------------------------------------------
const written = await readJsonConfig(target);
const servers = getSection(written, serversAt)!;

check(
  `needmcp sits at ${serversAt.join(".")}.needmcp`,
  JSON.stringify(servers.needmcp) === JSON.stringify(opencode.buildEntry!(key, url)),
  JSON.stringify(servers.needmcp)
);
check("API key header written", servers.needmcp.headers?.["X-API-Key"] === key);

if (layout === "v2") {
  check("entry marked enabled (disabled:false)", servers.needmcp.disabled === false);
  check("no 1.x-only fields", servers.needmcp.oauth === undefined && servers.needmcp.enabled === undefined);
} else {
  check("OAuth disabled so the API-key header is used", servers.needmcp.oauth === false);
  // 1.x fails the WHOLE config on `mcp.servers`, hiding every sibling.
  check("no mcp.servers anywhere", servers.servers === undefined);
}

check(
  "siblings preserved",
  Object.entries(siblings).every(
    ([name, value]) => JSON.stringify(servers[name]) === JSON.stringify(value)
  )
);

// The legacy file must be byte-identical.
const legacyAfter = await readFile(legacy, "utf-8");
check("legacy opencode.jsonc untouched", legacyAfter === JSON.stringify(legacyConfig, null, 2));

// --- Idempotency ----------------------------------------------------------
const second = mergeServerEntry(
  await readJsonConfig(target),
  serversAt,
  "needmcp",
  opencode.buildEntry!(key, url)
);
check("second write reports update", second.alreadyExists === true);
check("no duplicate entries", JSON.stringify(second.config) === JSON.stringify(written));

// --- Comment detection ----------------------------------------------------
await writeFile(target, '{\n  // my note\n  "mcp": {}\n}\n');
check("comments detected before overwrite", await hasJsonComments(target));

// --- Validate against the real binary -------------------------------------
// Restore the full config: a file holding only needmcp would make the
// "siblings still listed" check meaningless.
await writeJsonConfig(target, config);
await rm(legacy, { force: true });

/**
 * Ask the installed binary what configuration it actually parsed.
 *
 * `mcp list` is NOT used for 2.x. Its background service binds to the FIRST
 * project directory it ever saw and keeps serving that one; running `mcp list`
 * from a fresh directory returns "No MCP servers configured" no matter what the
 * local file says, and `reload` fails once that first directory is gone. That
 * is a property of the daemon, not of the written config.
 *
 * `debug config` instead prints every config source and its parsed content, so
 * it answers the only question this script can answer honestly: did the client
 * parse the file we wrote, and is our entry in it?
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

const bin = layout === "v2" ? "opencode2" : "opencode";
const command = layout === "v2" ? ["debug", "config"] : ["mcp", "list"];
const { text } = parseCheck(bin, command);
const plain = text.replace(/\x1b\[[0-9;]*m/g, "");

if (plain.trim().length === 0) {
  console.log(`SKIP  ${bin} produced no output`);
} else {
  console.log(`\n=== ${bin} (${layout}) via \`${command.join(" ")}\` ===`);
  const schemaError = /Invalid input|Configuration is invalid/i.test(plain);

  check(`${bin}: accepts the written config`, !schemaError);
  check(`${bin}: parsed a config containing needmcp`, /needmcp/.test(plain));
  check(`${bin}: context7 sibling present in parsed config`, /context7/.test(plain));

  // The URL must survive parsing — a config the client rejects would not echo it.
  check(`${bin}: parsed entry points at the expected URL`, plain.includes(url));

  if (layout === "v1" && process.env.NEEDMCP_TEST_KEY) {
    // Only 1.x can report live status without the daemon; and only a real key
    // yields "connected" (the placeholder is rejected by the server).
    const status = plain.replace(/\s+/g, " ").match(/needmcp\s+\w+/)?.[0] ?? "not found";
    check(`${bin}: needmcp reports connected`, /needmcp\s+connected/i.test(plain), status);
  }

  if (layout === "v2") {
    console.log(
      "\nnote: `opencode2 mcp list` is skipped — its background service binds to the\n" +
        "      first project directory it saw, so it cannot be pointed at a temp dir."
    );
  }
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
