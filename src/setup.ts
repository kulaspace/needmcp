import { intro, outro, cancel, isCancel, text, select, confirm } from "@clack/prompts";
import pc from "picocolors";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readJsonConfig, writeJsonConfig, mergeServerEntry, appendTomlServer, removeServerEntry, removeTomlServer, hasJsonComments, loadMigrationSource, cleanupStrayEntry, getSection, toKeyPath } from "./mcp-writer.js";
import { loadConfig, saveConfig, resolveMcpUrl, resolveBaseUrl } from "./config.js";
import { allClients, detectAllClients, resolvePath, resolveClientPaths } from "./clients/index.js";
import { resolveClientConfigKey } from "./clients/types.js";
import type { ClientConfig, DetectedClient } from "./clients/index.js";
import { commandExists, resolveOpencodeBinary, canScriptMcpAdd, buildOpencodeAddArgs } from "./clients/opencode-cli.js";
import {
  detectOpencodeLayouts,
  needsLayoutChoice,
  opencodeConfigKey,
  type DetectedOpencode,
  type OpencodeLayout,
} from "./clients/opencode-layout.js";
import { formatOAuthCommand } from "./clients/oauth-clients.js";
import { CliError } from "./errors.js";
import { validateApiKey } from "./validation.js";
import { loginWithOAuth } from "./oauth.js";
import { isUrlOverridden } from "./env.js";

export type AuthMode = "oauth" | "key";

/** How the NeedMCP entry gets authentication when the client supports OAuth. */
type AuthChoice = "native-oauth" | "api-key";

// Temporary kill-switch for guest mode. Set to `true` to re-enable the
// "Guest Mode" option in the authentication menu. When `false`, users must
// authenticate via OAuth or an API key.
const GUEST_MODE_ENABLED = false;

function getAvailableScopes(client: ClientConfig): ("global" | "project")[] {
  const scopes: ("global" | "project")[] = [];
  if (client.globalPaths?.length) scopes.push("global");
  if (client.projectPaths?.length || client.requiresScopeChoice) scopes.push("project");
  return scopes;
}

/**
 * True when the CLI can hand the OAuth sign-in to the client's own binary.
 * Clients whose OAuth support is config-only (Cursor, Zed, VS Code, Crush,
 * Kiro) return false and keep the API-key path.
 */
function canDriveNativeOAuth(client: ClientConfig): boolean {
  return client.oauth?.mode === "native" && client.oauth.binary !== undefined;
}

/**
 * Ask which Opencode the user runs, when it matters.
 *
 * Opencode 1.x and 2.x install as separate binaries and write config layouts
 * that each reject the other's, so exactly one must be chosen per run. Three
 * outcomes:
 *
 *  - client is not Opencode            → undefined, no prompt
 *  - only one version installed        → that version, no prompt
 *  - both installed, no TTY            → fail, naming the flag
 *  - both installed                    → the user chooses, EVERY time. Nothing
 *    is persisted, so switching binaries between runs needs no reset.
 *
 * `--opencode-layout` short-circuits the question for CI and for anyone who
 * does not want to be asked.
 */
async function promptOpencodeLayout(
  client: ClientConfig,
  override?: OpencodeLayout
): Promise<OpencodeLayout | undefined> {
  if (client.id !== "opencode") return undefined;

  const detected = detectOpencodeLayouts();
  if (detected.length === 0) return override ?? "v1";

  if (override) return override;

  if (!needsLayoutChoice(detected)) return detected[0].layout;

  // Two layouts, no one to ask. Guessing here is exactly how a user ends up
  // with a config their binary silently ignores — which looks like "needmcp is
  // broken" rather than "the wrong layout was written". Refuse instead.
  if (!process.stdin.isTTY) {
    throw new CliError(layoutChoiceRequiredMessage(detected));
  }

  const selected = await select({
    message: "Both OpenCode versions are installed. Which one do you use?",
    options: detected.map((d) => ({
      value: d.layout,
      label: `${d.binary} ${versionSuffix(d.version)}`,
      hint:
        d.layout === "v2"
          ? "writes mcp.servers.<name> to opencode.json"
          : "writes mcp.<name> to opencode.json",
    })),
  });

  if (isCancel(selected) || !selected) {
    cancel("Setup cancelled");
    throw new CliError("Setup cancelled");
  }

  // Say the shape out loud — picking the wrong one writes a config the running
  // binary silently ignores, which is the exact bug this prompt prevents.
  console.log(
    `  ${pc.dim("OpenCode layout:")} ${pc.cyan(selected)} ` +
      pc.dim(`(${opencodeConfigKey(selected).join(".")})`)
  );

  return selected;
}

