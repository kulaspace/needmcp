import { join } from "node:path";
import { homedir } from "node:os";
import type { ClientConfig } from "./types.js";
import { buildOpencodeAuthArgs } from "./opencode-cli.js";
import {
  buildGeminiAddArgs,
  buildKiloAddArgs,
  buildKiloAuthArgs,
  crushOAuthEntry,
  cursorOAuthEntry,
  geminiOAuthExtra,
  kiroOAuthEntry,
  vscodeOAuthEntry,
  zedOAuthEntry,
} from "./oauth-clients.js";

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
    // Cursor has no documented MCP CLI; the entry is written directly and
    // Cursor runs the browser flow when the server returns 401.
    oauth: { mode: "config-only", buildEntry: cursorOAuthEntry },
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
    // A configured header disables Zed's OAuth prompt, so the OAuth entry is
    // deliberately header-free.
    oauth: { mode: "config-only", buildEntry: zedOAuthEntry },
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
    // NeedMCP does not advertise RFC 9207 `iss` support, so the Gemini opt-out
    // must be written explicitly or every callback is rejected.
    oauth: {
      mode: "native",
      binary: "gemini",
      addArgs: (mcpUrl, scope) => buildGeminiAddArgs({ mcpUrl, scope }),
      buildEntry: (mcpUrl) => ({ httpUrl: mcpUrl, ...geminiOAuthExtra() }),
    },
  },
  {
    id: "opencode",
    name: "Opencode",
    description: "Writes the needmcp entry into opencode.jsonc",
    format: "json",
    // One single layout, written straight into `opencode.jsonc`:
    //
    //   { "mcp": { "needmcp": { type, url, enabled, headers? } } }
    //
    // This is the shape Opencode 1.x and 2.x both accept — `mcp.<name>` at the
    // top level of `mcp`, no `mcp.servers` wrapper. The entry is written by
    // editing the file in place (other keys such as `model`/`agents`/sibling
    // servers survive), never by replacing it.
    //
    // The only variable part is `headers`, which the auth choice decides:
    //   OAuth     → no headers, then `opencode mcp auth needmcp`
    //   API key   → headers: { "X-API-Key": ... }
    configKey: "mcp",
    globalPaths: [join(home, ".config", "opencode", "opencode.jsonc")],
    projectPaths: ["opencode.jsonc"],
    // Detected by its binary, like every other CLI client — without this the
    // entry only counted as "detected" once the config file existed, so a fresh
    // install showed up as `not found` and sank to the bottom of the list.
    //
    // The config file is the same either way, so there is no per-version
    // variant here: any installed Opencode name means "this client is present".
    detectPaths: ["opencode", "opencode2"],
    supportsNativeOAuth: true,
    requiresScopeChoice: true,
    buildEntry: (apiKey, mcpUrl) => {
      const entry: Record<string, unknown> = { type: "remote", url: mcpUrl, enabled: true };
      if (apiKey) entry.headers = { "X-API-Key": apiKey };
      return entry;
    },
    // The server is registered by writing the file, so there is no `mcp add`
    // step to run. Sign-in is always `opencode mcp auth needmcp`, run after the
    // file is written.
    oauth: {
      mode: "native",
      binary: "opencode",
      addArgs: () => null,
      loginArgs: buildOpencodeAuthArgs,
      buildEntry: (mcpUrl) => ({ type: "remote", url: mcpUrl, enabled: true }),
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
    // `.vscode/mcp.json` with `type: http` and no header makes VS Code run the
    // OAuth 2.1 flow in-editor.
    oauth: { mode: "config-only", buildEntry: vscodeOAuthEntry },
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
    oauth: { mode: "config-only", buildEntry: kiroOAuthEntry },
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
    oauth: {
      mode: "native",
      binary: "kilo",
      addArgs: (mcpUrl, scope) => buildKiloAddArgs({ mcpUrl, scope }),
      loginArgs: buildKiloAuthArgs,
      buildEntry: (mcpUrl) => ({
        type: "streamable-http",
        url: mcpUrl,
        alwaysAllow: [],
        disabled: false,
      }),
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
    // Crush requires an explicit opt-in flag per server.
    oauth: { mode: "config-only", buildEntry: crushOAuthEntry },
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
