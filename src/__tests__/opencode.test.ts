import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JSON_CLIENTS } from "../clients/json.js";
import { resolveClientConfigKey } from "../clients/types.js";
import { buildOpencodeAuthArgs, OPENCODE_SERVER_NAME } from "../clients/opencode-cli.js";
import {
  mergeServerEntry,
  removeServerEntry,
  getSection,
  writeJsonConfig,
  readJsonConfig,
  hasJsonComments,
} from "../mcp-writer.js";

const url = "https://needmcp.com/mcp";
const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

describe("Opencode client registration", () => {
  it("exposes exactly two Opencode clients", () => {
    const matches = JSON_CLIENTS.filter((c) => c.id.startsWith("opencode"));
    expect(matches).toHaveLength(2);
    expect(matches.map((c) => c.id)).toEqual(["opencode", "opencode2"]);
  });

  it("is marked native OAuth capable and scope-prompting", () => {
    expect(opencode.supportsNativeOAuth).toBe(true);
    expect(opencode.requiresScopeChoice).toBe(true);
    expect(opencode.oauth?.mode).toBe("native");
  });

  it("never runs `mcp add` — the file is written by hand", () => {
    expect(opencode.oauth!.addArgs!(url, "global")).toBeNull();
  });

  it("authenticates with `opencode mcp auth needmcp`", () => {
    expect(opencode.oauth!.loginArgs!()).toEqual(["mcp", "auth", "needmcp"]);
  });

  it("is detected by its binary, so it appears before a config file exists", () => {
    // Without detectPaths a fresh install reads as "not found" and sinks to the
    // bottom of the picker, which is indistinguishable from "not supported".
    expect(opencode.detectPaths).toEqual(["opencode"]);
  });

  it("has exactly one entry regardless of which Opencode name is installed", () => {
    // Both names write the same file, so there is no per-version variant.
    const ids = JSON_CLIENTS.map((c) => c.id).filter((id) => id.includes("opencode"));
    expect(ids).toEqual(["opencode", "opencode2"]);
  });
});

describe("checkJsonClient honours detectPaths", () => {
  it("reports a JSON client as detected when its binary is on PATH but no config exists", async () => {
    const { detectClient } = await import("../clients/index.js");
    const paths = await mkdtemp(join(tmpdir(), "needmcp-detect-"));
    try {
      // A client whose config cannot exist here, but whose binary is certainly
      // on PATH (this machine runs the tests with node).
      const probe = {
        ...opencode,
        globalPaths: [join(paths, "nope.jsonc")],
        projectPaths: [],
        detectPaths: [process.platform === "win32" ? "where" : "which"],
      };
      const detected = await detectClient(probe, "global");
      expect(detected.configured).toBe(false);
      expect(detected.detected).toBe(true);
    } finally {
      await rm(paths, { recursive: true, force: true });
    }
  });
});

describe("Opencode config paths", () => {
  it("targets opencode.jsonc only", () => {
    expect(opencode.globalPaths).toHaveLength(1);
    expect(opencode.globalPaths![0].endsWith(join("opencode", "opencode.jsonc"))).toBe(true);
    expect(opencode.projectPaths).toEqual(["opencode.jsonc"]);
  });

  it("never treats opencode.json as a read or write target", () => {
    for (const p of [
      ...(opencode.globalPaths ?? []),
      ...(opencode.projectPaths ?? []),
      ...(opencode.legacyPaths ?? []),
      ...(opencode.legacyProjectPaths ?? []),
    ]) {
      expect(p.endsWith("opencode.json")).toBe(false);
    }
  });
});

describe("Opencode config shape", () => {
  it("nests the server under mcp, never mcp.servers", () => {
    const key = resolveClientConfigKey(opencode);
    expect(Array.isArray(key) ? key : [key]).toEqual(["mcp"]);
  });

  it("writes the API-key entry exactly as specified", () => {
    expect(opencode.buildEntry!(key, url)).toEqual({
      type: "remote",
      url,
      enabled: true,
      headers: { "X-API-Key": key },
    });
  });

  it("writes the OAuth entry exactly as specified", () => {
    expect(opencode.oauth!.buildEntry!(url)).toEqual({
      type: "remote",
      url,
      enabled: true,
    });
  });

  it("omits headers when no key is supplied", () => {
    const entry = opencode.buildEntry!(undefined, url);
    expect(entry).toEqual({ type: "remote", url, enabled: true });
    expect(entry).not.toHaveProperty("headers");
  });

  it("never writes oauth or disabled — neither is in the agreed format", () => {
    for (const entry of [opencode.buildEntry!(key, url), opencode.oauth!.buildEntry!(url)]) {
      expect(entry).not.toHaveProperty("oauth");
      expect(entry).not.toHaveProperty("disabled");
    }
  });
});

