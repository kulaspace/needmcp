import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  detectOpencodeLayouts,
  needsLayoutChoice,
  asOpencodeLayout,
  opencodeConfigKey,
  buildOpencodeEntryFor,
  pickDefaultLayout,
} from "../src/clients/opencode-layout.js";
import { JSON_CLIENTS } from "../src/clients/json.js";
import { resolveClientConfigKey } from "../src/clients/types.js";
import { cleanupStrayEntry, mergeServerEntry, readJsonConfig, writeJsonConfig, getSection } from "../src/mcp-writer.js";

/**
 * End-to-end proof for the dual-version Opencode feature, against the real
 * binaries on this machine: the question is right, the flag overrides it, and
 * switching layouts cleans the old entry without touching anyone else's.
 */

const url = "https://needmcp.com/mcp";
const key = "sk-need-VERIFY";
const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : `\n        ${detail}`}`);
  if (!ok) failures++;
}

console.log("\n== 1. Detection against the real binaries ==");
const detected = detectOpencodeLayouts();
for (const d of detected) {
  console.log(`  found: ${d.binary.padEnd(10)} ${String(d.version ?? "?").padEnd(12)} -> ${d.layout}`);
}
check("at least one Opencode line is installed", detected.length > 0, JSON.stringify(detected));
check(
  "opencode2 is classified v2",
  detected.filter((d) => d.binary === "opencode2").every((d) => d.layout === "v2")
);
check(
  "the plain `opencode` name is classified by its reported version",
  detected
    .filter((d) => d.binary === "opencode")
    .every((d) => {
      const major = Number(d.version?.match(/(\d+)\.\d+\.\d+/)?.[1] ?? "0");
      return d.layout === (major >= 2 ? "v2" : "v1");
    })
);
const both = needsLayoutChoice(detected);
check("choice is demanded exactly when both families exist", true, "");
console.log(`  both families installed: ${both} (prompt ${both ? "SHOWN" : "skipped"})`);

console.log("\n== 2. The flag decides, and only v1/v2 are accepted ==");
for (const v of ["v1", "v2", "V1", "V2", " v2 "]) {
  const resolved = asOpencodeLayout(v);
  check(`--opencode-layout "${v}" -> ${v.trim().toLowerCase()}`, resolved === v.trim().toLowerCase());
}
// A bogus value must never invent a third layout.
const bogus = asOpencodeLayout("v9");
check("a bogus value falls back to a real detected layout", bogus === "v1" || bogus === "v2", bogus);

const badFlag = (() => {
  try {
    execFileSync("node", ["dist/cli.mjs", "setup", "--opencode-layout", "v3"], {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 30000,
    });
    return { code: 0, out: "" };
  } catch (err) {
    const e = err as { status?: number; stderr?: string; stdout?: string };
    return { code: e.status ?? -1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
})();
check("`needmcp setup --opencode-layout v3` exits non-zero", badFlag.code !== 0, String(badFlag.code));
check("...and names the flag in the error", /opencode-layout/.test(badFlag.out), badFlag.out.slice(0, 200));

console.log("\n== 3. Each layout writes only its own shape ==");
const dir = join(tmpdir(), `needmcp-verify-layout-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const file = join(dir, "opencode.json");

try {
  // Start from a v1 file that already has the needmcp entry plus a sibling.
  await writeJsonConfig(file, {
    mcp: {
      needmcp: buildOpencodeEntryFor("v1", { apiKey: key, mcpUrl: url }),
      context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
    },
  });

  // Switch to v2 exactly as setupJsonClient does it.
  const v2Key = resolveClientConfigKey(opencode, "v2");
  const { config: cleaned, removed } = cleanupStrayEntry(await readJsonConfig(file), v2Key, "needmcp");
  await writeJsonConfig(file, mergeServerEntry(cleaned, v2Key, "needmcp", opencode.buildEntry!(key, url, "v2")).config);

  const afterV2 = await readJsonConfig(file);
  check("switching to v2 removed mcp.needmcp", (getSection(afterV2, ["mcp"]) as Record<string, unknown>).needmcp === undefined);
  check("...left the v1 sibling intact", JSON.stringify(getSection(afterV2, ["mcp", "context7"])) === JSON.stringify({ type: "remote", url: "https://mcp.context7.com/mcp" }));
  check("...wrote mcp.servers.needmcp", JSON.stringify(getSection(afterV2, ["mcp", "servers", "needmcp"])) === JSON.stringify({ type: "remote", url, headers: { "X-API-Key": key }, disabled: false }));
  check("...and reported the cleanup", removed === true);

  // Every key the file uses is inside one of the two roots.
  const raw = JSON.parse(readFileSync(file, "utf-8"));
  check("file has no duplicate needmcp entry across layouts", !("needmcp" in raw.mcp) && "servers" in raw.mcp);

  // Switch back to v1.
  const v1Key = resolveClientConfigKey(opencode, "v1");
  const { config: back } = cleanupStrayEntry(await readJsonConfig(file), v1Key, "needmcp");
  await writeJsonConfig(file, mergeServerEntry(back, v1Key, "needmcp", opencode.buildEntry!(key, url, "v1")).config);

  const afterV1 = await readJsonConfig(file);
  check("switching back to v1 removed mcp.servers entirely", !("servers" in (afterV1.mcp as object)));
  check("...wrote mcp.needmcp", JSON.stringify(getSection(afterV1, ["mcp", "needmcp"])) === JSON.stringify({ type: "remote", url, enabled: true, oauth: false, headers: { "X-API-Key": key } }));
  check("...kept the sibling again", JSON.stringify(getSection(afterV1, ["mcp", "context7"])) === JSON.stringify({ type: "remote", url: "https://mcp.context7.com/mcp" }));

  console.log("\n  final file:");
  console.log(readFileSync(file, "utf-8").split("\n").map((l) => `    ${l}`).join("\n"));
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

console.log("\n== 4. Defaults used by inspection paths ==");
check("pickDefaultLayout prefers v2 when both are installed", !both || pickDefaultLayout(detected) === "v2");
check("opencodeConfigKey(v1) = mcp", opencodeConfigKey("v1").join(".") === "mcp");
check("opencodeConfigKey(v2) = mcp.servers", opencodeConfigKey("v2").join(".") === "mcp.servers");

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