/** `2.0.32` for "opencode v2.0.32", else the raw string, else "unknown". */
function versionSuffix(version: string | null): string {
  if (!version) return "(version unknown)";
  return version.match(/\d+\.\d+\.\d+/)?.[0] ?? version;
}

/**
 * The refusal shown when both versions are installed and nobody can be asked.
 *
 * Exported and kept separate from the prompt so the wording — which must name
 * the flag, since that is the only way out — is testable without a TTY.
 */
export function layoutChoiceRequiredMessage(detected: DetectedOpencode[]): string {
  const installed = detected
    .map((d) => `${d.binary} ${versionSuffix(d.version)} -> ${d.layout}`)
    .join(", ");
  return (
    `Both OpenCode versions are installed (${installed}) and they use ` +
    `incompatible config layouts.\n` +
    `  Pick one explicitly:  needmcp setup --opencode-layout v1|v2\n` +
    `    v1 writes mcp.<name>          (opencode 1.x)\n` +
    `    v2 writes mcp.servers.<name>  (opencode 2.x)`
  );
}

function statusIcon(dc: DetectedClient): string {
  if (dc.configured) return pc.green("●");
  if (dc.detected) return pc.yellow("▲");
  return pc.dim("○");
}

function statusText(dc: DetectedClient): string {
  if (dc.staleLayout) return pc.yellow(`stale ${dc.staleLayout} layout`);
  if (dc.configured) return pc.green("configured");
  if (dc.detected) return pc.yellow("detected");
  return pc.dim("not found");
}

function maskKey(k: string): string {
  if (k.length <= 12) return "****";
  return k.slice(0, 8) + "..." + k.slice(-4);
}

async function promptForApiKey(): Promise<string> {
  const key = await text({
    message: "Enter your NeedMCP API key:",
    placeholder: "sk-need-xxx",
    validate: (v) => validateApiKey(v),
  });

  if (isCancel(key)) {
    cancel("Setup cancelled");
    throw new CliError("Setup cancelled");
  }

  return key;
}