describe("Opencode config merging", () => {
  // A realistic global config: unrelated top-level keys plus sibling servers.
  function realWorldConfig() {
    return {
      $schema: "https://opencode.ai/config.json",
      model: { providerID: "9router", model: "Muse" },
      agents: { explorer: { mode: "subagent" } },
      mcp: {
        context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
        github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
        mxterm: { type: "local", command: ["mxterm"] },
      },
    };
  }

  it("adds needmcp without clobbering anything else", () => {
    const existing = realWorldConfig();

    const { config, alreadyExists } = mergeServerEntry(
      existing,
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );

    expect(alreadyExists).toBe(false);
    // Unrelated config survives untouched.
    expect(config.$schema).toBe(existing.$schema);
    expect(config.model).toEqual(existing.model);
    expect(config.agents).toEqual(existing.agents);
    // Every sibling server survives, in order, with needmcp appended.
    const mcp = getSection(config, ["mcp"])!;
    expect(Object.keys(mcp)).toEqual(["context7", "github", "mxterm", "needmcp"]);
    expect(mcp.context7).toEqual(existing.mcp.context7);
    expect(mcp.needmcp).toEqual(opencode.buildEntry!(key, url));
  });

  it("preserves an existing mcp object that is not yet present", () => {
    const { config } = mergeServerEntry({ $schema: "x" }, ["mcp"], "needmcp", {});
    expect(config).toEqual({ $schema: "x", mcp: { needmcp: {} } });
  });

  it("reports alreadyExists when the entry is rewritten", () => {
    const first = mergeServerEntry({}, ["mcp"], OPENCODE_SERVER_NAME, opencode.buildEntry!(key, url));
    const second = mergeServerEntry(
      first.config,
      ["mcp"],
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

describe("Opencode file round-trip", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "needmcp-oc-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("edits opencode.jsonc in place and keeps every existing key", async () => {
    const target = join(dir, "opencode.jsonc");
    const original = {
      $schema: "https://opencode.ai/config.json",
      model: { providerID: "9router", model: "Muse" },
      mcp: { context7: { type: "remote", url: "https://mcp.context7.com/mcp" } },
    };
    await writeFile(target, JSON.stringify(original, null, 2));

    const existing = await readJsonConfig(target);
    const { config } = mergeServerEntry(
      existing,
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.buildEntry!(key, url)
    );
    await writeJsonConfig(target, config);

    const written = await readJsonConfig(target);
    expect(written.$schema).toBe(original.$schema);
    expect(written.model).toEqual(original.model);
    expect(getSection(written, ["mcp"])).toEqual({
      context7: original.mcp.context7,
      needmcp: opencode.buildEntry!(key, url),
    });
  });

  it("creates opencode.jsonc when it does not exist yet", async () => {
    const target = join(dir, "opencode.jsonc");
    const { config } = mergeServerEntry(
      {},
      resolveClientConfigKey(opencode),
      OPENCODE_SERVER_NAME,
      opencode.oauth!.buildEntry!(url)
    );
    await writeJsonConfig(target, config);

    const raw = await readFile(target, "utf-8");
    expect(JSON.parse(raw)).toEqual({ mcp: { needmcp: opencode.oauth!.buildEntry!(url) } });
  });

  it("reads a commented .jsonc file", async () => {
    const target = join(dir, "opencode.jsonc");
    await writeFile(
      target,
      '{\n  // my config\n  "mcp": {\n    "context7": { "type": "remote" } // keep me\n  }\n}\n'
    );

    const parsed = await readJsonConfig(target);
    expect(parsed).toEqual({ mcp: { context7: { type: "remote" } } });
  });

  it("never touches a sibling opencode.json", async () => {
    const jsonc = join(dir, "opencode.jsonc");
    const json = join(dir, "opencode.json");
    const legacyBody = { mcp: { old: {} } };
    await writeFile(json, JSON.stringify(legacyBody, null, 2));

    const { config } = mergeServerEntry({}, ["mcp"], OPENCODE_SERVER_NAME, opencode.buildEntry!(key, url));
    await writeJsonConfig(jsonc, config);

    const after = await readJsonConfig(json);
    expect(after).toEqual(legacyBody);
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

describe("Opencode auth command", () => {
  it("builds the auth argv for the registered server name", () => {
    expect(buildOpencodeAuthArgs()).toEqual(["mcp", "auth", "needmcp"]);
  });
});
