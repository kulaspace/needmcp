import { intro, outro, cancel, isCancel, text, select, confirm } from "@clack/prompts";
import pc from "picocolors";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { readJsonConfig, writeJsonConfig, mergeServerEntry, appendTomlServer, removeServerEntry, removeTomlServer } from "./mcp-writer.js";
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

function maskKey(k: string): string {
  if (k.length <= 8) return "****";
  return k.slice(0, 3) + "..." + k.slice(-4);
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
    const use = await confirm({
      message: `Use stored API key ${pc.cyan(maskKey(config.apiKey))}?`,
    });
    if (isCancel(use)) {
      cancel("Setup cancelled");
      process.exit(1);
    }
    if (use) return config.apiKey;
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

export async function runSetup(providedKey?: string): Promise<void> {
  intro(pc.bgCyan(pc.black(" needmcp setup ")));

  const apiKey = await ensureApiKey(providedKey);

  const config = await loadConfig();
  const mcpUrl = resolveMcpUrl(config);

  const detected = await detectAllClients();

  const sortWeight = (dc: DetectedClient): number => dc.configured ? 0 : dc.detected ? 1 : 2;
  detected.sort((a, b) => sortWeight(a) - sortWeight(b));

  const options = detected.map((dc) => ({
    value: dc.id,
    label: `${statusIcon(dc)} ${dc.name}`,
    hint: statusText(dc),
  }));

  const selected = await select({
    message: "Select a client to setup:",
    options,
  });

  if (isCancel(selected) || !selected) {
    cancel("No client selected");
    process.exit(1);
  }

  const clientId = selected as string;

  const scope = await select({
    message: "Config scope:",
    options: [
      { value: "global", label: "Global", hint: "Install system-wide" },
      { value: "project", label: "Project", hint: "Install for current project only" },
    ],
  });

  if (isCancel(scope)) {
    cancel("Setup cancelled");
    process.exit(1);
  }

  outro(`Setting up ${pc.cyan(clientId)} (${scope as string})...\n`);

  const results: SetupResult[] = [];

  const client = ALL_CLIENTS.find((c) => c.id === clientId);
  if (client) {
    const label = `  ${client.name}...`;
    process.stdout.write(label);

    try {
      const result = await setupClient(client, apiKey, mcpUrl, scope as "global" | "project");
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

async function removeJsonClient(
  client: ClientConfig,
  scope?: "global" | "project"
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  for (const p of paths) {
    const resolved = resolvePath(p);
    try {
      const existing = await readJsonConfig(resolved);
      const key = client.configKey ?? "mcpServers";
      const name = client.serverName ?? "needmcp";
      const { config, removed } = removeServerEntry(existing, key, name);

      if (removed) {
        await writeJsonConfig(resolved, config);
        return { clientId: client.id, clientName: client.name, success: true, message: "Removed" };
      }
    } catch {}
  }

  return { clientId: client.id, clientName: client.name, success: false, message: "Config not found or already removed" };
}

async function removeTomlClientEntry(
  client: ClientConfig,
  scope?: "global" | "project"
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  for (const p of paths) {
    const resolved = resolvePath(p);
    try {
      const { removed } = await removeTomlServer(resolved, "needmcp");
      if (removed) {
        return { clientId: client.id, clientName: client.name, success: true, message: "Removed" };
      }
    } catch {}
  }

  return { clientId: client.id, clientName: client.name, success: false, message: "Config not found or already removed" };
}

async function removeClient(
  client: ClientConfig,
  scope?: "global" | "project"
): Promise<SetupResult> {
  switch (client.format) {
    case "json":
      return removeJsonClient(client, scope);
    case "toml":
      return removeTomlClientEntry(client, scope);
    default:
      const instructions = client.instructions
        ? `\n${client.instructions.split("\n").map((l) => `    ${pc.dim(l)}`).join("\n")}`
        : "";
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        message: `Manual removal required${instructions}`,
      };
  }
}

export async function runUninstall(): Promise<void> {
  intro(pc.bgRed(pc.black(" needmcp remove ")));

  const detected = await detectAllClients();

  const eligible = detected.filter((dc) => dc.configured || dc.detected);

  if (eligible.length === 0) {
    cancel("No configured or detected clients found");
    process.exit(1);
  }

  const sortWeight = (dc: DetectedClient): number => dc.configured ? 0 : 1;
  eligible.sort((a, b) => sortWeight(a) - sortWeight(b));

  const options = eligible.map((dc) => ({
    value: dc.id,
    label: `${statusIcon(dc)} ${dc.name}`,
    hint: statusText(dc),
  }));

  const selected = await select({
    message: "Select a client to remove NeedMCP from:",
    options,
  });

  if (isCancel(selected) || !selected) {
    cancel("No client selected");
    process.exit(1);
  }

  const clientId = selected as string;

  const scope = await select({
    message: "Config scope:",
    options: [
      { value: "global", label: "Global", hint: "Remove from system-wide config" },
      { value: "project", label: "Project", hint: "Remove from current project only" },
    ],
  });

  if (isCancel(scope)) {
    cancel("Remove cancelled");
    process.exit(1);
  }

  outro(`Removing from ${pc.cyan(clientId)} (${scope as string})...\n`);

  const results: SetupResult[] = [];

  const client = ALL_CLIENTS.find((c) => c.id === clientId);
  if (client) {
    process.stdout.write(`  ${client.name}...`);

    try {
      const result = await removeClient(client, scope as "global" | "project");
      results.push(result);

      if (result.success) {
        process.stdout.write(` ${pc.green("✔")} ${result.message}\n`);
      } else {
        process.stdout.write(` ${pc.red("✖")} ${result.message}\n`);
      }
    } catch (err) {
      process.stdout.write(` ${pc.red("✖")} ${err instanceof Error ? err.message : String(err)}\n`);
      results.push({ clientId: client.id, clientName: client.name, success: false, message: "Unexpected error" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  outro(
    `${pc.green(`✔ ${successCount} client(s) removed`)}${failCount > 0 ? ` ${pc.yellow(`⚠ ${failCount} failed`)}` : ""}`
  );
}
