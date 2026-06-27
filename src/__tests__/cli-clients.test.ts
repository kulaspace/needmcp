import { describe, it, expect } from "vitest";
import { CLI_CLIENTS } from "../clients/cli.js";

describe("Claude Code buildCommand", () => {
  const claude = CLI_CLIENTS.find((c) => c.id === "claude-code")!;
  const url = "https://needmcp.com/mcp";
  const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

  it("uses HTTP transport (not stdio)", () => {
    const cmd = claude.buildCommand!(undefined, url);
    expect(cmd).toContain("--transport http");
  });

  it("does not reference the fiktive streamable-http npm package", () => {
    const cmd = claude.buildCommand!(undefined, url);
    expect(cmd).not.toContain("@modelcontextprotocol/server-streamable-http");
  });

  it("does not use stdio separator", () => {
    const cmd = claude.buildCommand!(undefined, url);
    expect(cmd).not.toMatch(/\s--\s/);
  });

  it("passes URL as positional arg, not via npx", () => {
    const cmd = claude.buildCommand!(undefined, url);
    expect(cmd).toContain(`'${url}'`);
    expect(cmd).not.toContain("npx");
  });

  it("appends --header with API key when provided", () => {
    const cmd = claude.buildCommand!(key, url);
    expect(cmd).toContain(`--header 'X-API-Key: ${key}'`);
  });

  it("places --header after the URL (Claude Code flag, not stdio arg)", () => {
    const cmd = claude.buildCommand!(key, url);
    const urlIdx = cmd.indexOf(url);
    const headerIdx = cmd.indexOf("--header");
    expect(headerIdx).toBeGreaterThan(urlIdx);
  });

  it("omits --header in guest mode (no API key)", () => {
    const cmd = claude.buildCommand!(undefined, url);
    expect(cmd).not.toContain("--header");
  });
});
