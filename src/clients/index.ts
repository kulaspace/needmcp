import { access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { readJsonConfig, getSection } from "../mcp-writer.js";
import type { ClientConfig, DetectedClient } from "./types.js";
import { resolveClientConfigKey } from "./types.js";
import { opencodeConfigKey } from "./opencode-layout.js";
import { JSON_CLIENTS } from "./json.js";
import { CLI_CLIENTS } from "./cli.js";
import { TOML_CLIENTS } from "./toml.js";
import { uiClients } from "./ui.js";

export type { ClientConfig, DetectedClient } from "./types.js";

/**
 * Every known client, built per call.
 *
 * A function rather than a constant because a few clients embed the resolved
 * MCP URL in their instruction text, and `process.env` is only complete after
 * `.env` loading.
 */
export function allClients(): ClientConfig[] {
  return [...JSON_CLIENTS, ...TOML_CLIENTS, ...CLI_CLIENTS, ...uiClients()];
}

const home = homedir();

export function resolvePath(p: string): string {
  return p.startsWith("~") ? join(home, p.slice(1)) : p;
}

export function resolveClientPaths(client: ClientConfig, scope?: "global" | "project"): string[] {
  if (scope === "global") {
    return [...(client.globalPaths ?? [])];
  }
  if (scope === "project") {
    return [...((client.projectPaths ?? []).map((p) => join(process.cwd(), p)))];
  }
  return [
    ...(client.globalPaths ?? []),
    ...((client.projectPaths ?? []).map((p) => join(process.cwd(), p))),
  ];
}

async function checkJsonClient(client: ClientConfig, scope?: "global" | "project"): Promise<DetectedClient> {
  const paths = resolveClientPaths(client, scope);

  for (const p of paths) {
    const resolved = resolvePath(p);
    try {
      await access(resolved);
      const config = await readJsonConfig(resolved);
      const name = client.serverName ?? "needmcp";

      // Opencode has two incompatible layouts. A server sitting only under the
      // OTHER one is not "configured": the running binary will not see it. It is
      // reported as stale so setup asks which version the user runs instead of
      // claiming everything is fine.
      if (client.id === "opencode") {
        const v1Has = !!getSection(config, opencodeConfigKey("v1"))?.[name];
        const v2Has = !!getSection(config, opencodeConfigKey("v2"))?.[name];
        return {
          ...client,
          detected: true,
          configured: v1Has || v2Has,
          configPath: resolved,
          ...(v1Has !== v2Has ? { staleLayout: v1Has ? "v1" : "v2" } : {}),
        };
      }

      const key = resolveClientConfigKey(client);
      const section = getSection(config, key);
      const configured = !!(section && name in section);
      return { ...client, detected: true, configured, configPath: resolved };
    } catch {}
  }

  // A client that has only the legacy file is still "detected": setup will
  // migrate it into the new path on write. Checked per scope, never across.
  const legacyCandidates =
    scope === "project"
      ? (client.legacyProjectPaths ?? []).map((p) => join(process.cwd(), p))
      : (client.legacyPaths ?? []).map((p) => resolvePath(p));

  for (const resolved of legacyCandidates) {
    try {
      await access(resolved);
      return { ...client, detected: true, configured: false, configPath: resolved };
    } catch {}
  }

  return { ...client, detected: false, configured: false };
}

async function checkTomlClient(client: ClientConfig, scope?: "global" | "project"): Promise<DetectedClient> {
  const paths = resolveClientPaths(client, scope);

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
      const cmd = process.platform === "win32" ? "where" : "which";
      execFileSync(cmd, [tool], { stdio: "ignore" });
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
  return Promise.all(allClients().map((client) => detectClient(client, scope)));
}
