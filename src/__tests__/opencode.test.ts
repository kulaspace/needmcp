import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JSON_CLIENTS } from "../clients/json.js";
import { resolveClientConfigKey } from "../clients/types.js";
import { detectOpencodeLayout } from "../clients/opencode-layout.js";
import {
  buildOpencodeAddArgs,
  buildOpencodeAuthArgs,
  OPENCODE_SERVER_NAME,
} from "../clients/opencode-cli.js";
import {
  mergeServerEntry,
  removeServerEntry,
  getSection,
  cleanupStrayEntry,
  writeJsonConfig,
  readJsonConfig,
  hasJsonComments,
  loadMigrationSource,
} from "../mcp-writer.js";

const url = "https://needmcp.com/mcp";
const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

describe("Opencode client registration", () => {
  it("exposes exactly one Opencode client", () => {
    const matches = JSON_CLIENTS.filter((c) => c.id.startsWith("opencode"));
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("opencode");
    expect(matches[0].name).toBe("Opencode");
  });

  it("never registers an opencode-v2 client (mcp.servers is invalid in 1.x)", () => {
    expect(JSON_CLIENTS.find((c) => c.id === "opencode-v2")).toBeUndefined();
  });

  it("is marked native OAuth capable and scope-prompting", () => {
    expect(opencode.supportsNativeOAuth).toBe(true);
    expect(opencode.requiresScopeChoice).toBe(true);
    expect(opencode.oauth?.mode).toBe("native");
  });
});

describe("Opencode config paths", () => {
  // Verified against both real binaries: 2.x ignores `opencode.jsonc` entirely
  // ("No MCP servers configured"), while `opencode.json` is read by 1.2.27 and
  // 2.0.32 alike. Only one filename therefore serves both versions.
  it("targets opencode.json only", () => {
    expect(opencode.globalPaths).toHaveLength(1);
    expect(opencode.globalPaths![0].endsWith(join("opencode", "opencode.json"))).toBe(true);
    expect(opencode.projectPaths).toEqual(["opencode.json"]);
  });

  it("never writes opencode.jsonc (2.x does not read it)", () => {
    for (const p of [...(opencode.globalPaths ?? []), ...(opencode.projectPaths ?? [])]) {
      expect(p.endsWith(".jsonc")).toBe(false);
    }
  });

  it("reads opencode.jsonc once as a legacy source", () => {
    expect(opencode.legacyPaths).toBeDefined();
    expect(opencode.legacyPaths!.some((p) => p.endsWith("opencode.jsonc"))).toBe(true);
    expect(opencode.legacyProjectPaths).toEqual(["opencode.jsonc"]);
  });
});

describe("Opencode entry shape", () => {
  // The layout is decided by the installed binary, so these assert against the
  // version actually present rather than pinning one shape.
  const layout = detectOpencodeLayout();
  const isV2 = layout === "v2";

  it("nests under mcp for 1.x and mcp.servers for 2.x", () => {
    const keyPath = resolveClientConfigKey(opencode);
    expect(keyPath).toEqual(isV2 ? ["mcp", "servers"] : ["mcp"]);
  });

  it("matches the shape the installed version expects", () => {
    const entry = opencode.buildEntry!(key, url);
    expect(entry).toEqual(
      isV2
        ? { type: "remote", url, headers: { "X-API-Key": key }, disabled: false }
        : { type: "remote", url, enabled: true, oauth: false, headers: { "X-API-Key": key } }
    );
  });

  it("keeps the server enabled in API-key mode", () => {
    // Verified: with OAuth left active the client ignores `X-API-Key` and
    // parks the server at "needs authentication". 1.x spells this `oauth:false`,
    // 2.x `disabled:false`; either way the entry must be live and keyed.
    const entry = opencode.buildEntry!(key, url);
    expect(entry.headers).toEqual({ "X-API-Key": key });
    if (isV2) {
      expect(entry.disabled).toBe(false);
      expect(entry).not.toHaveProperty("enabled");
    } else {
      expect(entry.oauth).toBe(false);
      expect(entry.enabled).toBe(true);
    }
  });

  it("omits headers when no key is supplied", () => {
    const entry = opencode.buildEntry!(undefined, url);
    expect(entry.url).toBe(url);
    expect(entry).not.toHaveProperty("headers");
    expect(entry).not.toHaveProperty("oauth");
  });

  it("writes a header-free entry in OAuth mode", () => {
    const entry = opencode.oauth!.buildEntry!(url);
    expect(entry.type).toBe("remote");
    expect(entry.url).toBe(url);
    expect(entry).not.toHaveProperty("headers");
    // OAuth mode must NOT disable sign-in.
    expect(entry).not.toHaveProperty("oauth");
  });

  it("never mixes the two layouts", () => {
    // 1.x fails the WHOLE config on `mcp.servers`, so a key must not contain
    // both shapes at once.
    const keyPath = resolveClientConfigKey(opencode) as string[];
    expect(keyPath.filter((k) => k === "servers").length).toBeLessThanOrEqual(1);
  });
});

