export interface ClientConfig {
  id: string;
  name: string;
  description?: string;
  format: "json" | "toml" | "cli" | "ui";
  configKey?: string;
  serverName?: string;
  projectPaths?: string[];
  globalPaths?: string[];
  buildEntry?: (apiKey: string | undefined, mcpUrl: string) => Record<string, unknown>;
  buildCommand?: (apiKey: string | undefined, mcpUrl: string) => string;
  detectPaths?: string[];
  instructions?: string;
}

export interface DetectedClient extends ClientConfig {
  detected: boolean;
  configured: boolean;
  configPath?: string;
}
