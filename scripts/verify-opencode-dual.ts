import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Prove the dual-version prompt with a PATH that really has both Opencode
 * families.
 *
 * This machine ships only one line at a time, so the "both installed" branch
 * cannot be reached with what is on PATH. Two stand-in executables reporting
 * 1.2.27 and 2.0.32 are prepended instead — the detection code under test is
 * the real one, only the binaries are synthetic.
 *
 * Detection runs in a child process because it caches its answer, and a child
 * sees exactly the PATH it is handed.
 */

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : `\n        ${detail}`}`);
  if (!ok) failures++;
}

interface ProbeResult {
  detected: { layout: string; binary: string; version: string | null }[];
  both: boolean;
}

/** Run the probe with an optional prefix prepended to PATH. */
function probe(pathPrefix?: string): ProbeResult {
  const out = execFileSync(process.execPath, [join(process.cwd(), "scripts", ".tmp", "probe.mjs")], {
    encoding: "utf-8",
    env: pathPrefix ? { ...process.env, PATH: `${pathPrefix};${process.env.PATH ?? ""}` } : process.env,
    timeout: 120000,
  });
  return JSON.parse(out.trim().split("\n").pop()!) as ProbeResult;
}

const dir = join(tmpdir(), `needmcp-dual-${Date.now()}`);
mkdirSync(dir, { recursive: true });

try {
  for (const [name, version] of [["opencode", "1.2.27"], ["opencode2", "2.0.32"]]) {
    writeFileSync(join(dir, `${name}.js`), `console.log("opencode ${version}");\n`);
    writeFileSync(join(dir, `${name}.cmd`), `@node "%~dp0${name}.js" %*\r\n`);
  }

  const fake = probe(dir);
  console.log(`  with stand-ins: ${fake.detected.map((d) => `${d.binary}=${d.layout}`).join(", ")}`);

  check("with both binaries on PATH, the choice is demanded", fake.both === true);
  check(
    "the 1.x stand-in is classified v1",
    fake.detected.some(
      (d) => d.binary === "opencode" && d.layout === "v1" && /1\.2\.27/.test(d.version ?? "")
    )
  );
  check(
    "the 2.x stand-in is classified v2",
    fake.detected.some(
      (d) => d.binary === "opencode2" && d.layout === "v2" && /2\.0\.32/.test(d.version ?? "")
    )
  );

  // Same code on the real PATH: whatever is installed must be readable, since an
  // unreadable version silently degrades to the v1 layout.
  const real = probe();
  console.log(`  real installs : ${real.detected.map((d) => `${d.binary}=${d.layout}`).join(", ")}`);
  check("real detection finds an installed Opencode", real.detected.length > 0);
  check(
    "every real binary reports a version",
    real.detected.every((d) => d.version !== null),
    JSON.stringify(real.detected)
  );
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
