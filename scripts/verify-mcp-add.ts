import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { buildOpencodeAddArgs, canScriptMcpAdd, resolveOpencodeBinary } from "../src/clients/opencode-cli.js";

/**
 * Proves the `opencode mcp add` path writes ONLY the needmcp entry.
 *
 * The bug this guards against: an earlier migration step copied the user's
 * whole global config (providers, plugins, agents) into the project file. The
 * CLI must never do that — the client already merges global and project config.
 */

const url = "http://127.0.0.1:8000/mcp";
const key = "sk-need-HARNESSKEY";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

if (!canScriptMcpAdd()) {
  console.log("SKIP  opencode2 not installed — 1.x path is file-write only");
  process.exit(0);
}

const dir = await mkdtemp(join(tmpdir(), "needmcp-add-"));
const bin = resolveOpencodeBinary();

const args = buildOpencodeAddArgs({ mcpUrl: url, scope: "project", apiKey: key });
console.log(`running: ${bin} ${args.join(" ")}\n`);

try {
  execFileSync(bin, args, { cwd: dir, stdio: "ignore", timeout: 60000 });
} catch (err) {
  check("mcp add exited cleanly", false, (err as Error).message.slice(0, 120));
}

const files = await readdir(dir);
check("wrote exactly one config file", files.length === 1, files.join(", "));

const written = JSON.parse(await readFile(join(dir, files[0]), "utf-8"));
const topKeys = Object.keys(written);
check("file has a single top-level key", topKeys.length === 1, topKeys.join(", "));
check("no provider/plugin/agent copied in", !topKeys.some((k) => ["provider", "plugin", "agent", "model"].includes(k)));

const serialised = JSON.stringify(written);
check("needmcp is the only server", (serialised.match(/"type"\s*:\s*"remote"/g) ?? []).length === 1);
check("URL preserved", serialised.includes(url));
check("API key preserved", serialised.includes(key));

console.log("\n--- written file ---");
console.log(await readFile(join(dir, files[0]), "utf-8"));

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
await rm(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
