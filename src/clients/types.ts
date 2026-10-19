export interface ClientConfig {
  id: string;
  name: string;
  description?: string;
  format: "json" | "toml" | "cli" | "ui";
  /**
   * Path to the section that holds server entries. A plain string targets a
   * top-level key (`"mcpServers"`); an array walks nested objects
   * (`["mcp", "servers"]` for Opencode v2).
   */
  configKey?: string | string[];
  serverName?: string;
  projectPaths?: string[];
  globalPaths?: string[];
  buildEntry?: (apiKey: string | undefined, mcpUrl: string) => Record<string, unknown>;
  buildCommand?: (apiKey: string | undefined, mcpUrl: string) => string;
  detectPaths?: string[];
  instructions?: string;
  /**
   * The client can perform the OAuth handshake itself (e.g. Opencode), so the
   * CLI may skip its own browser login and only register the server URL.
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
}