describe("Opencode config merging", () => {
  // 1.x keeps servers directly under `mcp`; 2.x nests them one level down, so
  // the fixture has to match the layout the installed binary reads.
  const serversAt = detectOpencodeLayout() === "v2" ? ["mcp", "servers"] : ["mcp"];
  const siblings = {
    context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
    github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
    mxterm: { type: "local", command: ["mxterm"] },
  };

  function configWithSiblings() {
    // Place siblings exactly where the client looks for servers.
    const root: Record<string, unknown> = { $schema: "https://opencode.ai/config.json" };
    let node = root;
    for (const seg of serversAt) {
      const next: Record<string, unknown> = {};
      node[seg] = next;
      node = next;
    }
    Object.assign(node, siblings);
    return root as { $schema: string; mcp: Record<string, unknown> };
  }

  it("merges needmcp without clobbering siblings", () => {
    const existing = configWithSiblings();

    const { config } = mergeServerEntry(
      existing,
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );

    expect(config.$schema).toBe(existing.$schema);
    const servers = getSection(config, serversAt)!;
    expect(Object.keys(servers)).toEqual(["context7", "github", "mxterm", "needmcp"]);
    expect(servers.context7).toEqual(siblings.context7);
    expect(servers.github).toEqual(siblings.github);
    expect(servers.mxterm).toEqual(siblings.mxterm);
  });

  it("preserves top-level keys unrelated to mcp", () => {
    const existing = { $schema: "x", model: "anthropic/claude", mcp: {} };
    const { config } = mergeServerEntry(
      existing,
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );
    expect(config.model).toBe("anthropic/claude");
  });

  it("reports alreadyExists on a second write", () => {
    const first = mergeServerEntry({}, resolveClientConfigKey(opencode), OPENCODE_SERVER_NAME, opencode.buildEntry!(key, url));
    const second = mergeServerEntry(
      first.config,
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );
    expect(first.alreadyExists).toBe(false);
    expect(second.alreadyExists).toBe(true);
  });

  it("removal keeps other servers", () => {
    const existing = { mcp: { needmcp: {}, context7: {} } };
    const { config, removed } = removeServerEntry(existing, ["mcp"], "needmcp");
    expect(removed).toBe(true);
    expect(getSection(config, ["mcp"])).toEqual({ context7: {} });
  });

  it("removal of the last server prunes the empty mcp object", () => {
    const existing = { $schema: "x", mcp: { needmcp: {} } };
    const { config } = removeServerEntry(existing, ["mcp"], "needmcp");
    expect(config).toEqual({ $schema: "x" });
  });
});

describe("Opencode stray mcp.servers cleanup", () => {
  it("removes a stale mcp.servers.needmcp entry", () => {
    const existing = {
      $schema: "x",
      mcp: {
        context7: { type: "remote" },
        servers: { needmcp: { type: "remote" } },
      },
    };

    const { config, removed } = cleanupStrayEntry(existing, ["mcp"], "needmcp");
    expect(removed).toBe(true);
    const mcp = getSection(config, ["mcp"])!;
    expect(mcp.servers).toBeUndefined();
    expect(mcp.context7).toEqual({ type: "remote" });
  });

  it("keeps sibling entries under a stray mcp.servers", () => {
    const existing = { mcp: { servers: { needmcp: {}, other: {} } } };
    const { config } = cleanupStrayEntry(existing, ["mcp"], "needmcp");
    expect(getSection(config, ["mcp", "servers"])).toEqual({ other: {} });
  });

  it("is a no-op when there is no stray entry", () => {
    const existing = { mcp: { context7: {} } };
    const { config, removed } = cleanupStrayEntry(existing, ["mcp"], "needmcp");
    expect(removed).toBe(false);
    expect(config).toBe(existing);
  });

  it("is a no-op for clients whose real key is mcp.servers", () => {
    const existing = { mcp: { servers: { needmcp: {} } } };
    const { removed } = cleanupStrayEntry(existing, ["mcp", "servers"], "needmcp");
    expect(removed).toBe(false);
  });
});

