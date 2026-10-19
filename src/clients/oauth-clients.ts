/**
 * Per-client OAuth 2.1 command and config-entry builders.
 *
 * Every claim here was verified against the client's official documentation or
 * source; the doc reference is cited next to each builder. Anything unverified
 * is left out on purpose rather than guessed — a wrong argv silently produces a
 * registered-but-broken server.
 *
 * Read this before changing an entry builder:
 *
 *  - No builder may emit an `X-API-Key` or `Authorization` header. NeedMCP's
 *    middleware reads `X-API-Key` first and falls back to
 *    `Authorization: Bearer` into the same variable, so a stale key takes
 *    precedence over a valid OAuth token and the connection fails with
 *    "Invalid or revoked API key". OAuth entries must be header-free.
 *  - No builder may emit a `guest_id` cookie. Guest identity is client
 *    controlled and guest access is currently disabled server-side.
 *  - Access tokens live 1 hour (`config/oauth.php: access_token_ttl`), so the
 *    CLI never stores one. Refresh is the client's job.
 */

export const NEEDMCP_SERVER_NAME = "needmcp";

/** AWS Q Developer CLI, Zapier, etc. share this shape; kept for reuse. */
export interface BuilderContext {
  mcpUrl: string;
  scope: "global" | "project";
}

/**
 * Claude Code — `claude mcp add --transport http <name> <url>`.
 *
 * OAuth is performed by Claude Code itself: it marks a remote server as needing
 * auth when `/mcp` returns 401 and completes the browser flow from `/mcp`.
 * `docs: code.claude.com/docs/en/mcp` (Authenticate with remote MCP servers).
 * Scopes are `user`/`project`/`local`; `user` matches our global scope.
 */
export function buildClaudeCodeAddArgs(ctx: BuilderContext): string[] {
  const args = ["mcp", "add", "--transport", "http"];
  if (ctx.scope === "global") args.push("--scope", "user");
  args.push(NEEDMCP_SERVER_NAME, ctx.mcpUrl);
  return args;
}

/**
 * Amp — `amp mcp add <name> <url>`.
 *
 * Docs: "Many remote servers handle authentication automatically via OAuth."
 * Amp persists the resulting token itself. `ampcode.com/manual/mcp`.
 */
export function buildAmpAddArgs(ctx: BuilderContext): string[] {
  return ["mcp", "add", NEEDMCP_SERVER_NAME, ctx.mcpUrl];
}

/**
 * Factory (droid) — `droid mcp add <name> <url> --type http`.
 * Sign-in happens through the `/mcp` dialog inside droid.
 */
export function buildFactoryAddArgs(ctx: BuilderContext): string[] {
  return ["mcp", "add", NEEDMCP_SERVER_NAME, ctx.mcpUrl, "--type", "http"];
}

/**
 * Qwen Code — `qwen mcp add --transport http <name> <url>`.
 *
 * Qwen Code supports OAuth discovery for remote servers and pins its callback
 * to port 7777. Docs: QwenLM/qwen-code `docs/users/features/mcp.md`.
 */
export function buildQwenAddArgs(ctx: BuilderContext): string[] {
  const args = ["mcp", "add", "--transport", "http"];
  if (ctx.scope === "global") args.push("--scope", "user");
  args.push(NEEDMCP_SERVER_NAME, ctx.mcpUrl);
  return args;
}

/**
 * OpenAI Codex — `codex mcp add <name> --url <url>`, then `codex mcp login <name>`.
 *
 * Docs: developers.openai.com/codex/mcp — "OAuth authentication (run
 * `codex mcp login <server-name>` for servers that support OAuth)".
 * Config lives in `~/.codex/config.toml`; the login step is separate so that a
 * failed sign-in still leaves the server registered.
 */
export function buildCodexAddArgs(ctx: BuilderContext): string[] {
  return ["mcp", "add", NEEDMCP_SERVER_NAME, "--url", ctx.mcpUrl];
}

