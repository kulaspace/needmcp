import { access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { readJsonConfig, getSection } from "../mcp-writer.js";
import type { ClientConfig, DetectedClient } from "./types.js";
import { resolveClientConfigKey } from "./types.js";
import { JSON_CLIENTS } from "./json.js";
import { CLI_CLIENTS } from "./cli.js";
import { TOML_CLIENTS } from "./toml.js";
import { uiClients } from "./ui.js";

export type { ClientConfig, DetectedClient } from "./types.js";

const execFileAsync = promisify(execFileCb);

function isWindows(): boolean {
  return process.platform === "win32";
}

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

  // No config file yet. A JSON client may still be installed — its binary is on
  // PATH — and that is what puts it near the top of the list instead of among
  // the `not found` entries. `detectPaths` used to be honoured only for
  // `format: "cli"`, so a freshly installed client with no config file read as
  // absent and was effectively invisible in the picker.
  if (await anyBinaryExists(client.detectPaths)) {
    return { ...client, detected: true, configured: false };
  }

  return { ...client, detected: false, configured: false };
}

/** True when any of `bins` resolves on PATH. Probed in parallel. */
async function anyBinaryExists(bins: string[] | undefined): Promise<boolean> {
  if (!bins || bins.length === 0) return false;
  const results = await Promise.all(
    bins.map(async (bin) => {
      try {
        await execFileAsync(isWindows() ? "where" : "which", [bin]);
        return true;
      } catch {
        return false;
      }
    })
  );
  return results.some(Boolean);
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
  // `where` costs ~300ms on Windows and this used to run one at a time, sync,
  // freezing the UI for the whole sweep. Async + parallel keeps setup responsive
  // and makes the sweep cost one lookup instead of one per tool.
  const results = await Promise.all(
    tools.map(async (tool) => {
      try {
        await execFileAsync(isWindows() ? "where" : "which", [tool]);
        return true;
      } catch {
        return false;
      }
    })
  );

  if (results.some(Boolean)) return { ...client, detected: true, configured: false };
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
