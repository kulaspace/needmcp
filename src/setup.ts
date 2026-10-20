import { intro, outro, cancel, isCancel, text, select, confirm, spinner, log } from "@clack/prompts";
import pc from "picocolors";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { readJsonConfig, writeJsonConfig, mergeServerEntry, appendTomlServer, removeServerEntry, removeTomlServer, hasJsonComments, getSection, toKeyPath } from "./mcp-writer.js";
import { loadConfig, saveConfig, resolveMcpUrl, resolveBaseUrl } from "./config.js";
import { allClients, detectAllClients, resolvePath, resolveClientPaths } from "./clients/index.js";
import { resolveClientConfigKey } from "./clients/types.js";
import type { ClientConfig, DetectedClient } from "./clients/index.js";
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
 * Run a slow step behind a spinner.
 *
 * Every step that spawns a process or hits the network goes through here: the
 * terminal used to sit blank for seconds after the scope prompt, which reads as
 * a hang. On a non-TTY (CI, piped output) the spinner would write escape codes
 * into the log, so it is skipped and the message is logged once instead.
 */
async function withSpinner<T>(label: string, work: () => Promise<T>, done?: (r: T) => string): Promise<T> {
  if (!process.stdout.isTTY) {
    log.info(label);
    const result = await work();
    if (done) log.success(done(result));
    return result;
  }

  const s = spinner();
  s.start(label);
  try {
    const result = await work();
    s.stop(done ? done(result) : label);
    return result;
  } catch (err) {
    s.stop(pc.red(`${label} failed`), 1);
    throw err;
  }
}

/** One line describing what detection found, for the spinner's final frame. */
function describeDetectedClients(detected: DetectedClient[]): string {
  const ready = detected.filter((d) => d.configured).length;
  const found = detected.filter((d) => d.detected && !d.configured).length;
  return `Found ${ready} configured, ${found} detected`;
}

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
  useOAuthEntry?: boolean
): Promise<SetupResult> {
  const paths = resolveClientPaths(client, scope);

  if (paths.length === 0) {
    return { clientId: client.id, clientName: client.name, success: false, message: "No paths defined" };
  }

  const resolved = resolvePath(paths[0]);

  const existing = await readJsonConfig(resolved);

  // Comments do not survive a re-serialisation, so warn before they are lost.
  if (existing && (await hasJsonComments(resolved))) {
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
    entry = client.buildEntry(apiKey, mcpUrl);
  }

  const key = resolveClientConfigKey(client);
  const name = client.serverName ?? "needmcp";

  // Merge into what is already there — other keys (`model`, `agents`) and every
  // sibling server are carried over untouched. Never replace the whole file.
  const { config, alreadyExists } = mergeServerEntry(existing, key, name, entry);
  await writeJsonConfig(resolved, config);

  const messages: string[] = [alreadyExists ? "Updated" : "Created"];
  if (client.id === "opencode") {
    messages.push(`wrote ${toKeyPath(key).join(".")}.${name} in ${resolved}`);
  }

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: messages.join(" — "),
  };
}

/**
 * True when this process has a real terminal the child can inherit.
 *
 * `opencode mcp auth` opens an interactive clack prompt ("Re-authenticate?
 * Yes / No"), so it needs keyboard input. Without a TTY (an agent, CI, a pipe)
 * the prompt cannot be answered, and opencode exits non-zero — which is not an
 * authentication failure, just an unusable environment.
 */
function hasInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Run a client's own CLI, in the user's terminal.
 *
 * These commands are interactive: `opencode mcp auth needmcp` starts a browser
 * OAuth flow and prints its progress on stdout, so stdio is inherited and the
 * terminal is the UI.
 *
 * Nothing is inspected beforehand — no binary lookup, no version probe, no
 * pre-flight check. The command is run exactly as the user would type it. If a
 * particular shell setup makes it fail, the command is printed so the user can
 * run it themselves.
 *
 * The caller decides whether the exit code is fatal. A non-zero exit here
 * usually means the user answered "No" to a prompt or cancelled the browser
 * flow — a decision, not a failure — so the outcome is reported, never thrown.
 */
