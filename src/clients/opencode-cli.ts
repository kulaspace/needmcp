import { execFileSync } from "node:child_process";

export const OPENCODE_SERVER_NAME = "needmcp";

export type OpencodeScope = "global" | "project";

/** Opencode 2.x ships as a separate binary; 1.x keeps the plain name. */
export const OPENCODE_V2_BINARY = "opencode2";

/** POSIX-safe single-quote escaping used across the CLI command builders. */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Build the argv for `opencode mcp add` (Opencode 2.x only).
 *
 * Verified against `opencode2` 2.0.32:
 *
 *   FLAGS
 *     --url string          URL for a remote MCP server
 *     --header key=value    HTTP header, as name=value
 *     --global              Write to the global config
 *
 * Two details are easy to get wrong and are encoded here:
 *  - `--header` takes `key=value`, NOT `key: value`.
 *  - `--global` is omitted for project scope (it defaults to the project).
 *
 * Opencode 1.x has an `mcp add` subcommand too, but with no flags at all — it
 * only opens a TUI wizard, so it cannot be scripted. `canScriptMcpAdd()` gates
 * on that, and 1.x falls back to writing `opencode.jsonc` directly.
 */
export function buildOpencodeAddArgs(options: {
  mcpUrl: string;
  scope: OpencodeScope;
  apiKey?: string;
}): string[] {
  const args = ["mcp", "add", OPENCODE_SERVER_NAME, "--url", options.mcpUrl];
  if (options.apiKey) {
    args.push("--header", `X-API-Key=${options.apiKey}`);
  }
  if (options.scope === "global") {
    args.push("--global");
  }
  return args;
}

/**
 * Build the argv for `opencode mcp auth needmcp`.
 *
 * Valid in both 1.x and 2.x. The server must already be registered — under
 * 1.x that means the entry was written to `opencode.jsonc` first.
 */
export function buildOpencodeAuthArgs(): string[] {
  return ["mcp", "auth", OPENCODE_SERVER_NAME];
}

/** Human-readable form of an argv, for echoing the command before running it. */
export function formatArgv(bin: string, args: string[]): string {
  return [bin, ...args.map(escapeShellArg)].join(" ");
}

function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Check whether an executable is on PATH.
 *
 * `where`/`which` are used instead of spawning the binary directly so a
 * missing `opencode` never produces a shell error on the user's terminal.
 */
export function commandExists(bin: string): boolean {
  try {
    execFileSync(isWindows() ? "where" : "which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Where a binary actually lives, or null when it is not on PATH.
 *
 * Returns every match, in PATH order. On Windows `where` lists the extensionless
 * shell script before the `.cmd` shim for the same install, and the former is
 * not executable — so callers must try them in turn rather than trust the first.
 */
export function commandPaths(bin: string): string[] {
  try {
    const out = execFileSync(isWindows() ? "where" : "which", [bin], { encoding: "utf-8" });
    return out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

export function isOpencodeInstalled(): boolean {
  return commandExists("opencode") || commandExists(OPENCODE_V2_BINARY);
}

/** True when the 2.x binary is available. */
export function hasOpencodeV2(): boolean {
  return commandExists(OPENCODE_V2_BINARY);
}

/**
 * Pick the binary that should run Opencode subcommands.
 *
 * 2.x installs as `opencode2`, 1.x as `opencode`. Both accept `mcp auth`, but
 * only 2.x accepts `mcp add --url/--header/--global`, so the 2.x binary is
 * preferred whenever it is present. Falls back to `opencode` so 1.x-only
 * machines keep working.
 */
export function resolveOpencodeBinary(): string {
  if (hasOpencodeV2()) return OPENCODE_V2_BINARY;
  return "opencode";
}

/**
 * True when `opencode mcp add` can be driven non-interactively.
 *
 * Only 2.x exposes the flags; 1.x's `mcp add` is a TUI wizard that would hang a
 * spawned process. Everything else writes the config file directly.
 */
export function canScriptMcpAdd(): boolean {
  return hasOpencodeV2();
}
