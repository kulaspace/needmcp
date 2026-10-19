import { join } from "node:path";
import { homedir } from "node:os";
import type { ClientConfig } from "./types.js";
import { buildCodexAddArgs, buildCodexLoginArgs } from "./oauth-clients.js";

const home = homedir();

export const TOML_CLIENTS: ClientConfig[] = [
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    format: "toml",
    globalPaths: [join(home, ".codex", "config.toml")],
    projectPaths: [join(".codex", "config.toml")],
    buildEntry: (apiKey, mcpUrl) => {
      const e: Record<string, unknown> = { url: mcpUrl };
      if (apiKey) e.http_headers = { "X-API-Key": apiKey };
      return e;
    },
    // Codex needs an explicit second command: `codex mcp login <name>`.
    // The stored entry must stay header-free so the token is used instead.
    oauth: {
      mode: "native",
      binary: "codex",
      addArgs: (mcpUrl, scope) => buildCodexAddArgs({ mcpUrl, scope }),
      loginArgs: buildCodexLoginArgs,
      buildEntry: (mcpUrl) => ({ url: mcpUrl }),
    },
  },
];
