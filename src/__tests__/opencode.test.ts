import { describe, it, expect } from "vitest";
import { JSON_CLIENTS } from "../clients/json.js";
import {
  buildOpencodeAddArgs,
  buildOpencodeAuthArgs,
  OPENCODE_SERVER_NAME,
} from "../clients/opencode-cli.js";
import { mergeServerEntry, removeServerEntry, getSection } from "../mcp-writer.js";

const url = "https://needmcp.com/mcp";
const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

const v1 = JSON_CLIENTS.find((c) => c.id === "opencode")!;
const v2 = JSON_CLIENTS.find((c) => c.id === "opencode-v2")!;

describe("Opencode client entries", () => {
  it("exposes both v1 and v2 variants", () => {
    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    expect(v1.name).toBe("Opencode");
    expect(v2.name).toBe("Opencode (v2)");
  });

  it("marks both variants as native OAuth capable and scope-prompting", () => {
    for (const client of [v1, v2]) {
      expect(client.supportsNativeOAuth).toBe(true);
      expect(client.requiresScopeChoice).toBe(true);
    }
  });

  it("writes opencode.jsonc before opencode.json", () => {
    for (const client of [v1, v2]) {
      expect(client.globalPaths![0].endsWith("opencode.jsonc")).toBe(true);
      expect(client.projectPaths![0]).toBe("opencode.jsonc");
    }
  });
});

describe("Opencode v1 entry shape", () => {
  it("targets the flat mcp key", () => {
    expect(v1.configKey).toEqual(["mcp"]);
  });

  it("sets type remote, enabled true and the API key header", () => {
    const entry = v1.buildEntry!(key, url);
    expect(entry).toEqual({
      type: "remote",
      url,
      enabled: true,
      headers: { "X-API-Key": key },
    });
  });

  it("still uses enabled:true in guest mode (no key)", () => {
    const entry = v1.buildEntry!(undefined, url);
    expect(entry.enabled).toBe(true);
    expect(entry).not.toHaveProperty("headers");
  });
});

describe("Opencode v2 entry shape", () => {
  it("targets mcp.servers, not flat mcp", () => {
    expect(v2.configKey).toEqual(["mcp", "servers"]);
  });

  it("omits enabled and uses disabled semantics instead", () => {
    const entry = v2.buildEntry!(key, url);
    expect(entry).not.toHaveProperty("enabled");
    expect(entry).not.toHaveProperty("disabled");
    expect(entry).toEqual({ type: "remote", url, headers: { "X-API-Key": key } });
  });

  it("never sets oauth:false", () => {
    const entry = v2.buildEntry!(key, url);
    expect(entry).not.toHaveProperty("oauth");
  });
});

describe("nested config writing for Opencode", () => {
  it("v2 merges into mcp.servers.needmcp without clobbering siblings", () => {
    const existing = { $schema: "https://opencode.ai/config.json", mcp: { servers: { other: { type: "remote" } } } };
    const { config } = mergeServerEntry(existing, v2.configKey!, OPENCODE_SERVER_NAME, v2.buildEntry!(key, url));

    expect(config.$schema).toBe(existing.$schema);
    const servers = getSection(config, ["mcp", "servers"])!;
    expect(Object.keys(servers)).toEqual(["other", "needmcp"]);
  });

  it("v2 removal prunes the emptied servers and mcp objects", () => {
    const existing = { $schema: "x", mcp: { servers: { needmcp: { type: "remote" } } } };
    const { config, removed } = removeServerEntry(existing, v2.configKey!, OPENCODE_SERVER_NAME);

    expect(removed).toBe(true);
    expect(config).toEqual({ $schema: "x" });
  });

  it("v2 removal keeps servers when other entries remain", () => {
    const existing = { mcp: { servers: { needmcp: {}, other: {} } } };
    const { config } = removeServerEntry(existing, v2.configKey!, OPENCODE_SERVER_NAME);

    expect(getSection(config, ["mcp", "servers"])).toEqual({ other: {} });
  });
});

describe("Opencode CLI command builders", () => {
  it("builds the remote-add argv", () => {
    expect(buildOpencodeAddArgs("v1", "global", url)).toEqual([
      "mcp", "add", "needmcp", "--url", url,
    ]);
  });

  it("adds --global for v2 global scope only", () => {
    expect(buildOpencodeAddArgs("v2", "global", url)).toContain("--global");
    expect(buildOpencodeAddArgs("v2", "project", url)).not.toContain("--global");
  });

  it("never passes --global for v1 (undocumented there)", () => {
    expect(buildOpencodeAddArgs("v1", "global", url)).not.toContain("--global");
  });

  it("builds the auth argv for the registered server name", () => {
    expect(buildOpencodeAuthArgs()).toEqual(["mcp", "auth", "needmcp"]);
  });
});
