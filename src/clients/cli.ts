import type { ClientConfig } from "./types.js";

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export const CLI_CLIENTS: ClientConfig[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) => {
      let cmd = `claude mcp add --transport http --scope user needmcp ${escapeShellArg(mcpUrl)}`;
      if (apiKey) cmd += ` --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`;
      return cmd;
    },
    detectPaths: ["claude"],
  },
  {
    id: "amp",
    name: "Amp",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) => {
      let cmd = `amp mcp add needmcp ${escapeShellArg(mcpUrl)}`;
      if (apiKey) cmd += ` --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`;
      return cmd;
    },
    detectPaths: ["amp"],
  },
  {
    id: "factory",
    name: "Factory (droid)",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) => {
      let cmd = `droid mcp add needmcp ${escapeShellArg(mcpUrl)} --type http`;
      if (apiKey) cmd += ` --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`;
      return cmd;
    },
    detectPaths: ["droid"],
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    format: "cli",
    buildCommand: (apiKey, mcpUrl) => {
      let cmd = `qwen mcp add --transport http needmcp ${escapeShellArg(mcpUrl)}`;
      if (apiKey) cmd += ` --header ${escapeShellArg(`X-API-Key: ${apiKey}`)}`;
      return cmd;
    },
    detectPaths: ["qwen"],
  },
];
