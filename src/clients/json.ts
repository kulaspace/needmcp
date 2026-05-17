import { join } from "node:path";
import { homedir } from "node:os";
import type { ClientConfig } from "./types.js";

const home = homedir();

function claudeDesktopPath(): string {
  switch (process.platform) {
    case "win32":
      return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function zedSettingsPath(): string[] {
  switch (process.platform) {
    case "win32":
      return [join(process.env.APPDATA || join(home, "AppData", "Roaming"), "Zed", "settings.json")];
    case "darwin":
      return [join(home, "Library", "Application Support", "Zed", "settings.json")];
    default:
      return [
        join(home, ".config", "zed", "settings.json"),
        join(home, ".zed", "settings.json"),
      ];
  }
}

export const JSON_CLIENTS: ClientConfig[] = [
  {
    id: "cursor",
    name: "Cursor",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".cursor", "mcp.json")],
    projectPaths: [join(".cursor", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [claudeDesktopPath()],
    buildEntry: (apiKey, mcpUrl) => ({
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "windsurf",
    name: "Windsurf",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".codeium", "windsurf", "mcp_config.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      serverUrl: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "zed",
    name: "Zed",
    description: "Config key: context_servers, server name: NeedMCP",
    format: "json",
    configKey: "context_servers",
    serverName: "NeedMCP",
    globalPaths: zedSettingsPath(),
    buildEntry: (apiKey, mcpUrl) => ({
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".gemini", "settings.json")],
    projectPaths: [join(".gemini", "settings.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      httpUrl: mcpUrl,
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json, text/event-stream",
      },
    }),
  },
  {
    id: "opencode",
    name: "Opencode",
    format: "json",
    configKey: "mcp",
    globalPaths: [
      join(home, ".config", "opencode", "opencode.json"),
      join(home, ".config", "opencode", "opencode.jsonc"),
    ],
    projectPaths: [
      "opencode.json",
      "opencode.jsonc",
      ".opencode.json",
      ".opencode.jsonc",
    ],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "remote",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
      enabled: true,
    }),
  },
  {
    id: "copilot-cli",
    name: "GitHub Copilot CLI",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".copilot", "mcp-config.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "http",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "vscode",
    name: "VS Code",
    format: "json",
    configKey: "servers",
    projectPaths: [join(".vscode", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "http",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    format: "json",
    configKey: "mcpServers",
    projectPaths: [join(".kilocode", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "streamable-http",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
      alwaysAllow: [],
      disabled: false,
    }),
  },
  {
    id: "visual-studio",
    name: "Visual Studio 2022",
    format: "json",
    configKey: "servers",
    projectPaths: [join(".vs", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "http",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
  {
    id: "crush",
    name: "Crush",
    format: "json",
    configKey: "mcp",
    projectPaths: ["crush.json"],
    buildEntry: (apiKey, mcpUrl) => ({
      type: "http",
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
];
