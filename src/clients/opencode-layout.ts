import { execFileSync } from "node:child_process";
import { commandPaths, OPENCODE_V2_BINARY } from "./opencode-cli.js";

/**
 * Opencode layout selection.
 *
 * Opencode 1.x and 2.x use incompatible config layouts, and each rejects the
 * other's outright. Both facts were verified against the real binaries:
 *
 *   opencode 1.2.27
 *     - reads `mcp.<name>`
 *     - `Error: Configuration is invalid / ↳ Invalid input mcp.servers` when
 *       `mcp.servers` is present — ONE bad key hides EVERY server
 *     - entry shape: { type, url, enabled, oauth, headers }
 *
 *   opencode2 2.0.32
 *     - reads `mcp.servers.<name>`
 *     - entry shape: { type, url, headers, disabled }
 *
 * Because the layouts cannot coexist, exactly one must be chosen per run. When
 * only one version is installed the choice is unambiguous. When BOTH are
 * installed the user is asked, every time — the choice is never persisted, so
 * changing which binary you use needs no reset.
 */

export type OpencodeLayout = "v1" | "v2";

/** One installed Opencode line, as found on PATH. */
export interface DetectedOpencode {
  layout: OpencodeLayout;
  /** Binary name that resolves on PATH. */
  binary: string;
  /** Full version string as reported, or null when `--version` could not be read. */
  version: string | null;
}

/** Where the server entry sits under the config's `mcp` root. */
export function opencodeConfigKey(layout: OpencodeLayout): string[] {
  return layout === "v2" ? ["mcp", "servers"] : ["mcp"];
}

/**
 * Build the server entry for a given layout.
 *
 * `oauth: false` is what makes an API-key entry work at all: with OAuth
 * active the client ignores `X-API-Key` and parks the server at "needs
 * authentication". 2.x spells the same idea as `disabled: false` plus the
 * header, and its schema has no `oauth` field.
 */
export function buildOpencodeEntryFor(
  layout: OpencodeLayout,
  options: { apiKey?: string; mcpUrl: string }
): Record<string, unknown> {
  const { apiKey, mcpUrl } = options;

  if (layout === "v2") {
    const entry: Record<string, unknown> = { type: "remote", url: mcpUrl };
    if (apiKey) {
      entry.headers = { "X-API-Key": apiKey };
      entry.disabled = false;
    }
    return entry;
  }

  const entry: Record<string, unknown> = { type: "remote", url: mcpUrl, enabled: true };
  if (apiKey) {
    entry.oauth = false;
    entry.headers = { "X-API-Key": apiKey };
  }
  return entry;
}

/** Windows executables that need no shell. */
const DIRECT_EXTS = /\.(exe|com)$/i;
/** Windows batch shims: runnable, but only through cmd.exe. */
const SHIM_EXTS = /\.(cmd|bat)$/i;

/**
 * Read a binary's reported version, or null when nothing runnable responds.
 *
 * Resolution is the tricky part on Windows: `where opencode` lists the
 * extensionless npm shell script BEFORE `opencode.cmd`, and that script cannot
 * be spawned at all — trusting the first match made every probe fail, which
 * silently fell back to v1 and mislabelled a real 2.x install.
 *
 * Candidates are therefore filtered to the ones that can actually run, then
 * tried in order, stopping at the first success so a healthy install costs one
 * spawn.
 */
export function readOpencodeVersion(bin: string): string | null {
  const candidates = commandPaths(bin).filter((p) => DIRECT_EXTS.test(p) || SHIM_EXTS.test(p));

  for (const target of candidates.length > 0 ? candidates : [bin]) {
    try {
      // A batch shim must go through cmd.exe. Passing the path as an explicit
      // argument keeps one with spaces in a single piece — `shell: true` would
      // split it (and warn about unescaped arguments).
      const result = SHIM_EXTS.test(target)
        ? execFileSync("cmd.exe", ["/c", target, "--version"], { encoding: "utf-8", timeout: 15000 })
        : execFileSync(target, ["--version"], { encoding: "utf-8", timeout: 15000 });
      return result.trim();
    } catch {}
  }
  return null;
}

