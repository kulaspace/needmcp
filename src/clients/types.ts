/**
 * How a client authenticates to the NeedMCP `/mcp` endpoint.
 *
 * The NeedMCP server accepts two credential families on the *same* route,
 * discriminated purely by token prefix (see the server's SimpleApiKeyAuth):
 *
 *   - `sk-need-*` / `sk_need_*` — long-lived static API keys
 *   - `mcp_at_*`                — OAuth 2.1 access tokens, 1 hour TTL
 *
 * Because an OAuth access token expires in an hour and only the client can
 * refresh it, the CLI must never persist an `mcp_at_*` token itself. OAuth mode
 * therefore means "register the URL and let the client own the token", and the
 * entry is written without an `X-API-Key` header (a configured key would be
 * preferred by the server's middleware and would mask the OAuth token).
 *
 * - `native`      the client runs the OAuth handshake itself (and refreshes)
 * - `config-only` the config format carries OAuth settings, but sign-in is a
 *                 manual step inside the app — no CLI/API to drive it
 * - `unsupported` no OAuth; the API key header is the only option
 */
export type OAuthMode = "native" | "config-only" | "unsupported";

export interface OAuthCapability {
  mode: OAuthMode;
  /**
   * Build the argv for the client's `mcp add` command, run before login.
   * Array form (never a shell string) so the URL is not re-parsed by a shell.
   *
   * Return `null` when the command exists but cannot be driven
   * non-interactively for the installed version (e.g. Opencode 1.x, whose
   * `mcp add` is a TUI wizard). Callers then write the config file directly.
   */
  addArgs?: (mcpUrl: string, scope: "global" | "project") => string[] | null;
  /** Build the argv for the client's sign-in command, run after `add`. */
  loginArgs?: () => string[];
  /** Build the argv for the client's sign-out command, if it has one. */
  logoutArgs?: () => string[];
  /**
   * The entry to write when OAuth mode is selected. Must NOT contain an
   * `X-API-Key`/`Authorization` header — a configured key takes precedence over
   * OAuth server-side.
   */
  buildEntry?: (mcpUrl: string) => Record<string, unknown>;
  /** Executable to look for on PATH before attempting `addArgs`/`loginArgs`. */
  binary?: string;
  /**
   * Extra properties merged into the written config entry, for clients that
   * need an explicit confirm (e.g. Crush requires `"oauth": true`).
   */
  entryExtras?: Record<string, unknown>;
}

export interface ClientConfig {
  id: string;
  name: string;
  description?: string;
  format: "json" | "toml" | "cli" | "ui";
  /**
   * Path to the section that holds server entries. A plain string targets a
   * top-level key (`"mcpServers"`); an array walks nested objects
   * (`["mcp"]` for Opencode 1.x, `["mcp", "servers"]` for 2.x).
   *
   * A function is allowed for clients whose layout depends on which client
   * version is in use. It receives the layout the user chose for this run (or
   * `undefined` when the client has no such choice), so the answer can differ
   * between runs without any global state.
   */
  configKey?: string | string[] | ((layout?: string) => string | string[]);
  serverName?: string;
  projectPaths?: string[];
  globalPaths?: string[];
  /**
   * Files from older client versions that are still *read* for migration but
   * never written, resolved in the **global** root.
   *
   * Opencode uses this for `opencode.json`: both 1.x and 2.x disagree on
   * precedence with `opencode.jsonc`, so writing it can produce a config the
   * running binary ignores.
   */
  legacyPaths?: string[];
  /** Same as `legacyPaths`, resolved in the project root (never across scopes). */
  legacyProjectPaths?: string[];
  /**
   * Build the server entry. `layout` is the client-specific layout chosen for
   * this run, for clients whose schema differs by version (Opencode).
   */
  buildEntry?: (
    apiKey: string | undefined,
    mcpUrl: string,
    layout?: string
  ) => Record<string, unknown>;
  buildCommand?: (apiKey: string | undefined, mcpUrl: string) => string;
  detectPaths?: string[];
  instructions?: string;
  /**
   * OAuth 2.1 support for this client. Present only on clients known to speak
   * OAuth; everything else is API-key only.
   */
  oauth?: OAuthCapability;
  /**
   * The client can perform the OAuth handshake itself (e.g. Opencode), so the
   * CLI may skip its own browser login and only register the server URL.
   *
   * Kept as a derived convenience flag for backwards compatibility; prefer
   * `oauth.mode`.
   */
  supportsNativeOAuth?: boolean;
  /**
   * Force the Global/Project prompt even when only global paths exist. Needed
   * when the client's own CLI distinguishes project scope from `--global`.
   */
  requiresScopeChoice?: boolean;
}

export interface DetectedClient extends ClientConfig {
  detected: boolean;
  configured: boolean;
  configPath?: string;
  /**
   * Set when the client has a server entry, but under the config layout the
   * currently-installed version does not read (Opencode only). The entry
   * exists yet is invisible, so setup must ask which version is in use.
   */
  staleLayout?: string;
}

/** True when the client can hand the OAuth handshake to its own CLI. */
export function hasNativeOAuth(client: ClientConfig): boolean {
  return client.oauth?.mode === "native" && client.supportsNativeOAuth === true;
}

/** True when the client has any OAuth support at all (native or config-only). */
export function hasOAuth(client: ClientConfig): boolean {
  return client.oauth !== undefined && client.oauth.mode !== "unsupported";
}

/**
 * Resolve a client's config key, calling it when it is dynamic.
 *
 * Opencode's key depends on which version the user is running (1.x nests
 * servers under `mcp`, 2.x under `mcp.servers`), so `configKey` may be a
 * function. Callers must go through this helper rather than reading
 * `.configKey` directly. Pass the layout chosen for this run when there is one.
 */
export function resolveClientConfigKey(
  client: ClientConfig,
  layout?: string
): string | string[] {
  const key = client.configKey ?? "mcpServers";
  return typeof key === "function" ? key(layout) : key;
}

/**
 * Build a client's server entry for the layout chosen this run.
 *
 * Thin wrapper so callers never have to remember the `layout` argument; it is
 * simply forwarded, and ignored by every client that has no such choice.
 */
export function buildClientEntry(
  client: ClientConfig,
  apiKey: string | undefined,
  mcpUrl: string,
  layout?: string
): Record<string, unknown> {
  if (!client.buildEntry) {
    throw new Error(`Client ${client.id} has no buildEntry`);
  }
  return client.buildEntry(apiKey, mcpUrl, layout);
}