async function authenticateWithOAuth(baseUrl: string): Promise<string> {
  let key: string;
  try {
    key = await loginWithOAuth(baseUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ${pc.red("✖")} OAuth failed: ${msg}`);
    console.error(pc.dim("  You can re-run `needmcp setup` and choose \"API Key\" instead."));
    throw new CliError("OAuth authentication failed");
  }

  const err = validateApiKey(key);
  if (err) {
    console.error(`  ${pc.red("✖")} Received key is invalid: ${err}`);
    throw new CliError("Invalid API key received from OAuth");
  }

  console.log(`  ${pc.green("✔")} Authenticated as ${pc.cyan(maskKey(key))}`);
  return key;
}

async function ensureApiKey(providedKey?: string, authMode?: AuthMode): Promise<string | undefined> {
  const config = await loadConfig();

  if (providedKey) {
    const err = validateApiKey(providedKey);
    if (err) {
      console.error(pc.red(err));
      throw new CliError("Invalid API key");
    }
    if (providedKey !== config.apiKey) {
      await saveConfig({ ...config, apiKey: providedKey });
    }
    return providedKey;
  }

  // Explicit auth mode via `--auth <oauth|key>` skips the interactive menu.
  if (authMode === "oauth") {
    const key = await authenticateWithOAuth(resolveBaseUrl(config));
    await saveConfig({ ...config, apiKey: key });
    return key;
  }

  if (authMode === "key") {
    const key = await promptForApiKey();
    await saveConfig({ ...config, apiKey: key });
    return key;
  }

  if (config.apiKey) {
    const validationErr = validateApiKey(config.apiKey);
    if (validationErr) {
      console.warn(pc.yellow(`Stored API key invalid: ${validationErr}. Please choose an option below.`));
    } else {
      const use = await confirm({
        message: `Use stored API key ${pc.cyan(maskKey(config.apiKey))}?`,
      });
      if (isCancel(use)) {
        cancel("Setup cancelled");
        throw new CliError("Setup cancelled");
      }
      if (use) return config.apiKey;
    }
  }

  const authOptions = [
    { value: "oauth", label: "Login with Browser (OAuth)", hint: `${pc.green("Recommended")} — auto-generates a dedicated key` },
    { value: "apikey", label: "Enter API Key", hint: "Paste an existing sk-need-xxx key" },
  ];
  if (GUEST_MODE_ENABLED) {
    authOptions.push({ value: "guest", label: "Guest Mode", hint: "Limited to 20 requests" });
  }

  const mode = await select({
    message: "How would you like to authenticate?",
    options: authOptions,
  });

  if (isCancel(mode)) {
    cancel("Setup cancelled");
    throw new CliError("Setup cancelled");
  }

  if (mode === "guest") return undefined;

  if (mode === "oauth") {
    const key = await authenticateWithOAuth(resolveBaseUrl(config));
    await saveConfig({ ...config, apiKey: key });
    return key;
  }

  const key = await promptForApiKey();
  await saveConfig({ ...config, apiKey: key });
  return key;
}

interface SetupResult {
  clientId: string;
  clientName: string;
  success: boolean;
  message: string;
}

/**
 * Ask how the client should authenticate.
 *
 * OAuth is only offered for clients that either run the handshake themselves or
 * whose config format carries OAuth settings. Booking the choice here — after
 * the client is known — is what lets the API-key path stay untouched for every
 * other client.
 *
 * Default is OAuth for capable clients: the API key remains one keystroke away.
 */
async function promptAuthChoice(
  client: ClientConfig,
  forced?: AuthMode
): Promise<AuthChoice> {
  const oauth = client.oauth;
  if (!oauth || oauth.mode === "unsupported") return "api-key";

  // An explicit `--auth` flag still decides for clients that support both.
  if (forced === "oauth") return "native-oauth";
  if (forced === "key") return "api-key";

  const native = oauth.mode === "native";

  const choice = await select({
    message: `How should ${client.name} authenticate to NeedMCP?`,
    options: [
      {
        value: "native-oauth" as const,
        label: "OAuth 2.1",
        hint: native
          ? `${pc.green("Recommended")} — ${client.name} handles the browser sign-in and token refresh`
          : `${pc.green("Recommended")} — sign in once inside ${client.name}`,
      },
      {
        value: "api-key" as const,
        label: "API key",
        hint: "Write X-API-Key into the client config (long-lived, no refresh)",
      },
    ],
  });

  if (isCancel(choice)) {
    cancel("Setup cancelled");
    throw new CliError("Setup cancelled");
  }

  return choice;
}

async function setupJsonClient(
  client: ClientConfig,
  apiKey: string | undefined,
  mcpUrl: string,
  scope?: "global" | "project",
  useOAuthEntry?: boolean,
  layout?: string
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  const resolved = resolvePath(paths[0]);

  // `mcp add` belongs to Opencode 2.x only: 1.x's variant is a TUI wizard with
  // no flags. It is also only safe when the user actually chose v2, otherwise
  // the binary would write the layout they did not ask for.
  if (
    client.id === "opencode" &&
    canScriptMcpAdd() &&
    !useOAuthEntry &&
    (layout === undefined || layout === "v2")
  ) {
    const bin = resolveOpencodeBinary();
    const addArgs = buildOpencodeAddArgs({ mcpUrl, scope: scope ?? "global", apiKey });
    const run = runClientBinary(bin, addArgs);
    if (!run.ok) {
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        message: `${bin} mcp add failed: ${run.output}`,
      };
    }
    return {
      clientId: client.id,
      clientName: client.name,
      success: true,
      message: "Registered via `opencode mcp add`",
    };
  }

  // Seed from a legacy file only when the target does not exist yet, and only
  // from the SAME scope: a project-scope run must never clone the global config
  // into the project. The legacy file is read only — never rewritten/deleted.
  const legacyCandidates =
    scope === "project"
      ? (client.legacyProjectPaths ?? []).map((p) => join(process.cwd(), p))
      : (client.legacyPaths ?? []).map((p) => resolvePath(p));
  const migration = await loadMigrationSource(resolved, legacyCandidates);

  const existing = migration ? migration.config : await readJsonConfig(resolved);

  // Comments do not survive a re-serialisation, so warn before they are lost.
  if (!migration && (await hasJsonComments(resolved))) {
    console.warn(
      pc.yellow(
        `  ! ${resolved} contains comments; they will be removed when the file is rewritten.`
      )
    );
  }

  // In OAuth mode the entry must be header-free: NeedMCP reads `X-API-Key`
  // before `Authorization: Bearer`, so a leftover key would mask the OAuth
  // token and fail with "Invalid or revoked API key".
  const oauthEntry = useOAuthEntry ? client.oauth?.buildEntry?.(mcpUrl) : undefined;

  let entry: Record<string, unknown>;
  if (oauthEntry) {
    entry = { ...oauthEntry, ...(client.oauth?.entryExtras ?? {}) };
  } else {
    if (!client.buildEntry) {
      return { clientId: client.id, clientName: client.name, success: false, message: "No entry builder defined" };
    }
    entry = client.buildEntry(apiKey, mcpUrl, layout);
  }

  const key = resolveClientConfigKey(client, layout);
  const name = client.serverName ?? "needmcp";

  // Drop an entry still sitting at the other layout's path: either an older CLI
  // release wrote it, or the user just switched which Opencode they run. 1.x
  // rejects `mcp.servers` outright, so leaving it would hide every server.
  const { config: cleaned, removed: strayRemoved } = cleanupStrayEntry(existing, key, name);

  const { config, alreadyExists } = mergeServerEntry(cleaned, key, name, entry);
  await writeJsonConfig(resolved, config);

  const messages: string[] = [alreadyExists ? "Updated" : "Created"];
  if (strayRemoved) {
    const strayPath = toKeyPath(key).join(".") === "mcp.servers" ? "mcp.needmcp" : "mcp.servers.needmcp";
    messages.push(`removed stale ${strayPath} entry (other OpenCode layout)`);
  }
  if (layout) {
    messages.push(`OpenCode layout ${layout} (${toKeyPath(key).join(".")}.${name})`);
  }
  if (migration) {
    messages.push(
      `migrated existing servers from ${migration.from} (that file is no longer read and can be removed)`
    );
  }

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: messages.join(" — "),
  };
}

function runClientBinary(
  bin: string,
  args: string[]
): { ok: boolean; output: string } {
  process.stdout.write(`\n    Running: ${pc.dim(formatOAuthCommand(bin, args))}\n\n`);
  try {
    execFileSync(bin, args, { stdio: "inherit", timeout: 120000 });
    process.stdout.write("\n");
    return { ok: true, output: "" };
  } catch (err) {
    process.stdout.write("\n");
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: msg.slice(0, 200) };
  }
}

/**
 * Configure a client through its own CLI when the user picked OAuth.
 *
 * Two shapes are supported:
 *
 *  - the client has an `mcp add` command → run it, then the login command.
 *  - the client has no usable `add` command (Opencode 1.x has none) → write
 *    the header-free entry to the config file directly, then run login.
 *
 * Order matters and mirrors every client's docs: the server is registered
 * first, then authenticated. A `mcp auth` command cannot resolve a server that
 * is not in the config yet.
 *
 * Failure handling is deliberately non-destructive:
 *
 *  - binary missing  → write the config file without auth and print the exact
 *    commands to run later. A registered-but-unauthenticated server is
 *    recoverable; a hard failure leaves the user with nothing.
 *  - `add` fails     → report failure (nothing was written).
 *  - `login` fails   → report success-with-warning. The server is registered, so
 *    the user only has to sign in manually. Never hard-fail here.
 *
 * The CLI never stores an OAuth token: access tokens live one hour and only the
 * client owns the refresh loop. See `src/clients/oauth-clients.ts`.
 */
async function runNativeOAuth(
  client: ClientConfig,
  mcpUrl: string,
  scope: "global" | "project",
  layout?: string
): Promise<SetupResult> {
  const oauth = client.oauth;
  const declared = oauth?.binary;

  if (!declared) {
    // Defensive: canDriveNativeOAuth() should have prevented this.
    return setupClient(client, undefined, mcpUrl, scope, true, "native-oauth", layout);
  }

  // Opencode 1.x installs as `opencode`, 2.x as `opencode2`; pick the one that
  // is actually present so `mcp auth` runs at all.
  const bin = client.id === "opencode" ? resolveOpencodeBinary() : declared;

  // `mcp add` only exists as a scriptable command in 2.x. When the user chose
  // the 1.x layout, calling it would register the server in the other layout,
  // so the entry is written directly instead.
  const addArgsRaw = oauth?.addArgs?.(mcpUrl, scope);
  const addArgs = layout === "v1" && client.id === "opencode" ? null : addArgsRaw;
  const loginArgs = oauth?.loginArgs?.();
  const loginHint = loginArgs ? formatOAuthCommand(bin, loginArgs) : null;

  const register = async (): Promise<SetupResult> => {
    if (addArgs) {
      const add = runClientBinary(bin, addArgs);
      if (!add.ok) {
        return {
          clientId: client.id,
          clientName: client.name,
          success: false,
          message: `${bin} mcp add failed: ${add.output}`,
        };
      }
      return {
        clientId: client.id,
        clientName: client.name,
        success: true,
        message: "Added",
      };
    }

    // No `add` command: write the header-free entry ourselves.
    return setupClient(client, undefined, mcpUrl, scope, true, "native-oauth", layout);
  };

  const addHint = addArgs ? formatOAuthCommand(bin, addArgs) : null;
  const manualSteps = [addHint, loginHint].filter(Boolean).join(" then ");

  if (!commandExists(bin)) {
    const fallback = await register();
    if (!fallback.success) return fallback;
    const steps = manualSteps
      ? `Run \`${manualSteps}\``
      : `Finish sign-in inside ${client.name}`;
    return {
      ...fallback,
      message: `Created without auth — \`${bin}\` not found on PATH. ${steps}`,
    };
  }

  const registered = await register();
  if (!registered.success) return registered;

  if (!loginArgs) {
    return {
      clientId: client.id,
      clientName: client.name,
      success: true,
      message: `Added — finish sign-in inside ${client.name}`,
    };
  }

  const auth = runClientBinary(bin, loginArgs);
  if (!auth.ok) {
    return {
      clientId: client.id,
      clientName: client.name,
      success: true,
      message: `Server added, but authentication failed (${auth.output}). Run \`${loginHint}\` manually`,
    };
  }

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: `Added and authenticated via ${client.name} OAuth`,
  };
}

