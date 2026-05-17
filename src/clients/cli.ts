import type { ClientConfig } from "./types.js";

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export const CLI_CLIENTS: ClientConfig[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `claude mcp add --scope user needmcp -- npx -y @modelcontextprotocol/server-streamable-http ${escapeShellArg(mcpUrl)} --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`,
    detectPaths: ["claude"],
  },
  {
    id: "amp",
    name: "Amp",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `amp mcp add needmcp ${escapeShellArg(mcpUrl)} --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`,
    detectPaths: ["amp"],
  },
  {
    id: "factory",
    name: "Factory (droid)",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `droid mcp add needmcp ${escapeShellArg(mcpUrl)} --type http --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`,
    detectPaths: ["droid"],
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `qwen mcp add --transport http needmcp ${escapeShellArg(mcpUrl)} --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`,
    detectPaths: ["qwen"],
  },
];
