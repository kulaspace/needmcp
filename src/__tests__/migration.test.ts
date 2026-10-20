import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  mergeServerEntry,
  readJsonConfig,
  writeJsonConfig,
  removeServerEntry,
} from "../mcp-writer.js";
import { resolveClientConfigKey } from "../clients/types.js";

const url = "https://needmcp.com/mcp";
const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "needmcp-migrate-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("Auth-mode migration in a real config file", () => {
  it("drops the X-API-Key header when switching API key -> OAuth", async () => {
    const file = join(dir, "mcp.json");

    // 1. Existing user config: NeedMCP configured with an API key, plus an
    //    unrelated server and top-level keys that must survive.
    const initial = {
      theme: "dark",
      mcpServers: {
        needmcp: { url, headers: { "X-API-Key": key } },
        other: { url: "https://example.com/mcp", headers: { "X-API-Key": "other-key" } },
      },
    };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf-8");

    // 2. User re-runs setup and picks OAuth.
    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", { url });
    await writeJsonConfig(file, config);

    // 3. NeedMCP's entry is header-free so the OAuth token is used...
    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcpServers.needmcp).toEqual({ url });
    expect(written.mcpServers.needmcp.headers).toBeUndefined();
    expect(JSON.stringify(written.mcpServers.needmcp)).not.toContain(key);

    // ...and nothing else was touched.
    expect(written.theme).toBe("dark");
    expect(written.mcpServers.other).toEqual(initial.mcpServers.other);
  });

  it("restores the header when switching OAuth -> API key", async () => {
    const file = join(dir, "mcp.json");
    await writeFile(
      file,
      JSON.stringify({ mcpServers: { needmcp: { url } } }, null, 2),
      "utf-8"
    );

    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", {
      url,
      headers: { "X-API-Key": key },
    });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcpServers.needmcp.headers).toEqual({ "X-API-Key": key });
  });

  it("preserves sibling servers when the entry is replaced", async () => {
    const file = join(dir, "mcp.json");
    await writeFile(
      file,
      JSON.stringify(
        {
          mcpServers: {
            alpha: { url: "https://alpha.example/mcp" },
            needmcp: { url, headers: { "X-API-Key": key, "X-Custom": "keep-me" } },
            beta: { command: "npx", args: ["-y", "some-server"] },
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", { url });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcpServers.alpha).toEqual({ url: "https://alpha.example/mcp" });
    expect(written.mcpServers.beta).toEqual({ command: "npx", args: ["-y", "some-server"] });
    // Documented behaviour: the needmcp entry is replaced wholesale, so a
    // stale custom header does not survive an auth-mode change.
    expect(written.mcpServers.needmcp).toEqual({ url });
  });

  it("handles nested config keys (generic mcp.servers) during migration", async () => {
    const file = join(dir, "opencode.json");

    const initial = {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        servers: {
          needmcp: { type: "remote", url, headers: { "X-API-Key": key } },
          other: { type: "remote", url: "https://other.example/mcp" },
        },
      },
    };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf-8");

    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, ["mcp", "servers"], "needmcp", {
      type: "remote",
      url,
    });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcp.servers.needmcp).toEqual({ type: "remote", url });
    expect(written.mcp.servers.other).toEqual(initial.mcp.servers.other);
    expect(written.$schema).toBe(initial.$schema);
  });

  it("survives a config that does not exist yet", async () => {
    const file = join(dir, "nested", "deep", "mcp.json");
    const existing = await readJsonConfig(file);
    expect(existing).toEqual({});

    const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", { url });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcpServers.needmcp).toEqual({ url });
  });

  it("keeps unrelated top-level keys byte-identical", async () => {
    const file = join(dir, "mcp.json");
    const initial = {
      "editor.fontSize": 14,
      servers: { keep: { url: "https://keep.example/mcp" } },
    };
    await writeFile(file, JSON.stringify(initial), "utf-8");

    const existing = await readJsonConfig(file);
    // VS Code writes under `servers`, not `mcpServers`.
    const { config } = mergeServerEntry(existing, "servers", "needmcp", {
      type: "http",
      url,
    });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written["editor.fontSize"]).toBe(14);
    expect(written.servers.keep).toEqual({ url: "https://keep.example/mcp" });
    expect(written.servers.needmcp).toEqual({ type: "http", url });
  });

  it("remove then re-add leaves a clean OAuth entry", async () => {
    const file = join(dir, "mcp.json");
    await writeFile(
      file,
      JSON.stringify({ mcpServers: { needmcp: { url, headers: { "X-API-Key": key } } } }),
      "utf-8"
    );

    const existing = await readJsonConfig(file);
    const { config: removed, removed: didRemove } = removeServerEntry(
      existing,
      "mcpServers",
      "needmcp"
    );
    expect(didRemove).toBe(true);
    await writeJsonConfig(file, removed);

    const afterRemove = await readJsonConfig(file);
    const { config } = mergeServerEntry(afterRemove, "mcpServers", "needmcp", { url });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcpServers.needmcp).toEqual({ url });
    expect(JSON.stringify(written)).not.toContain(key);
  });

  it("never persists an OAuth access token to a client config", async () => {
    // Guards the design rule: access tokens live 1h and only the client stores
    // them. A `mcp_at_*` value must never end up in a written config.
    const fakeToken = "mcp_at_" + "a".repeat(64);
    const file = join(dir, "mcp.json");

    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, "mcpServers", "needmcp", { url });
    await writeJsonConfig(file, config);

    const raw = await readFile(file, "utf-8");
    expect(raw).not.toContain("mcp_at_");
    expect(raw).not.toContain(fakeToken);
  });
});

