import { describe, it, expect } from "vitest";
import { stripJsonComments, mergeServerEntry, removeServerEntry } from "../mcp-writer.js";

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
