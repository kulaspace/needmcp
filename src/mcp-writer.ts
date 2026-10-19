import { access, readFile, writeFile as fsWriteFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "smol-toml";

export function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") i++;
        i++;
      }
      result += text.slice(start, ++i);
    } else if (text[i] === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < text.length && text[i] !== "\n") i++;
    } else if (text[i] === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      result += text[i++];
    }
  }
  return result.replace(/,(\s*[}\]])/g, "$1");
}

export async function readJsonConfig(filePath: string): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return {};
  }

  raw = raw.trim();
  if (!raw) return {};

  try {
    return JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
  } catch (e) {
    console.warn(`Warning: Invalid JSON in ${filePath}, treating as empty`);
    return {};
  }
}

/** A config key, or a function returning one when the layout is dynamic. */
export type ConfigKey = string | string[] | (() => string | string[]);

/**
 * Resolve a possibly-dynamic config key into its concrete form.
 *
 * Clients whose schema differs between installed versions (Opencode 1.x vs
 * 2.x) expose `configKey` as a function so the value is decided at use time.
 */
export function resolveConfigKey(configKey: ConfigKey): string | string[] {
  return typeof configKey === "function" ? configKey() : configKey;
}

/** Normalise a config key into a path of at least one segment. */
export function toKeyPath(configKey: ConfigKey): string[] {
  const resolved = resolveConfigKey(configKey);
  const path = (Array.isArray(resolved) ? resolved : [resolved]).filter((s) => s.length > 0);
  return path.length > 0 ? path : ["mcpServers"];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the server section at `configKey`, walking nested keys.
 * Returns `undefined` when any intermediate key is missing or not an object.
 */
export function getSection(
  config: Record<string, unknown>,
  configKey: ConfigKey
): Record<string, unknown> | undefined {
  let current: unknown = config;
  for (const key of toKeyPath(configKey)) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return isPlainObject(current) ? current : undefined;
}

/** Immutably set `value` at `path`, cloning each level along the way. */
function setIn(
  target: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  const [head, ...rest] = path;
  const currentValue = target[head];
  const nextValue =
    rest.length === 0
      ? value
      : setIn(isPlainObject(currentValue) ? currentValue : {}, rest, value);

  return { ...target, [head]: nextValue };
}

/**
 * Immutably delete `path`. Empty objects left behind by the deletion are
 * removed too, so `mcp.servers.needmcp` going away also drops an emptied
 * `servers` (and then an emptied `mcp`).
 */
function deleteIn(target: Record<string, unknown>, path: string[]): Record<string, unknown> {
  const [head, ...rest] = path;
  if (!(head in target)) return target;

  const result = { ...target };

  if (rest.length === 0) {
    delete result[head];
    return result;
  }

  if (!isPlainObject(target[head])) return target;

  const child = deleteIn(target[head] as Record<string, unknown>, rest);
  if (Object.keys(child).length === 0) {
    delete result[head];
  } else {
    result[head] = child;
  }

  return result;
}

export function mergeServerEntry(
  existing: Record<string, unknown>,
  configKey: ConfigKey,
  serverName: string,
  entry: Record<string, unknown>
): { config: Record<string, unknown>; alreadyExists: boolean } {
  const path = toKeyPath(configKey);
  const section = getSection(existing, path) ?? {};
  const alreadyExists = serverName in section;

  return {
    config: setIn(existing, path, { ...section, [serverName]: entry }),
    alreadyExists,
  };
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = filePath + ".tmp";
  await fsWriteFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}

export async function writeJsonConfig(
  filePath: string,
  config: Record<string, unknown>
): Promise<void> {
  await atomicWrite(filePath, JSON.stringify(config, null, 2) + "\n");
}

export async function resolveMcpPath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the file contains a `//` or block comment outside a string.
 *
 * `writeJsonConfig` re-serialises the whole document, so comments cannot
 * survive a write. Callers use this to warn the user before data is lost.
 */
export async function hasJsonComments(filePath: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return false;
  }

  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '"') {
      i++;
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === "\\") i++;
        i++;
      }
      i++;
    } else if (raw[i] === "/" && (raw[i + 1] === "/" || raw[i + 1] === "*")) {
      return true;
    } else {
      i++;
    }
  }
  return false;
}

export interface MigrationSource {
  /** Path of the file that was read (e.g. a legacy `opencode.json`). */
  from: string;
  /** The parsed contents, to be merged into the target file. */
  config: Record<string, unknown>;
}

/**
 * Remove an entry left at the OTHER Opencode layout's path.
 *
 * The two versions use different roots and neither accepts the other's:
 *
 *   opencode 1.x   mcp.<name>
 *   opencode 2.x   mcp.servers.<name>
 *
 * So whenever the user switches version — or an older CLI release wrote the
 * other layout — the previous entry must go. Two reasons it matters:
 *
 *  - a leftover `mcp.servers` makes 1.x reject the WHOLE file ("Invalid input
 *    mcp.servers"), hiding every other server;
 *  - a leftover `mcp.needmcp` alongside `mcp.servers.needmcp` gives the same
 *    server two conflicting entries, so whichever the client prefers wins.
 *
 * When removing `mcp.servers.<name>` empties the `servers` object, the object
 * itself is dropped: an empty `mcp.servers` still trips the 1.x validator even
 * though it holds nothing.
 *
 * Returns the config unchanged when there is no stray entry.
 */