describe("Opencode CLI command builders", () => {
  it("builds the auth argv for the registered server name", () => {
    expect(buildOpencodeAuthArgs()).toEqual(["mcp", "auth", "needmcp"]);
  });

  it("builds `mcp add` with key=value headers and --global only for global scope", () => {
    const args = buildOpencodeAddArgs({ mcpUrl: url, scope: "global", apiKey: key });
    expect(args).toEqual([
      "mcp", "add", "needmcp",
      "--url", url,
      "--header", `X-API-Key=${key}`,
      "--global",
    ]);
    // `--header` must use `=`: Opencode rejects `X-API-Key: value`.
    const header = args[args.indexOf("--header") + 1];
    expect(header).toContain("=");
    expect(header).not.toContain(": ");
  });

  it("omits --global and the header where appropriate", () => {
    const project = buildOpencodeAddArgs({ mcpUrl: url, scope: "project", apiKey: key });
    expect(project).not.toContain("--global");

    const oauth = buildOpencodeAddArgs({ mcpUrl: url, scope: "global" });
    expect(oauth).not.toContain("--header");
    expect(oauth).toEqual(["mcp", "add", "needmcp", "--url", url, "--global"]);
  });
});

describe("Opencode migration from opencode.jsonc to opencode.json", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "needmcp-oc-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds opencode.json from an existing opencode.jsonc", async () => {
    const legacy = join(dir, "opencode.jsonc");
    const target = join(dir, "opencode.json");
    // The legacy file carries its sibling where the installed client looks for
    // servers, so the merge target and the source agree.
    const serversAt = resolveClientConfigKey(opencode);
    const legacyBody =
      detectOpencodeLayout() === "v2"
        ? { $schema: "x", mcp: { servers: { context7: { type: "remote" } } } }
        : { $schema: "x", mcp: { context7: { type: "remote" } } };
    await writeFile(legacy, JSON.stringify(legacyBody, null, 2));

    const source = await loadMigrationSource(target, [legacy]);
    expect(source).not.toBeNull();
    expect(source!.from).toBe(legacy);

    const { config } = mergeServerEntry(
      source!.config,
      serversAt,
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );
    await writeJsonConfig(target, config);

    const written = await readJsonConfig(target);
    const servers = getSection(written, serversAt)!;
    expect(Object.keys(servers)).toEqual(["context7", "needmcp"]);
    expect(servers.needmcp).toEqual(opencode.buildEntry!(key, url));

    // The legacy file must be left untouched.
    const legacyAfter = await readJsonConfig(legacy);
    expect(legacyAfter).toEqual(legacyBody);
  });

  it("does not migrate when the target already exists", async () => {
    const legacy = join(dir, "opencode.jsonc");
    const target = join(dir, "opencode.json");
    await writeFile(legacy, JSON.stringify({ mcp: { old: {} } }));
    await writeFile(target, JSON.stringify({ mcp: { existing: {} } }));

    const source = await loadMigrationSource(target, [legacy]);
    expect(source).toBeNull();
  });

  it("returns null when no legacy file exists", async () => {
    const source = await loadMigrationSource(join(dir, "opencode.json"), [
      join(dir, "opencode.jsonc"),
    ]);
    expect(source).toBeNull();
  });

  it("ignores an empty legacy file", async () => {
    const legacy = join(dir, "opencode.jsonc");
    await writeFile(legacy, "{}");
    const source = await loadMigrationSource(join(dir, "opencode.json"), [legacy]);
    expect(source).toBeNull();
  });
});

describe("hasJsonComments", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "needmcp-cmt-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("detects line comments", async () => {
    const f = join(dir, "c.jsonc");
    await writeFile(f, '{\n  // hi\n  "mcp": {}\n}\n');
    expect(await hasJsonComments(f)).toBe(true);
  });

  it("detects block comments", async () => {
    const f = join(dir, "c.jsonc");
    await writeFile(f, '{ /* x */ "mcp": {} }');
    expect(await hasJsonComments(f)).toBe(true);
  });

  it("does not flag // inside a string value", async () => {
    const f = join(dir, "c.json");
    await writeFile(f, JSON.stringify({ url: "https://needmcp.com/mcp" }));
    expect(await hasJsonComments(f)).toBe(false);
  });

  it("returns false for a missing file", async () => {
    expect(await hasJsonComments(join(dir, "nope.jsonc"))).toBe(false);
  });

  it("survives directories with nested paths", async () => {
    const nested = join(dir, "a", "b");
    await mkdir(nested, { recursive: true });
    const f = join(nested, "opencode.jsonc");
    await writeFile(f, '{"mcp":{}}');
    expect(await hasJsonComments(f)).toBe(false);
  });
});