async function setupTomlClient(
  client: ClientConfig,
  apiKey: string | undefined,
  mcpUrl: string,
  scope?: "global" | "project",
  useOAuthEntry?: boolean
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  const resolved = resolvePath(paths[0]);

  const oauthEntry = useOAuthEntry ? client.oauth?.buildEntry?.(mcpUrl) : undefined;

  let entry: Record<string, unknown>;
  if (oauthEntry) {
    entry = { ...oauthEntry, ...(client.oauth?.entryExtras ?? {}) };
  } else {
    if (!client.buildEntry) {
      return { clientId: client.id, clientName: client.name, success: false, message: "No entry builder defined" };
    }
    entry = client.buildEntry(apiKey, mcpUrl);
  }

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
  apiKey: string | undefined,
  mcpUrl: string,
  useOAuthEntry?: boolean
): Promise<SetupResult> {
  // OAuth mode must not pass `--header`: a registered key header suppresses the
  // client's own sign-in and is preferred by the server over the OAuth token.
  const effectiveKey = useOAuthEntry ? undefined : apiKey;

  let cmd: string;
  const oauthAddArgs = useOAuthEntry ? client.oauth?.addArgs?.(mcpUrl, "global") : null;
  if (oauthAddArgs) {
    const bin = client.oauth!.binary;
    if (!bin) {
      return { clientId: client.id, clientName: client.name, success: false, message: "No OAuth binary defined" };
    }
    cmd = formatOAuthCommand(bin, oauthAddArgs);
  } else {
    if (!client.buildCommand) {
      return { clientId: client.id, clientName: client.name, success: false, message: "No command builder defined" };
    }
    cmd = client.buildCommand(effectiveKey, mcpUrl);
  }

  process.stdout.write(`\n    Running: ${pc.dim(cmd)}\n\n`);
  try {
    execFileSync(cmd, [], { stdio: "inherit", timeout: 120000, shell: true });
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
  apiKey: string | undefined,
  mcpUrl: string,
  scope?: "global" | "project",
  useOAuthEntry?: boolean,
  _authChoice?: AuthChoice,
  layout?: string
): Promise<SetupResult> {
  switch (client.format) {
    case "json":
      return setupJsonClient(client, apiKey, mcpUrl, scope, useOAuthEntry, layout);
    case "toml":
      return setupTomlClient(client, apiKey, mcpUrl, scope, useOAuthEntry);
    case "cli":
      return setupCliClient(client, apiKey, mcpUrl, useOAuthEntry);
    default:
      return { clientId: client.id, clientName: client.name, success: false, message: "Manual setup required" };
  }
}

export async function runSetup(
  providedKey?: string,
  authMode?: AuthMode,
  layoutOverride?: OpencodeLayout
): Promise<void> {
  intro(pc.bgCyan(pc.black(" needmcp setup ")));

  const detected = await detectAllClients();

  const sortWeight = (dc: DetectedClient): number => dc.configured ? 0 : dc.detected ? 1 : 2;
  detected.sort((a, b) => sortWeight(a) - sortWeight(b));

  const options = detected.map((dc) => ({
    value: dc.id,
    label: `${statusIcon(dc)} ${dc.name}`,
    hint: dc.description ? `${statusText(dc)} — ${dc.description}` : statusText(dc),
  }));

  const selected = await select({
    message: "Select a client to setup:",
    options,
  });

  if (isCancel(selected) || !selected) {
    cancel("No client selected");
    throw new CliError("No client selected");
  }

  const clientId = selected;

  const client = allClients().find((c) => c.id === clientId);
  if (!client) {
    cancel("Client not found");
    throw new CliError("Client not found");
  }

  const scopes = getAvailableScopes(client);
  let scope: "global" | "project";
  if (scopes.length === 1) {
    scope = scopes[0];
  } else {
    const selectedScope = await select({
      message: "Config scope:",
      options: [
        { value: "global" as const, label: "Global", hint: "Install system-wide" },
        { value: "project" as const, label: "Project", hint: "Install for current project only" },
      ],
    });
    if (isCancel(selectedScope)) {
      cancel("Setup cancelled");
      throw new CliError("Setup cancelled");
    }
    scope = selectedScope;
  }

  // Opencode ships 1.x and 2.x as separate binaries with incompatible config
  // layouts — neither accepts the other's. When both are installed the user
  // must say which one they actually run, and the choice is asked again on
  // every setup: nothing is persisted, so switching binaries needs no reset.
  const layout = await promptOpencodeLayout(client, layoutOverride);

  // Auth is resolved only once the client is known: a client with native
  // OAuth may need no CLI login at all, and asking first would leave unused
  // API keys behind.
  const authChoice = await promptAuthChoice(client, authMode);

  let apiKey: string | undefined;
  if (authChoice === "api-key") {
    apiKey = await ensureApiKey(providedKey, authMode);
  }

  const config = await loadConfig();
  const mcpUrl = resolveMcpUrl(config);

  // Show the resolved endpoint up front: a silent fall back to production when
  // a local override was expected is hard to notice in the written config.
  const localOverride = isUrlOverridden();
  console.log(
    `  ${pc.dim("Endpoint:")} ${pc.cyan(mcpUrl)}` +
      (localOverride ? pc.yellow("  (overridden by env)") : "")
  );

  outro(`Setting up ${pc.cyan(clientId)} (${scope})...\n`);

  const results: SetupResult[] = [];

    const label = `  ${client.name}...`;
    process.stdout.write(label);

    try {
      const result =
        authChoice === "native-oauth" && canDriveNativeOAuth(client)
          ? await runNativeOAuth(client, mcpUrl, scope, layout)
          : await setupClient(
              client,
              apiKey,
              mcpUrl,
              scope,
              authChoice === "native-oauth",
              authChoice,
              layout
            );
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
      const key = resolveClientConfigKey(client);
      const name = client.serverName ?? "needmcp";
      const { config, removed } = removeServerEntry(existing, key, name);

      // Also clear an entry left under the old `mcp.servers` path.
      const { config: cleaned, removed: strayRemoved } = cleanupStrayEntry(
        config,
        key,
        name
      );

      if (removed || strayRemoved) {
        await writeJsonConfig(resolved, cleaned);
        return { clientId: client.id, clientName: client.name, success: true, message: "Removed" };
      }
    } catch {}
  }

  // Legacy-only installs: report success if the legacy file holds the entry.
  const legacyCandidates =
    scope === "project"
      ? (client.legacyProjectPaths ?? []).map((p) => join(process.cwd(), p))
      : (client.legacyPaths ?? []).map((p) => resolvePath(p));

  for (const resolved of legacyCandidates) {
    try {
      const existing = await readJsonConfig(resolved);
      const key = resolveClientConfigKey(client);
      const name = client.serverName ?? "needmcp";
      const section = getSection(existing, key);
      if (section && name in section) {
        console.warn(
          pc.yellow(`  ! ${resolved} is no longer read by the client; remove "${name}" from it manually.`)
        );
        return { clientId: client.id, clientName: client.name, success: true, message: "Removed (legacy file only)" };
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
    throw new CliError("No clients found");
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
    throw new CliError("No client selected");
  }

  const clientId = selected;

  const client = allClients().find((c) => c.id === clientId);
  if (!client) {
    cancel("Client not found");
    throw new CliError("Client not found");
  }

  const scopes = getAvailableScopes(client);
  let scope: "global" | "project";
  if (scopes.length === 1) {
    scope = scopes[0];
  } else {
    const selectedScope = await select({
      message: "Config scope:",
      options: [
        { value: "global" as const, label: "Global", hint: "Remove from system-wide config" },
        { value: "project" as const, label: "Project", hint: "Remove from current project only" },
      ],
    });
    if (isCancel(selectedScope)) {
      cancel("Remove cancelled");
      throw new CliError("Remove cancelled");
    }
    scope = selectedScope;
  }

  outro(`Removing from ${pc.cyan(clientId)} (${scope})...\n`);

  const results: SetupResult[] = [];

  process.stdout.write(`  ${client.name}...`);

  try {
    const result = await removeClient(client, scope);
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

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  outro(
    `${pc.green(`✔ ${successCount} client(s) removed`)}${failCount > 0 ? ` ${pc.yellow(`⚠ ${failCount} failed`)}` : ""}`
  );
}
