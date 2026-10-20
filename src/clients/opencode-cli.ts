export const OPENCODE_SERVER_NAME = "needmcp";

/** POSIX-safe single-quote escaping used across the CLI command builders. */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Build the argv for `opencode mcp auth needmcp`.
 *
 * Valid in both 1.x and 2.x. The server must already be registered — the CLI
 * writes the entry into `opencode.jsonc` first, so by the time this runs the
 * server is in the config and can be resolved.
 */
export function buildOpencodeAuthArgs(): string[] {
  return ["mcp", "auth", OPENCODE_SERVER_NAME];
}

/** Human-readable form of an argv, for echoing the command before running it. */
export function formatArgv(bin: string, args: string[]): string {
  return [bin, ...args.map(escapeShellArg)].join(" ");
}
