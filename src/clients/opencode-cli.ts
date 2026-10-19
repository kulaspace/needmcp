import { execFileSync } from "node:child_process";

export const OPENCODE_SERVER_NAME = "needmcp";

export type OpencodeVersion = "v1" | "v2";
export type OpencodeScope = "global" | "project";

/** POSIX-safe single-quote escaping used across the CLI command builders. */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Build the argv for `opencode mcp add`.
 *
 * Kept as an array (not a shell string) so it can be passed straight to
 * `execFileSync` without a shell re-parsing the URL.
 *
 * `--global` is only emitted for v2: the v1 documentation does not list the
 * flag, so passing it there would make the command fail.
 */
export function buildOpencodeAddArgs(
  version: OpencodeVersion,
  scope: OpencodeScope,
  mcpUrl: string
): string[] {
  const args = ["mcp", "add", OPENCODE_SERVER_NAME, "--url", mcpUrl];
  if (version === "v2" && scope === "global") {
    args.push("--global");
  }
  return args;
}

/** Build the argv for `opencode mcp auth needmcp`. */
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

export function isOpencodeInstalled(): boolean {
  return commandExists("opencode");
}

/**
 * Read the major version reported by `opencode --version`.
 *
 * Returns `null` when the binary is missing or its output cannot be parsed —
 * callers must treat that as "unknown" rather than guessing a schema, because
 * writing the wrong layout silently disables the server.
 */
export function detectOpencodeVersion(): OpencodeVersion | null {
  let output: string;
  try {
    output = execFileSync("opencode", ["--version"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000,
    });
  } catch {
    return null;
  }

  const match = output.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  const major = Number(match[1]);
  if (!Number.isFinite(major) || major <= 0) return null;

  return major >= 2 ? "v2" : "v1";
}