function runClientBinary(
  bin: string,
  args: string[]
): { ok: boolean; skipped: boolean; output: string } {
  const command = formatOAuthCommand(bin, args);

  // Hand the prompt to the user when there is a terminal to show it in.
  // Otherwise there is nothing to answer, so print the command and move on.
  if (!hasInteractiveTerminal()) {
    return {
      ok: false,
      skipped: true,
      output: "no interactive terminal",
    };
  }

  process.stdout.write(`\n    Running: ${pc.dim(command)}\n\n`);

  // `shell: true` so a Windows `.cmd` shim resolves the same way it does when
  // the user types the command in their own terminal. stdin/stdout/stderr are
  // all inherited, so the prompt sees real keystrokes and the browser flow is
  // visible. `spawnSync` (not `execFileSync`) keeps the inherited handles
  // intact on Windows instead of routing them through the shell's pipes.
  const result = spawnSync(command, [], { stdio: "inherit", shell: true });
  process.stdout.write("\n");

  if (result.error) {
    return {
      ok: false,
      skipped: false,
      output: String(result.error.message).slice(0, 200),
    };
  }

  if (result.status === 0) {
    return { ok: true, skipped: false, output: "" };
  }

  // Surface the signal/exit code so "user cancelled" is distinguishable from
  // "server unreachable" in the final message.
  const reason =
    result.signal !== null
      ? `cancelled (${result.signal})`
      : `exited with code ${result.status ?? "unknown"}`;
  return { ok: false, skipped: false, output: reason };
}