export function buildCodexLoginArgs(): string[] {
  return ["mcp", "login", NEEDMCP_SERVER_NAME];
}

/**
 * Gemini CLI — `gemini mcp add --transport http <name> <url>`.
 *
 * Gemini CLI validates the RFC 9207 `iss` parameter whenever an issuer is
 * discovered. NeedMCP's authorization-server metadata does **not** advertise
 * `authorization_response_iss_parameter_supported`, so the Gemini docs' opt-out
 * switch must be set or every callback is rejected:
 *
 *   "authorizationResponseIssParameterSupported": false
 *
 * Verified live: GET /.well-known/oauth-authorization-server returns no `iss`
 * support key. Docs: geminicli.com/docs/tools/mcp-server.
 */
export function buildGeminiAddArgs(ctx: BuilderContext): string[] {
  const args = ["mcp", "add", "--transport", "http"];
  if (ctx.scope === "global") args.push("--scope", "user");
  args.push(NEEDMCP_SERVER_NAME, ctx.mcpUrl);
  return args;
}

export function geminiOAuthExtra(): Record<string, unknown> {
  return {
    oauth: {
      enabled: true,
      authorizationResponseIssParameterSupported: false,
    },
  };
}

/**
 * Kilo Code — `kilo mcp auth <name>` once the server exists. Kilo performs OAuth
 * by default for remote servers (`oauth: false` opts out), so the stored entry
 * needs no header.
 */
export function buildKiloAddArgs(ctx: BuilderContext): string[] {
  return ["mcp", "add", NEEDMCP_SERVER_NAME, ctx.mcpUrl, "--transport", "http"];
}

export function buildKiloAuthArgs(): string[] {
  return ["mcp", "auth", NEEDMCP_SERVER_NAME];
}

/**
 * Crush — OAuth is opt-in per server: the entry needs `"oauth": true`.
 * Docs: charmbracelet/crush `docs/config` (`--oauth` flag / `oauth` key).
 */
export function crushOAuthEntry(mcpUrl: string): Record<string, unknown> {
  return { type: "http", url: mcpUrl, oauth: true };
}

/**
 * Cursor — remote servers authenticate via OAuth automatically once an entry is
 * present without an `Authorization`/API-key header. Cursor has no documented
 * CLI for MCP registration, so this entry is written directly.
 * Docs: cursor.com/docs/context/mcp.
 */
export function cursorOAuthEntry(mcpUrl: string): Record<string, unknown> {
  return { url: mcpUrl };
}

/**
 * VS Code — `.vscode/mcp.json` uses a top-level `servers` object and `type:
 * "http"`. VS Code runs the OAuth 2.1 flow itself when no header is present.
 * Docs: code.visualstudio.com/docs/agents/reference/mcp-configuration.
 */
export function vscodeOAuthEntry(mcpUrl: string): Record<string, unknown> {
  return { type: "http", url: mcpUrl };
}

/**
 * Zed — `context_servers` entries authenticate via OAuth when the entry has no
 * `headers`. Adding an `Authorization` header disables the browser prompt.
 * Docs: zed.dev/docs/ai/mcp.
 */
export function zedOAuthEntry(mcpUrl: string): Record<string, unknown> {
  return { url: mcpUrl };
}

/**
 * Kiro — `mcpServers` entry; Kiro discovers OAuth from the 401 challenge.
 * Docs: kiro.dev MCP configuration.
 */
export function kiroOAuthEntry(mcpUrl: string): Record<string, unknown> {
  return { url: mcpUrl };
}

/**
 * Renders an argv as a copy-pasteable shell command for user-facing output.
 * The argv itself is never shell-executed, so this is display-only.
 */
export function formatOAuthCommand(bin: string, args: string[]): string {
  const quote = (arg: string) => (/[\s'"]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg);
  return [bin, ...args.map(quote)].join(" ");
}