export function cleanupStrayEntry(
  config: Record<string, unknown>,
  configKey: ConfigKey,
  serverName: string
): { config: Record<string, unknown>; removed: boolean } {
  const canonical = toKeyPath(configKey);
  const strayKey = canonical.join(".") === "mcp.servers" ? ["mcp"] : ["mcp", "servers"];

  const section = getSection(config, strayKey);
  if (!section || !(serverName in section)) {
    return { config, removed: false };
  }

  const result = removeServerEntry(config, strayKey, serverName);

  // Drop a `servers` container that is now empty — 1.x rejects the key itself,
  // not just its contents, so an empty object is still a broken config.
  const emptied = getSection(result.config, strayKey);
  if (strayKey.length > 1 && emptied && Object.keys(emptied).length === 0) {
    const parent = getSection(result.config, strayKey.slice(0, -1));
    if (parent) delete parent[strayKey[strayKey.length - 1]];
  }

  return { config: result.config, removed: true };
}

/**
 * Load a legacy config file to seed a new one, when the target does not exist.
 *
 * Opencode writes `opencode.json` in some versions and `opencode.jsonc` in
 * others. Rather than guessing which one the running binary prefers, new
 * entries always go to the `.jsonc` file; a pre-existing `.json` is copied in
 * once so the user's other servers survive the switch. The legacy file is
 * never modified or deleted.
 */
export async function loadMigrationSource(
  targetPath: string,
  candidates: string[]
): Promise<MigrationSource | null> {
  if (await fileExists(targetPath)) return null;

  for (const candidate of candidates) {
    if (candidate === targetPath) continue;
    if (!(await fileExists(candidate))) continue;
    const config = await readJsonConfig(candidate);
    if (Object.keys(config).length === 0) continue;
    return { from: candidate, config };
  }

  return null;
}

function tomlString(value: string): string {
  // TOML basic strings share the same escaping rules as JSON strings
  // for the ASCII printable range used in HTTP header values.
  return JSON.stringify(value);
}

function formatInlineTable(headers: Record<string, string>): string {
  const pairs = Object.entries(headers)
    .map(([key, value]) => `${JSON.stringify(key)} = ${tomlString(value)}`)
    .join(", ");
  return `{ ${pairs} }`;
}

function insertHttpHeaders(
  toml: string,
  serverName: string,
  headers: Record<string, string>
): string {
  const escapedName = serverName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`^(\\[mcp_servers\\.${escapedName}\\]\\s*)$`, "m");
  const inline = formatInlineTable(headers);
  return toml.replace(sectionPattern, `$1\nhttp_headers = ${inline}`);
}

function extractHttpHeaders(entry: Record<string, unknown>): Record<string, string> | undefined {
  const headers = (entry.http_headers ?? entry.headers) as Record<string, string> | undefined;
  return headers && Object.keys(headers).length > 0 ? headers : undefined;
}

export function buildTomlBlock(serverName: string, entry: Record<string, unknown>): string {
  const section: Record<string, unknown> = {};
  const headers = extractHttpHeaders(entry);

  for (const [key, value] of Object.entries(entry)) {
    if (key === "headers" || key === "http_headers") continue;
    section[key] = value;
  }

  const full: Record<string, unknown> = {
    mcp_servers: {
      [serverName]: section,
    },
  };

  let toml = stringify(full);
  if (headers) {
    toml = insertHttpHeaders(toml, serverName, headers);
  }

  return toml;
}

export async function appendTomlServer(
  filePath: string,
  serverName: string,
  entry: Record<string, unknown>
): Promise<{ alreadyExists: boolean }> {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = await readFile(filePath, "utf-8");
    parsed = parse(raw) as Record<string, unknown>;
  } catch {}

  const mcpServers = (parsed.mcp_servers as Record<string, Record<string, unknown>>) ?? {};
  const alreadyExists = serverName in mcpServers;

  const serverEntry: Record<string, unknown> = {};
  const headers = extractHttpHeaders(entry);
  for (const [key, value] of Object.entries(entry)) {
    if (key === "headers" || key === "http_headers") continue;
    serverEntry[key] = value;
  }

  const newMcpServers = { ...mcpServers, [serverName]: serverEntry };
  let toml = stringify({ ...parsed, mcp_servers: newMcpServers });

  if (headers) {
    toml = insertHttpHeaders(toml, serverName, headers);
  }

  await atomicWrite(filePath, toml);

  return { alreadyExists };
}

export function removeServerEntry(
  existing: Record<string, unknown>,
  configKey: ConfigKey,
  serverName: string
): { config: Record<string, unknown>; removed: boolean } {
  const path = toKeyPath(configKey);
  const section = getSection(existing, path);
  if (!section || !(serverName in section)) {
    return { config: existing, removed: false };
  }

  const rest = Object.fromEntries(Object.entries(section).filter(([key]) => key !== serverName));

  if (Object.keys(rest).length === 0) {
    return { config: deleteIn(existing, path), removed: true };
  }

  return { config: setIn(existing, path, rest), removed: true };
}

export async function removeTomlServer(
  filePath: string,
  serverName: string
): Promise<{ removed: boolean }> {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = await readFile(filePath, "utf-8");
    parsed = parse(raw) as Record<string, unknown>;
  } catch {
    return { removed: false };
  }

  const mcpServers = parsed.mcp_servers as Record<string, unknown> | undefined;
  if (!mcpServers || !(serverName in mcpServers)) {
    return { removed: false };
  }

  const newMcpServers = { ...mcpServers };
  delete newMcpServers[serverName];

  const newParsed = { ...parsed };
  if (Object.keys(newMcpServers).length === 0) {
    delete newParsed.mcp_servers;
  } else {
    newParsed.mcp_servers = newMcpServers;
  }

  await atomicWrite(filePath, stringify(newParsed));
  return { removed: true };
}