/**
 * Configure a client through its own CLI when the user picked OAuth.
 *
 * Two shapes are supported:
 *
 *  - the client has an `mcp add` command → run it, then the login command.
 *  - the client has no usable `add` command (Opencode) → write the header-free
 *    entry to the config file directly, then run login. For Opencode the file
 *    is edited first and `opencode mcp auth needmcp` runs afterwards; `mcp auth`
 *    cannot resolve a server that is not in the config yet.
 *
 * Order matters and mirrors every client's docs: the server is registered
 * first, then authenticated.
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
  scope: "global" | "project"
): Promise<SetupResult> {
  const oauth = client.oauth;
  const bin = oauth?.binary;

  if (!bin) {
    // Defensive: canDriveNativeOAuth() should have prevented this.
    return setupClient(client, undefined, mcpUrl, scope, true, "native-oauth");
  }

  const addArgs = oauth?.addArgs?.(mcpUrl, scope);
  const loginArgs = oauth?.loginArgs?.();
  const loginHint = loginArgs ? formatOAuthCommand(bin, loginArgs) : null;

  const register = async (): Promise<SetupResult> => {
    if (addArgs) {
      const add = runClientBinary(bin, addArgs);
      // No terminal: still safe to skip, because `mcp add` writes the same
      // entry the OAuth path would write, and the user can re-run it.
      if (!add.ok && !add.skipped) {
        return {
          clientId: client.id,
          clientName: client.name,
          success: false,
          message: `${bin} mcp add failed: ${add.output}`,
        };
      }
      if (!add.ok) {
        // Nothing was registered by the client's CLI, so fall back to writing
        // the header-free entry ourselves — the server must exist before the
        // sign-in command can resolve it.
        return setupClient(client, undefined, mcpUrl, scope, true, "native-oauth");
      }
      return {
        clientId: client.id,
        clientName: client.name,
        success: true,
        message: "Added",
      };
    }

    // No `add` command: write the header-free entry ourselves.
    return setupClient(client, undefined, mcpUrl, scope, true, "native-oauth");
  };

  const addHint = addArgs ? formatOAuthCommand(bin, addArgs) : null;

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
    // The entry is written, so the server is registered and usable as soon as
    // the user signs in. Never fail the setup over a cancelled prompt.
    if (auth.skipped) {
      return {
        clientId: client.id,
        clientName: client.name,
        success: true,
        message: `${registered.message} — sign in from your terminal: \`${loginHint}\``,
      };
    }
    return {
      clientId: client.id,
      clientName: client.name,
      success: true,
      message: `${registered.message} — sign-in not completed (${auth.output}). Run \`${loginHint}\` whenever you're ready`,
    };
  }

  return {
    clientId: client.id,
    clientName: client.name,
    success: true,
    message: `${registered.message} and authenticated via ${client.name} OAuth`,
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
  // Inherit all three handles so an interactive `mcp add` behaves exactly as
  // if the user typed it. `spawnSync` keeps those handles on Windows instead of
  // routing them through the shell's pipes the way `execFileSync` does.
  const result = spawnSync(cmd, [], { stdio: "inherit", timeout: 120000, shell: true });
  process.stdout.write("\n");

  if (result.error) {
    return {
      clientId: client.id,
      clientName: client.name,
      success: false,
      message: String(result.error.message).slice(0, 200),
    };
  }
  if (result.status !== 0) {
    const reason = result.signal !== null ? `cancelled (${result.signal})` : `exited with code ${result.status ?? "unknown"}`;
    return { clientId: client.id, clientName: client.name, success: false, message: reason };
  }
  return { clientId: client.id, clientName: client.name, success: true, message: "CLI command succeeded" };
}

async function setupClient(
  client: ClientConfig,
  apiKey: string | undefined,
  mcpUrl: string,
  scope?: "global" | "project",
  useOAuthEntry?: boolean,
  _authChoice?: AuthChoice
): Promise<SetupResult> {
  switch (client.format) {
    case "json":
      return setupJsonClient(client, apiKey, mcpUrl, scope, useOAuthEntry);
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
  authMode?: AuthMode
): Promise<void> {
  intro(pc.bgCyan(pc.black(" needmcp setup ")));

  const detected = await withSpinner(
    "Detecting installed AI clients...",
    () => detectAllClients(),
    describeDetectedClients
  );

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

  // Auth is resolved only once the client is known: a client with native
  // OAuth may need no CLI login at all, and asking first would leave unused
  // API keys behind.
  const authChoice = await promptAuthChoice(client, authMode);

  let apiKey: string | undefined;
  if (authChoice === "api-key") {
    apiKey = await ensureApiKey(providedKey, authMode);
  }

  // `loadConfig` reads the config file and can resolve an endpoint over the
  // network; both are slow enough to look frozen without feedback.
  const config = await withSpinner("Resolving NeedMCP endpoint...", () => loadConfig());
  const mcpUrl = resolveMcpUrl(config);

  // Show the resolved endpoint up front: a silent fall back to production when
  // a local override was expected is hard to notice in the written config.
  const localOverride = isUrlOverridden();
  log.info(
    `${pc.dim("Endpoint:")} ${pc.cyan(mcpUrl)}` +
      (localOverride ? pc.yellow("  (overridden by env)") : "")
  );

  outro(`Setting up ${pc.cyan(clientId)} (${scope})...\n`);

  const results: SetupResult[] = [];

    const label = `  ${client.name}...`;
    process.stdout.write(label);

    try {
      const result =
        authChoice === "native-oauth" && canDriveNativeOAuth(client)
          ? await runNativeOAuth(client, mcpUrl, scope)
          : await setupClient(
              client,
              apiKey,
              mcpUrl,
              scope,
              authChoice === "native-oauth",
              authChoice
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

      if (removed) {
        await writeJsonConfig(resolved, config);
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

  const detected = await withSpinner(
    "Detecting installed AI clients...",
    () => detectAllClients(),
    describeDetectedClients
  );

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
