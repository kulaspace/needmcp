/**
 * Default endpoints, resolved lazily.
 *
 * These are getters rather than top-level constants on purpose: `process.env` is
 * only populated after `.env` is loaded, and a module-level `const` would capture
 * the value at import time — before `loadEnv()` had a chance to run. With ESM
 * hoisting every import ahead of the entry module's body, reading env eagerly
 * here silently pinned the production URL even when `.env` pointed at localhost.
 */
export function defaultBaseUrl(): string {
  return process.env.NEEDMCP_BASE_URL || "https://needmcp.com";
}

export function defaultMcpUrl(): string {
  return `${defaultBaseUrl()}/mcp`;
}