describe("JSONC configs survive migration", () => {
  it("preserves comments-stripped content when rewriting", async () => {
    const file = join(dir, "opencode.jsonc");
    await mkdir(dir, { recursive: true });
    await writeFile(
      file,
      `{
        // user comment
        "mcp": {
          "needmcp": { "type": "remote", "url": "${url}", "headers": { "X-API-Key": "${key}" } }
        }
      }`,
      "utf-8"
    );

    const existing = await readJsonConfig(file);
    const { config } = mergeServerEntry(existing, "mcp", "needmcp", {
      type: "remote",
      url,
    });
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.mcp.needmcp).toEqual({ type: "remote", url });
  });
});

describe("Opencode writes opencode.jsonc, never opencode.json", () => {
  it("lists opencode.jsonc as the only write target", async () => {
    const { JSON_CLIENTS } = await import("../clients/json.js");
    const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

    expect(opencode.projectPaths).toEqual(["opencode.jsonc"]);
    expect(opencode.globalPaths).toHaveLength(1);
    expect(opencode.globalPaths![0].endsWith("opencode.jsonc")).toBe(true);
    // There is no longer a legacy read source: the single format is written
    // straight into .jsonc, so nothing is migrated out of another file.
    expect(opencode.legacyPaths ?? []).toHaveLength(0);
    expect(opencode.legacyProjectPaths ?? []).toHaveLength(0);
  });

  it("preserves every existing key when the entry is added", async () => {
    const { JSON_CLIENTS } = await import("../clients/json.js");
    const { mergeServerEntry, getSection } = await import("../mcp-writer.js");
    const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

    const file = join(dir, "opencode.jsonc");
    const original = {
      $schema: "https://opencode.ai/config.json",
      model: { providerID: "9router", model: "Muse" },
      mcp: {
        context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
        github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
      },
    };
    await writeFile(file, JSON.stringify(original, null, 2), "utf-8");

    const existing = JSON.parse(await readFile(file, "utf-8"));
    const { config } = mergeServerEntry(
      existing,
      resolveClientConfigKey(opencode),
      "needmcp",
      opencode.buildEntry!(key, url)
    );
    await writeJsonConfig(file, config);

    const written = JSON.parse(await readFile(file, "utf-8"));
    expect(written.$schema).toBe(original.$schema);
    expect(written.model).toEqual(original.model);
    expect(getSection(written, ["mcp"])).toEqual({
      context7: original.mcp.context7,
      github: original.mcp.github,
      needmcp: opencode.buildEntry!(key, url),
    });
  });
});