/** Major version parsed out of `opencode 1.2.27` / `opencode v2.0.32`. */
function majorOf(version: string | null): number | null {
  const major = version?.match(/(\d+)\.\d+\.\d+/)?.[1];
  return major ? Number(major) : null;
}

/**
 * List every Opencode line installed on PATH.
 *
 * `opencode2` is a separate binary and therefore unambiguously 2.x. The plain
 * `opencode` name is shared, so its version string decides which line it is —
 * a 2.x release installed under the plain name must not be mistaken for 1.x.
 *
 * Returns an empty array when nothing is installed.
 */
export function detectOpencodeLayouts(): DetectedOpencode[] {
  // Probing spawns real processes (~1.7s each for an npm `.cmd` shim), so the
  // answer is cached for the life of the process. Nothing installs a new
  // Opencode mid-run, and setup calls this from several layers.
  if (cachedLayouts) return cachedLayouts;

  const found: DetectedOpencode[] = [];

  for (const binary of ["opencode", OPENCODE_V2_BINARY]) {
    // One `where` per binary decides both presence and version: asking twice
    // doubles the cost for no new information.
    if (commandPaths(binary).length === 0) continue;

    const version = readOpencodeVersion(binary);
    const major = majorOf(version);
    // `opencode2` is always the 2.x line. The plain `opencode` name is shared,
    // so its version decides — and an unreadable one falls back to v1, which is
    // what the plain name has always meant.
    const layout =
      binary === OPENCODE_V2_BINARY || (major !== null && major >= 2) ? "v2" : "v1";
    found.push({ layout, binary, version });
  }

  cachedLayouts = found;
  return found;
}

let cachedLayouts: DetectedOpencode[] | null = null;

/** Drop the cached probe. Tests only — setup never changes binaries mid-run. */
export function resetOpencodeLayoutCache(): void {
  cachedLayouts = null;
}

/**
 * True when both layout families are available and the user must choose.
 *
 * Only meaningful when the two entries really would write different shapes;
 * two binaries that both report 2.x need no question.
 */
export function needsLayoutChoice(detected: DetectedOpencode[]): boolean {
  return new Set(detected.map((d) => d.layout)).size > 1;
}

/**
 * Pick a layout without asking, for non-interactive runs and single-version
 * machines.
 *
 * `opencode2` wins when present: it is the actively developed line and owns
 * `mcp add`. Callers must still ask the user when `needsLayoutChoice()` is
 * true — this is the fallback, not the preferred path.
 */
export function pickDefaultLayout(detected: DetectedOpencode[]): OpencodeLayout {
  if (detected.some((d) => d.layout === "v2")) return "v2";
  return "v1";
}

/**
 * Coerce a layout string from the client definition into `OpencodeLayout`.
 *
 * `ClientConfig.configKey`/`buildEntry` receive the layout as a plain `string`,
 * because the shared type cannot know about Opencode's two values. Anything
 * unrecognised falls back to detection, so a stale or malformed override can
 * never produce a third layout.
 */
export function asOpencodeLayout(layout: string | undefined): OpencodeLayout {
  // Case-insensitive: `--opencode-layout V1` is accepted by the CLI, so the
  // resolver must agree rather than silently falling through to detection.
  const normalised = layout?.trim().toLowerCase();
  if (normalised === "v1" || normalised === "v2") return normalised;
  return detectOpencodeLayout();
}

/**
 * Detect which layout the installed Opencode expects.
 *
 * Convenience for code paths that genuinely cannot prompt (tests, scripts,
 * config inspection). Setup itself asks the user when both versions exist.
 */
export function detectOpencodeLayout(): OpencodeLayout {
  return pickDefaultLayout(detectOpencodeLayouts());
}
