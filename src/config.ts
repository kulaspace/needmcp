import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_MCP_URL } from "./constants.js";
import { atomicWrite } from "./mcp-writer.js";

export interface NeedMcpConfig {
  apiKey?: string;
  mcpUrl?: string;
}

const CONFIG_DIR = join(homedir(), ".needmcp");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<NeedMcpConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    try {
      return JSON.parse(raw);
    } catch {
      console.warn(`Warning: Invalid JSON in ${CONFIG_PATH}, treating as empty`);
      return {};
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    return {};
  }
}

export async function saveConfig(config: NeedMcpConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await atomicWrite(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function resolveMcpUrl(config: NeedMcpConfig): string {
  return process.env.NEEDMCP_MCP_URL || config.mcpUrl || DEFAULT_MCP_URL;
}
