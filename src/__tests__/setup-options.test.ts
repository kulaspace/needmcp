import { describe, it, expect } from "vitest";
import { resolveSetupClient, resolveSetupScope } from "../setup.js";
import { CliError } from "../errors.js";

/**
 * These resolve the `--client` / `--scope` flags an AI agent passes. Both used
 * to be interactive-only, where a wrong value silently became a prompt.
 */
describe("resolveSetupClient", () => {
  it("finds a client by id", () => {
    expect(resolveSetupClient("opencode").name).toBe("Opencode");
  });

  it("lists the valid ids when the id is unknown", () => {
    let error: unknown;
    try {
      resolveSetupClient("not-a-client");
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as Error).message).toContain('Unknown client "not-a-client"');
    expect((error as Error).message).toContain("opencode");
  });
});

describe("resolveSetupScope", () => {
  it("returns the only available scope without a flag", () => {
    expect(resolveSetupScope(resolveSetupClient("windsurf"))).toBe("global");
    expect(resolveSetupScope(resolveSetupClient("vscode"))).toBe("project");
  });

  it("returns null when the client supports both and none was requested", () => {
    expect(resolveSetupScope(resolveSetupClient("opencode"))).toBeNull();
  });

  it("accepts a supported scope", () => {
    expect(resolveSetupScope(resolveSetupClient("opencode"), "project")).toBe("project");
  });

  it("rejects a scope the client has no path for", () => {
    expect(() => resolveSetupScope(resolveSetupClient("vscode"), "global")).toThrow(
      /does not support global scope/
    );
  });
});