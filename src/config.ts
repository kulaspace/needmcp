import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface NeedMcpConfig {
  apiKey?: string;
  mcpUrl?: string;
}

const CONFIG_DIR = join(homedir(), ".needmcp");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<NeedMcpConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveConfig(config: NeedMcpConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function resolveMcpUrl(config: NeedMcpConfig): string {
  return process.env.NEEDMCP_MCP_URL || config.mcpUrl || "https://needmcp.com/mcp";
}
