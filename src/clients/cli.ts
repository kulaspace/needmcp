import type { ClientConfig } from "./types.js";
import {
  buildAmpAddArgs,
  buildFactoryAddArgs,
  buildClaudeCodeAddArgs,
  buildQwenAddArgs,
} from "./oauth-clients.js";

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
    // Claude Code completes the OAuth flow itself from `/mcp`; the add command
    // is all this CLI needs to run.
    oauth: {
      mode: "native",
      binary: "claude",
      addArgs: (mcpUrl, scope) => buildClaudeCodeAddArgs({ mcpUrl, scope }),
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
    // Amp persists the OAuth token after the add and signs in on first use.
    oauth: {
      mode: "native",
      binary: "amp",
      addArgs: (mcpUrl, scope) => buildAmpAddArgs({ mcpUrl, scope }),
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
    // droid signs in through its own `/mcp` dialog.
    oauth: {
      mode: "native",
      binary: "droid",
      addArgs: (mcpUrl, scope) => buildFactoryAddArgs({ mcpUrl, scope }),
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
    // Qwen Code runs the browser flow on first connect (callback port 7777).
    oauth: {
      mode: "native",
      binary: "qwen",
      addArgs: (mcpUrl, scope) => buildQwenAddArgs({ mcpUrl, scope }),
    },
    detectPaths: ["qwen"],
  },
];
