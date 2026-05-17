import { intro, outro, cancel, isCancel, text, multiselect } from "@clack/prompts";
import pc from "picocolors";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { readJsonConfig, writeJsonConfig, mergeServerEntry, appendTomlServer } from "./mcp-writer.js";
import { loadConfig, saveConfig, resolveMcpUrl } from "./config.js";
import { ALL_CLIENTS, detectAllClients, resolvePath } from "./clients/index.js";
import type { ClientConfig, DetectedClient } from "./clients/index.js";

function statusIcon(dc: DetectedClient): string {
  if (dc.configured) return pc.green("●");
  if (dc.detected) return pc.yellow("▲");
  return pc.dim("○");
}

function statusText(dc: DetectedClient): string {
  if (dc.configured) return pc.green("configured");
  if (dc.detected) return pc.yellow("detected");
  return pc.dim("not found");
}

async function ensureApiKey(providedKey?: string): Promise<string> {
  const config = await loadConfig();

  if (providedKey) {
    if (providedKey !== config.apiKey) {
      await saveConfig({ ...config, apiKey: providedKey });
    }
    return providedKey;
  }

  if (config.apiKey) {
    return config.apiKey;
  }

  const key = await text({
    message: "Enter your NeedMCP API key:",
    validate: (v) => {
      if (!v) return "API key is required";
      if (v.length < 10) return "API key seems too short";
    },
  });

  if (isCancel(key)) {
    cancel("Setup cancelled");
    process.exit(1);
  }

  await saveConfig({ ...config, apiKey: key as string });
  return key as string;
}

interface SetupResult {
  clientId: string;
  clientName: string;
  success: boolean;
  message: string;
}

function resolveClientPaths(client: ClientConfig, scope?: "global" | "project"): string[] {
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

async function setupJsonClient(
  client: ClientConfig,
  apiKey: string,
  mcpUrl: string,
  scope?: "global" | "project"
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  const resolved = resolvePath(paths[0]);

  const existing = await readJsonConfig(resolved);
  const entry = client.buildEntry!(apiKey, mcpUrl);
  const key = client.configKey ?? "mcpServers";
  const name = client.serverName ?? "needmcp";

  const { config, alreadyExists } = mergeServerEntry(existing, key, name, entry);
  await writeJsonConfig(resolved, config);

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: alreadyExists ? "Updated" : "Created",
  };
}

async function setupTomlClient(
  client: ClientConfig,
  apiKey: string,
  mcpUrl: string,
  scope?: "global" | "project"
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  const resolved = resolvePath(paths[0]);

  const entry = client.buildEntry!(apiKey, mcpUrl);
  const { alreadyExists } = await appendTomlServer(resolved, "needmcp", entry);

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: alreadyExists ? "Updated" : "Created",
  };
}

async function setupCliClient(
  client: ClientConfig,
  apiKey: string,
  mcpUrl: string
): Promise<SetupResult> {
  const cmd = client.buildCommand!(apiKey, mcpUrl);

  process.stdout.write(`\n    Running: ${pc.dim(cmd)}\n\n`);
  try {
    execSync(cmd, {
      stdio: "inherit",
      timeout: 120000,
    });
    process.stdout.write("\n");
    return { clientId: client.id, clientName: client.name, success: true, message: "CLI command succeeded" };
  } catch (err) {
    process.stdout.write("\n");
    const msg = err instanceof Error ? err.message : String(err);
    return { clientId: client.id, clientName: client.name, success: false, message: msg.slice(0, 200) };
  }
}

async function setupClient(
  client: ClientConfig,
  apiKey: string,
  mcpUrl: string,
  scope?: "global" | "project"
): Promise<SetupResult> {
  switch (client.format) {
    case "json":
      return setupJsonClient(client, apiKey, mcpUrl, scope);
    case "toml":
      return setupTomlClient(client, apiKey, mcpUrl, scope);
    case "cli":
      return setupCliClient(client, apiKey, mcpUrl);
    default:
      return { clientId: client.id, clientName: client.name, success: false, message: "Manual setup required" };
  }
}

export async function runSetup(providedKey?: string, scope?: "global" | "project"): Promise<void> {
  intro(pc.bgCyan(pc.black(" needmcp setup ")));

  const apiKey = await ensureApiKey(providedKey);
  const config = await loadConfig();
  const mcpUrl = resolveMcpUrl(config);

  const detected = await detectAllClients(scope);

  const options = detected.map((dc) => ({
    value: dc.id,
    label: `${statusIcon(dc)} ${dc.name}`,
    hint: statusText(dc),
  }));

  const selected = await multiselect({
    message: "Select clients to setup:",
    options,
    required: false,
  });

  if (isCancel(selected) || !selected || (selected as string[]).length === 0) {
    cancel("No clients selected");
    process.exit(1);
  }

  outro("Setting up NeedMCP MCP server...\n");

  const results: SetupResult[] = [];

  for (const id of selected as string[]) {
    const client = ALL_CLIENTS.find((c) => c.id === id);
    if (!client) continue;

    const label = `  ${client.name}...`;
    process.stdout.write(label);

    try {
      const result = await setupClient(client, apiKey, mcpUrl, scope);
      results.push(result);

      if (result.success) {
        process.stdout.write(` ${pc.green("✔")} ${result.message}\n`);
      } else {
        if (client.format === "ui") {
          process.stdout.write(` ${pc.dim("→")} Manual setup:\n`);
          for (const line of (client.instructions ?? "").split("\n")) {
            process.stdout.write(`    ${pc.dim(line)}\n`);
          }
        } else {
          process.stdout.write(` ${pc.red("✖")} ${result.message}\n`);
        }
      }
    } catch (err) {
      process.stdout.write(` ${pc.red("✖")} ${err instanceof Error ? err.message : String(err)}\n`);
      results.push({
        clientId: client.id,
        clientName: client.name,
        success: false,
        message: "Unexpected error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  outro(
    `${pc.green(`✔ ${successCount} client(s) configured`)}${failCount > 0 ? ` ${pc.yellow(`⚠ ${failCount} failed`)}` : ""}`
  );
}
