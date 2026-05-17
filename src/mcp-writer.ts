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

export function mergeServerEntry(
  existing: Record<string, unknown>,
  configKey: string,
  serverName: string,
  entry: Record<string, unknown>
): { config: Record<string, unknown>; alreadyExists: boolean } {
  const section = (existing[configKey] as Record<string, unknown> | undefined) ?? {};
  const alreadyExists = serverName in section;

  return {
    config: {
      ...existing,
      [configKey]: {
        ...section,
        [serverName]: entry,
      },
    },
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

export function buildTomlBlock(serverName: string, entry: Record<string, unknown>): string {
  const section: Record<string, unknown> = {};
  const headers = entry.headers as Record<string, string> | undefined;

  for (const [key, value] of Object.entries(entry)) {
    if (key === "headers") continue;
    section[key] = value;
  }

  if (headers && Object.keys(headers).length > 0) {
    section.http_headers = headers;
  }

  const full: Record<string, unknown> = {
    mcp_servers: {
      [serverName]: section,
    },
  };

  return stringify(full);
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
  const headers = entry.headers as Record<string, string> | undefined;
  for (const [key, value] of Object.entries(entry)) {
    if (key === "headers") continue;
    serverEntry[key] = value;
  }
  if (headers && Object.keys(headers).length > 0) {
    serverEntry.http_headers = headers;
  }

  const newMcpServers = { ...mcpServers, [serverName]: serverEntry };
  await atomicWrite(filePath, stringify({ ...parsed, mcp_servers: newMcpServers }));

  return { alreadyExists };
}

export function removeServerEntry(
  existing: Record<string, unknown>,
  configKey: string,
  serverName: string
): { config: Record<string, unknown>; removed: boolean } {
  const section = existing[configKey];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return { config: existing, removed: false };
  }

  const current = section as Record<string, unknown>;
  if (!(serverName in current)) {
    return { config: existing, removed: false };
  }

  const rest = Object.fromEntries(Object.entries(current).filter(([key]) => key !== serverName));
  const next = { ...existing };

  if (Object.keys(rest).length === 0) {
    delete next[configKey];
  } else {
    next[configKey] = rest;
  }

  return { config: next, removed: true };
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
