import { config as loadDotenv } from "dotenv";

/**
 * Load `.env` from the current directory, then from the CLI's install directory.
 *
 * `dotenv/config` only reads `.env` from `process.cwd()`. That is surprising for
 * a global CLI: running `needmcp setup` from a project without a `.env` silently
 * falls back to the production URL even when the developer set
 * `NEEDMCP_BASE_URL=http://127.0.0.1:8000` in the repo where the CLI lives.
 *
 * Loading the install directory as a *second* source (never overriding variables
 * already set) keeps local development working from any working directory while
 * leaving normal users untouched — they have no `.env` next to the binary.
 *
 * Real environment variables always win, because dotenv does not overwrite
 * existing keys.
 */
export function loadEnv(): void {
  loadDotenv({ quiet: true });

  const installEnv = new URL("../.env", import.meta.url);
  loadDotenv({ path: installEnv, quiet: true });
}

/**
 * True when the MCP URL was overridden away from the packaged default.
 * Callers use this to tell the user which endpoint they are configuring.
 */
export function isUrlOverridden(): boolean {
  return Boolean(process.env.NEEDMCP_MCP_URL || process.env.NEEDMCP_BASE_URL);
}
