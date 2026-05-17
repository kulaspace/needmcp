import { access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { readJsonConfig } from "../mcp-writer.js";
import type { ClientConfig, DetectedClient } from "./types.js";
import { JSON_CLIENTS } from "./json.js";
import { CLI_CLIENTS } from "./cli.js";
import { TOML_CLIENTS } from "./toml.js";
import { UI_CLIENTS } from "./ui.js";

export type { ClientConfig, DetectedClient } from "./types.js";

export const ALL_CLIENTS: ClientConfig[] = [
  ...JSON_CLIENTS,
  ...TOML_CLIENTS,
  ...CLI_CLIENTS,
  ...UI_CLIENTS,
];

const home = homedir();

export function resolvePath(p: string): string {
  return p.startsWith("~") ? join(home, p.slice(1)) : p;
}

async function checkJsonClient(client: ClientConfig, scope?: "global" | "project"): Promise<DetectedClient> {
  let paths: string[];
  if (scope === "global") {
    paths = [...(client.globalPaths ?? [])];
  } else if (scope === "project") {
    paths = [...((client.projectPaths ?? []).map((p) => join(process.cwd(), p)))];
  } else {
    paths = [
      ...(client.globalPaths ?? []),
      ...((client.projectPaths ?? []).map((p) => join(process.cwd(), p))),
    ];
  }

  for (const p of paths) {
    const resolved = resolvePath(p);
    try {
      await access(resolved);
      const config = await readJsonConfig(resolved);
      const key = client.configKey ?? "mcpServers";
      const name = client.serverName ?? "needmcp";
      const section = config[key] as Record<string, unknown> | undefined;
      const configured = !!(section && name in section);
      return { ...client, detected: true, configured, configPath: resolved };
    } catch {}
  }

  return { ...client, detected: false, configured: false };
}

async function checkTomlClient(client: ClientConfig, scope?: "global" | "project"): Promise<DetectedClient> {
  let paths: string[];
  if (scope === "global") {
    paths = [...(client.globalPaths ?? [])];
  } else if (scope === "project") {
    paths = [...((client.projectPaths ?? []).map((p) => join(process.cwd(), p)))];
  } else {
    paths = [
      ...(client.globalPaths ?? []),
      ...((client.projectPaths ?? []).map((p) => join(process.cwd(), p))),
    ];
  }

  for (const p of paths) {
    const resolved = resolvePath(p);
    try {
      await access(resolved);
      return { ...client, detected: true, configured: false, configPath: resolved };
    } catch {}
  }

  return { ...client, detected: false, configured: false };
}

async function checkCliClient(client: ClientConfig): Promise<DetectedClient> {
  const tools = client.detectPaths ?? [];
  for (const tool of tools) {
    try {
      const cmd = process.platform === "win32" ? `where ${tool}` : `which ${tool}`;
      execSync(cmd, { stdio: "ignore" });
      return { ...client, detected: true, configured: false };
    } catch {}
  }
  return { ...client, detected: false, configured: false };
}

export async function detectClient(client: ClientConfig, scope?: "global" | "project"): Promise<DetectedClient> {
  switch (client.format) {
    case "json":
      return checkJsonClient(client, scope);
    case "toml":
      return checkTomlClient(client, scope);
    case "cli":
      return checkCliClient(client);
    default:
      return { ...client, detected: false, configured: false };
  }
}

export async function detectAllClients(scope?: "global" | "project"): Promise<DetectedClient[]> {
  const results: DetectedClient[] = [];
  for (const client of ALL_CLIENTS) {
    results.push(await detectClient(client, scope));
  }
  return results;
}
