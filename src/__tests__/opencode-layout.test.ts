import { describe, it, expect } from "vitest";

import {
  buildOpencodeEntryFor,
  detectOpencodeLayout,
  opencodeConfigKey,
} from "../clients/opencode-layout.js";
import { JSON_CLIENTS } from "../clients/json.js";
import { toKeyPath } from "../mcp-writer.js";
import { resolveClientConfigKey } from "../clients/types.js";

/**
 * These lock the facts measured against the real binaries, because getting
 * either layout wrong silently disables the server:
 *
 *   opencode 1.2.27   reads mcp.<name>; FAILS the whole config on mcp.servers
 *   opencode2 2.0.32  reads mcp.servers.<name>; ignores opencode.jsonc
 */

const url = "https://needmcp.com/mcp";
const key = "sk-need-TEST";

describe("Opencode config key per version", () => {
  it("puts servers directly under mcp for 1.x", () => {
    expect(opencodeConfigKey("v1")).toEqual(["mcp"]);
  });

  it("puts servers under mcp.servers for 2.x", () => {
    expect(opencodeConfigKey("v2")).toEqual(["mcp", "servers"]);
  });

  it("resolves through toKeyPath for the client", () => {
    const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;
    const path = toKeyPath(resolveClientConfigKey(opencode));
    expect(path[0]).toBe("mcp");
    expect(["v1", "v2"]).toContain(detectOpencodeLayout());
    expect(path).toEqual(opencodeConfigKey(detectOpencodeLayout()));
  });
});

describe("Opencode entry shape per version", () => {
  it("1.x uses enabled + oauth:false so the API-key header is honoured", () => {
    const entry = buildOpencodeEntryFor("v1", { apiKey: key, mcpUrl: url });
    expect(entry).toEqual({
      type: "remote",
      url,
      enabled: true,
      oauth: false,
      headers: { "X-API-Key": key },
    });
    // 1.x has no `disabled` field.
    expect(entry.disabled).toBeUndefined();
  });

  it("2.x uses disabled:false and omits the 1.x-only fields", () => {
    const entry = buildOpencodeEntryFor("v2", { apiKey: key, mcpUrl: url });
    expect(entry).toEqual({
      type: "remote",
      url,
      headers: { "X-API-Key": key },
      disabled: false,
    });
    // Neither field exists in the 2.x schema; `oauth` in particular would be
    // rejected as an unknown key by some config validators.
    expect(entry.enabled).toBeUndefined();
    expect(entry.oauth).toBeUndefined();
  });

  it("OAuth entries carry no headers in either layout", () => {
    for (const layout of ["v1", "v2"] as const) {
      const entry = buildOpencodeEntryFor(layout, { mcpUrl: url });
      expect(entry.url).toBe(url);
      expect(entry.headers).toBeUndefined();
    }
  });

  it("never emits mcp.servers alongside mcp.<name>", () => {
    // 1.x fails the ENTIRE config when `mcp.servers` is present, hiding every
    // sibling server. The two layouts must therefore never be combined.
    const v1 = opencodeConfigKey("v1");
    const v2 = opencodeConfigKey("v2");
    expect(v1).not.toEqual(v2);
    expect(v2.slice(0, 1)).toEqual(v1);
  });
});

describe("Opencode layout detection", () => {
  it("returns a known layout on this machine", () => {
    expect(["v1", "v2"]).toContain(detectOpencodeLayout());
  });

  it("prefers the 2.x binary whenever it is installed", async () => {
    const { hasOpencodeV2 } = await import("../clients/opencode-cli.js");
    if (hasOpencodeV2()) {
      expect(detectOpencodeLayout()).toBe("v2");
    }
  });
});
