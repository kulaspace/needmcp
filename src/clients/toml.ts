import { join } from "node:path";
import { homedir } from "node:os";
import type { ClientConfig } from "./types.js";

const home = homedir();

export const TOML_CLIENTS: ClientConfig[] = [
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    format: "toml",
    globalPaths: [join(home, ".codex", "config.toml")],
    projectPaths: [join(".codex", "config.toml")],
    buildEntry: (apiKey, mcpUrl) => ({
      url: mcpUrl,
      headers: { "X-API-Key": apiKey },
    }),
  },
];
