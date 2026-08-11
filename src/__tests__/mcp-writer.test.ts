import { describe, it, expect } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stripJsonComments, mergeServerEntry, removeServerEntry, buildTomlBlock, appendTomlServer } from "../mcp-writer.js";

describe("stripJsonComments", () => {
  it("removes single-line comments", () => {
    const input = `{
      // comment
      "key": "value"
    }`;
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("removes multi-line comments", () => {
    const input = `{
      /* comment */
      "key": "value"
    }`;
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("handles trailing commas", () => {
    const input = `{
      "key": "value",
    }`;
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("preserves strings containing slashes", () => {
    const input = `{ "url": "https://example.com/api" }`;
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ url: "https://example.com/api" });
  });

  it("handles empty input", () => {
    expect(stripJsonComments("")).toBe("");
  });
});

describe("mergeServerEntry", () => {
  it("adds new server entry", () => {
    const existing = { mcpServers: {} };
    const { config, alreadyExists } = mergeServerEntry(existing, "mcpServers", "needmcp", { url: "http://test" });
    expect((config.mcpServers as Record<string, unknown>).needmcp).toEqual({ url: "http://test" });
    expect(alreadyExists).toBe(false);
  });

  it("detects existing server", () => {
    const existing = { mcpServers: { needmcp: { url: "http://old" } } };
    const { config, alreadyExists } = mergeServerEntry(existing, "mcpServers", "needmcp", { url: "http://new" });
    expect(((config.mcpServers as Record<string, Record<string, string>>).needmcp).url).toBe("http://new");
    expect(alreadyExists).toBe(true);
  });
});

describe("removeServerEntry", () => {
  it("removes existing entry", () => {
    const existing = { mcpServers: { needmcp: { url: "http://test" }, other: {} } };
    const { config, removed } = removeServerEntry(existing, "mcpServers", "needmcp");
    expect(removed).toBe(true);
    expect(config.mcpServers).toEqual({ other: {} });
  });

  it("returns false for non-existent entry", () => {
    const existing = { mcpServers: {} };
    const { removed } = removeServerEntry(existing, "mcpServers", "needmcp");
    expect(removed).toBe(false);
  });
});

describe("buildTomlBlock", () => {
  it("writes http_headers as inline table", () => {
    const block = buildTomlBlock("needmcp", {
      url: "https://needmcp.com/mcp",
      http_headers: { "X-API-Key": "sk-need-xxx" },
    });
    expect(block).toContain('[mcp_servers.needmcp]');
    expect(block).toContain('url = "https://needmcp.com/mcp"');
    expect(block).toContain('http_headers = { "X-API-Key" = "sk-need-xxx" }');
    expect(block).not.toContain("[mcp_servers.needmcp.http_headers]");
  });

  it("supports legacy headers key", () => {
    const block = buildTomlBlock("needmcp", {
      url: "https://needmcp.com/mcp",
      headers: { "X-API-Key": "sk-need-xxx" },
    });
    expect(block).toContain('http_headers = { "X-API-Key" = "sk-need-xxx" }');
  });

  it("omits http_headers in guest mode", () => {
    const block = buildTomlBlock("needmcp", { url: "https://needmcp.com/mcp" });
    expect(block).not.toContain("http_headers");
  });
});

describe("appendTomlServer", () => {
  async function tempFile(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "needmcp-test-"));
    return join(dir, "config.toml");
  }

  it("writes http_headers as inline table", async () => {
    const filePath = await tempFile();
    await appendTomlServer(filePath, "needmcp", {
      url: "https://needmcp.com/mcp",
      http_headers: { "X-API-Key": "sk-need-xxx" },
    });
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain('[mcp_servers.needmcp]');
    expect(raw).toContain('url = "https://needmcp.com/mcp"');
    expect(raw).toContain('http_headers = { "X-API-Key" = "sk-need-xxx" }');
    expect(raw).not.toContain("[mcp_servers.needmcp.http_headers]");
  });

  it("converts existing nested http_headers table to inline table", async () => {
    const filePath = await tempFile();
    await appendTomlServer(filePath, "needmcp", {
      url: "https://needmcp.com/mcp",
      http_headers: { "X-API-Key": "sk-need-old" },
    });

    await appendTomlServer(filePath, "needmcp", {
      url: "https://needmcp.com/mcp",
      http_headers: { "X-API-Key": "sk-need-new" },
    });

    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain('http_headers = { "X-API-Key" = "sk-need-new" }');
    expect(raw).not.toContain("[mcp_servers.needmcp.http_headers]");
    expect(raw).not.toContain("sk-need-old");
  });
});
