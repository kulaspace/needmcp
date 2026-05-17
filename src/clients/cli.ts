import type { ClientConfig } from "./types.js";

export const CLI_CLIENTS: ClientConfig[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `claude mcp add --scope user needmcp -- npx -y @modelcontextprotocol/server-streamable-http ${mcpUrl} --header "X-API-Key: ${apiKey}"`,
    detectPaths: ["claude"],
  },
  {
    id: "amp",
    name: "Amp",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `amp mcp add needmcp ${mcpUrl} --header "X-API-Key: ${apiKey}"`,
    detectPaths: ["amp"],
  },
  {
    id: "factory",
    name: "Factory (droid)",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `droid mcp add needmcp ${mcpUrl} --type http --header "X-API-Key: ${apiKey}"`,
    detectPaths: ["droid"],
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) =>
      `qwen mcp add --transport http needmcp ${mcpUrl} --header "X-API-Key: ${apiKey}"`,
    detectPaths: ["qwen"],
  },
];
