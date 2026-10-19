/**
 * Functional smoke test for the auth-mode switch, run against real files in a
 * temp HOME. Lives outside src/__tests__ so vitest does not pick it up; it is
 * invoked manually (see the npm script `smoke:auth`).
 *
 * It exercises the same code paths setup.ts uses — mergeServerEntry +
 * writeJsonConfig — so a regression in the writer is caught here end to end.
 */
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mergeServerEntry, readJsonConfig, writeJsonConfig } from "../src/mcp-writer.js";
import { JSON_CLIENTS } from "../src/clients/json.js";
import { CLI_CLIENTS } from "../src/clients/cli.js";

const URL_ = "https://needmcp.com/mcp";
const OLD_KEY = "sk-need-OLDKEYOLDKEYOLDKEY";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok   ${msg}`);
  }
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "needmcp-smoke-"));
  const cursorDir = join(dir, ".cursor");
  await mkdir(cursorDir, { recursive: true });
  const file = join(cursorDir, "mcp.json");

  // Simulate a config written by the previous CLI version (API-key mode).
  await writeFile(
    file,
    JSON.stringify(
      {
        mcpServers: {
          needmcp: { url: URL_, headers: { "X-API-Key": OLD_KEY } },
          "other-server": {
            url: "https://other.example.com/mcp",
            headers: { "X-API-Key": "untouched" },
          },
        },
        userSetting: "keep-me",
      },
      null,
      2
    ),
    "utf-8"
  );

  const cursor = JSON_CLIENTS.find((c) => c.id === "cursor")!;
  assert(cursor.oauth !== undefined, "cursor declares OAuth capability");
  assert(cursor.oauth!.mode === "config-only", "cursor OAuth is config-only (no CLI)");

  // Switch to OAuth exactly as setupJsonClient does.
  const existing = await readJsonConfig(file);
  const oauthEntry = cursor.oauth!.buildEntry!(URL_);
  const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", oauthEntry);
  await writeJsonConfig(file, config);

  const written = JSON.parse(await readFile(file, "utf-8"));
  const raw = await readFile(file, "utf-8");

  assert(written.mcpServers.needmcp.headers === undefined, "OAuth entry has no headers");
  assert(
    !JSON.stringify(written.mcpServers.needmcp).includes(OLD_KEY),
    "stale API key dropped from needmcp entry"
  );
  assert(
    JSON.stringify(written.mcpServers["other-server"]).includes("untouched"),
    "sibling server untouched"
  );
  assert(written.userSetting === "keep-me", "unrelated top-level key preserved");
  assert(!raw.includes("mcp_at_"), "no OAuth access token persisted");

  // Switch back to an API key.
  const back = await readJsonConfig(file);
  const keyEntry = cursor.buildEntry!(OLD_KEY, URL_);
  const { config: restored } = mergeServerEntry(back, "mcpServers", "needmcp", keyEntry);
  await writeJsonConfig(file, restored);
  const restoredRaw = JSON.parse(await readFile(file, "utf-8"));
  assert(
    restoredRaw.mcpServers.needmcp.headers["X-API-Key"] === OLD_KEY,
    "API key restored when switching back"
  );

  // CLI clients: no --header in OAuth, --header present for a key.
  const claude = CLI_CLIENTS.find((c) => c.id === "claude-code")!;
  const keyCmd = claude.buildCommand!(OLD_KEY, URL_);
  const oauthArgs = claude.oauth!.addArgs!(URL_, "global");
  assert(keyCmd.includes("X-API-Key"), "API-key command carries X-API-Key");
  assert(!keyCmd.includes("Bearer"), "API-key command never uses Bearer");
  assert(!oauthArgs.join(" ").includes("--header"), "OAuth argv has no --header");
  assert(!oauthArgs.join(" ").includes("X-API-Key"), "OAuth argv has no X-API-Key");

  await rm(dir, { recursive: true, force: true });

  console.log(process.exitCode ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
}

void main();
