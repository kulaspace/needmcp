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
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [claudeDesktopPath()],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "windsurf",
    name: "Windsurf",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".codeium", "windsurf", "mcp_config.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { serverUrl: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "zed",
    name: "Zed",
    description: "Config key: context_servers, server name: NeedMCP",
    format: "json",
    configKey: "context_servers",
    serverName: "NeedMCP",
    globalPaths: zedSettingsPath(),
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".gemini", "settings.json")],
    projectPaths: [join(".gemini", "settings.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { httpUrl: mcpUrl };
      if (apiKey) e.headers = {
        "X-API-Key": apiKey,
        Accept: "application/json, text/event-stream",
      };
      return e;
    },
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
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "remote", url: mcpUrl, enabled: true };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "copilot-cli",
    name: "GitHub Copilot CLI",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".copilot", "mcp-config.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "http", url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "vscode",
    name: "VS Code",
    format: "json",
    configKey: "servers",
    projectPaths: [join(".vscode", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "http", url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "kiro",
    name: "Kiro",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".kiro", "settings", "mcp.json")],
    projectPaths: [join(".kiro", "settings", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    format: "json",
    configKey: "mcpServers",
    projectPaths: [join(".kilocode", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "streamable-http", url: mcpUrl, alwaysAllow: [], disabled: false };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "visual-studio",
    name: "Visual Studio 2022",
    format: "json",
    configKey: "servers",
    projectPaths: [join(".vs", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "http", url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "crush",
    name: "Crush",
    format: "json",
    configKey: "mcp",
    projectPaths: ["crush.json"],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { type: "http", url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "google-antigravity",
    name: "Google Antigravity",
    format: "json",
    configKey: "mcpServers",
    globalPaths: [join(home, ".gemini", "antigravity", "mcp_config.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { serverUrl: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
  {
    id: "trae",
    name: "Trae",
    format: "json",
    configKey: "mcpServers",
    projectPaths: [join(".trae", "mcp.json")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.headers = { "X-API-Key": apiKey };
      return e;
    },
  },
];
