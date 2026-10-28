import { describe, it, expect } from "vitest";
import { JSON_CLIENTS } from "../clients/json.js";
import { CLI_CLIENTS } from "../clients/cli.js";
import { TOML_CLIENTS } from "../clients/toml.js";
import { allClients } from "../clients/index.js";
import { buildOpencodeAuthArgs } from "../clients/opencode-cli.js";
import {
  buildAmpAddArgs,
  buildClaudeCodeAddArgs,
  buildCodexAddArgs,
  buildCodexLoginArgs,
  buildFactoryAddArgs,
  buildGeminiAddArgs,
  buildKiloAddArgs,
  buildKiloAuthArgs,
  buildQwenAddArgs,
  crushOAuthEntry,
  cursorOAuthEntry,
  formatOAuthCommand,
  geminiOAuthExtra,
  kiroOAuthEntry,
  vscodeOAuthEntry,
  zedOAuthEntry,
} from "../clients/oauth-clients.js";

const url = "https://needmcp.com/mcp";
const key = "sk-need-Sgy1p3r25UD4qQErwF2g";

describe("ClientConfig OAuth capability", () => {
  it("never declares OAuth for clients documented as API-key only", () => {
    // Windsurf, JetBrains, Trae, Antigravity, Amazon Q, LM Studio, Visual
    // Studio, Copilot CLI are API-key only or OAuth-unstable.
    const unsupported = [
      "windsurf",
      "trae",
      "google-antigravity",
      "copilot-cli",
      "claude-desktop",
      "visual-studio",
    ];
    for (const id of unsupported) {
      const client = allClients().find((c) => c.id === id);
      expect(client, `missing client ${id}`).toBeDefined();
      expect(client!.oauth, `${id} should have no OAuth capability`).toBeUndefined();
    }
  });

  it("declares OAuth for the verified OAuth-capable clients", () => {
    const expected = [
      "claude-code",
      "amp",
      "factory",
      "qwen-code",
      "openai-codex",
      "gemini-cli",
      "kilo-code",
      "cursor",
      "vscode",
      "zed",
      "kiro",
      "crush",
      "opencode",
      "opencode2",
    ];
    for (const id of expected) {
      const client = allClients().find((c) => c.id === id);
      expect(client, `missing client ${id}`).toBeDefined();
      expect(client!.oauth, `${id} should have OAuth capability`).toBeDefined();
      expect(client!.oauth!.mode).not.toBe("unsupported");
    }
  });

  it("gives every native client a binary and an addArgs builder", () => {
    for (const client of allClients()) {
      if (client.oauth?.mode !== "native") continue;
      expect(client.oauth.binary, `${client.id} missing binary`).toBeTruthy();
      // `addArgs` may return null at call time (Opencode 1.x has no scriptable
      // `mcp add`), but every native client must declare the hook so the
      // dispatcher knows to try it.
      expect(client.oauth.addArgs, `${client.id} missing addArgs`).toBeTypeOf("function");
    }
  });

  it("never scripts `mcp add` for Opencode — the file is written by hand", () => {
    // The entry is written straight into opencode.jsonc, so there is no `add`
    // step; `addArgs` returns null regardless of which binary is installed.
    const opencode = allClients().find((c) => c.id === "opencode")!;
    expect(opencode.oauth!.addArgs!(url, "global")).toBeNull();
    expect(opencode.oauth!.addArgs!(url, "project")).toBeNull();
  });

  it("keeps Opencode's supportsNativeOAuth flag in sync with the generic mode", () => {
    const client = allClients().find((c) => c.id === "opencode")!;
    expect(client.supportsNativeOAuth).toBe(true);
    expect(client.oauth?.mode).toBe("native");
  });
});

describe("OAuth entries must never carry an API key or Authorization header", () => {
  const oauthClients = allClients().filter((c) => c.oauth?.buildEntry);

  it("covers every client that declares an OAuth entry builder", () => {
    // 9 = Cursor, Zed, Gemini, VS Code, Kiro, Kilo, Crush, Opencode, Codex (toml)
    const withEntry = allClients().filter((c) => c.oauth?.buildEntry);
    const withOAuth = allClients().filter((c) => c.oauth);
    // Every client that has an OAuth capability may legitimately omit a
    // buildEntry only if its CLI writes the config itself (claude-code, amp,
    // factory, qwen) — those rely purely on addArgs.
    const cliOnly = withOAuth.filter((c) => !c.oauth!.buildEntry);
    for (const client of cliOnly) {
      expect(client.oauth!.addArgs, `${client.id} has neither entry nor addArgs`).toBeTypeOf("function");
    }
    expect(withEntry.length).toBeGreaterThanOrEqual(9);
    expect(withEntry.length + cliOnly.length).toBe(withOAuth.length);
  });

  it("omits headers entirely from every OAuth entry", () => {
    for (const client of oauthClients) {
      const entry = client.oauth!.buildEntry!(url);
      expect(entry.headers, `${client.id} leaked headers`).toBeUndefined();
      expect(JSON.stringify(entry)).not.toContain("X-API-Key");
      expect(JSON.stringify(entry)).not.toContain("Authorization");
      expect(JSON.stringify(entry)).not.toContain(key);
    }
  });

  it("omits http_headers from every OAuth entry", () => {
    for (const client of oauthClients) {
      const entry = client.oauth!.buildEntry!(url);
      expect(entry.http_headers, `${client.id} leaked http_headers`).toBeUndefined();
    }
  });

  it("never emits a guest_id cookie", () => {
    for (const client of oauthClients) {
      const entry = client.oauth!.buildEntry!(url);
      expect(JSON.stringify(entry)).not.toContain("guest_id");
      expect(JSON.stringify(entry)).not.toContain("Cookie");
    }
  });

  it("still writes X-API-Key on the API-key path for the same clients", () => {
    for (const client of oauthClients) {
      if (!client.buildEntry) continue;
      const entry = client.buildEntry(key, url);
      const serialized = JSON.stringify(entry);
      expect(serialized, `${client.id} lost its API key on the key path`).toContain(key);
    }
  });
});

describe("Global guard: no builder ever writes Authorization", () => {
  it("scans every JSON client's API-key entry", () => {
    for (const client of JSON_CLIENTS) {
      if (!client.buildEntry) continue;
      const serialized = JSON.stringify(client.buildEntry(key, url));
      expect(serialized, `${client.id} wrote Authorization`).not.toContain("Authorization");
      expect(serialized, `${client.id} wrote Bearer`).not.toContain("Bearer");
    }
  });

  it("scans every TOML client's API-key entry", () => {
    for (const client of TOML_CLIENTS) {
      if (!client.buildEntry) continue;
      const serialized = JSON.stringify(client.buildEntry(key, url));
      expect(serialized, `${client.id} wrote Authorization`).not.toContain("Authorization");
      expect(serialized).not.toContain("Bearer");
    }
  });

  it("scans every CLI client's command", () => {
    for (const client of CLI_CLIENTS) {
      if (!client.buildCommand) continue;
      const cmd = client.buildCommand(key, url);
      // NeedMCP parses `Authorization: Bearer` into the same variable as
      // X-API-Key, so a header there is ambiguous and never intended.
      expect(cmd, `${client.id} wrote Authorization`).not.toContain("Authorization");
      expect(cmd, `${client.id} wrote Bearer`).not.toContain("Bearer");
      expect(cmd, `${client.id} lost its key`).toContain(key);
    }
  });
});

describe("Per-client argv builders", () => {
  it("Claude Code uses http transport and user scope for global", () => {
    const args = buildClaudeCodeAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).toContain("--transport");
    expect(args).toContain("http");
    expect(args).toContain("--scope");
    expect(args).toContain("user");
    expect(args).toContain(url);
  });

  it("Claude Code omits --scope for project scope", () => {
    const args = buildClaudeCodeAddArgs({ mcpUrl: url, scope: "project" });
    expect(args).not.toContain("--scope");
  });

  it("Claude Code never passes --header in OAuth mode", () => {
    const args = buildClaudeCodeAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).not.toContain("--header");
    expect(args.join(" ")).not.toContain("X-API-Key");
  });

  it("Amp registers the URL positionally", () => {
    const args = buildAmpAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).toEqual(["mcp", "add", "needmcp", url]);
    expect(args).not.toContain("--header");
  });

  it("Factory passes --type http", () => {
    const args = buildFactoryAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).toContain("--type");
    expect(args).toContain("http");
  });

  it("Qwen Code uses http transport", () => {
    const args = buildQwenAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).toContain("--transport");
    expect(args).toContain("http");
  });

  it("Codex registers with --url and logs in separately", () => {
    const add = buildCodexAddArgs({ mcpUrl: url, scope: "global" });
    expect(add).toEqual(["mcp", "add", "needmcp", "--url", url]);
    expect(buildCodexLoginArgs()).toEqual(["mcp", "login", "needmcp"]);
  });

  it("Gemini uses http transport", () => {
    const args = buildGeminiAddArgs({ mcpUrl: url, scope: "global" });
    expect(args).toContain("--transport");
    expect(args).toContain("http");
  });

  it("Kilo registers then authenticates", () => {
    const add = buildKiloAddArgs({ mcpUrl: url, scope: "global" });
    expect(add).toContain(url);
    expect(buildKiloAuthArgs()).toEqual(["mcp", "auth", "needmcp"]);
  });

  it("argv never contains a shell-interpolated URL", () => {
    // Array form is the guarantee: the URL is a single element, never split.
    for (const builder of [
      buildClaudeCodeAddArgs,
      buildAmpAddArgs,
      buildFactoryAddArgs,
      buildQwenAddArgs,
      buildCodexAddArgs,
      buildGeminiAddArgs,
      buildKiloAddArgs,
    ]) {
      const args = builder({ mcpUrl: url, scope: "global" });
      const matches = args.filter((a) => a === url);
      expect(matches).toHaveLength(1);
    }
  });
});

describe("Per-client OAuth config entries", () => {
  it("Cursor writes only the URL", () => {
    expect(cursorOAuthEntry(url)).toEqual({ url });
  });

  it("Zed writes only the URL (no header to suppress the prompt)", () => {
    expect(zedOAuthEntry(url)).toEqual({ url });
  });

  it("VS Code writes type http", () => {
    expect(vscodeOAuthEntry(url)).toEqual({ type: "http", url });
  });

  it("Kiro writes only the URL", () => {
    expect(kiroOAuthEntry(url)).toEqual({ url });
  });

  it("Crush opts in with oauth: true", () => {
    expect(crushOAuthEntry(url)).toEqual({ type: "http", url, oauth: true });
  });
});

describe("Gemini RFC 9207 workaround", () => {
  it("disables iss validation because NeedMCP does not advertise it", () => {
    const extra = geminiOAuthExtra();
    const oauth = extra.oauth as Record<string, unknown>;
    expect(oauth.enabled).toBe(true);
    expect(oauth.authorizationResponseIssParameterSupported).toBe(false);
  });

  it("carries the opt-out into the stored Gemini entry", () => {
    const client = JSON_CLIENTS.find((c) => c.id === "gemini-cli")!;
    const entry = client.oauth!.buildEntry!(url);
    const oauth = entry.oauth as Record<string, unknown>;
    expect(oauth.authorizationResponseIssParameterSupported).toBe(false);
    expect(entry.httpUrl).toBe(url);
    expect(entry.headers).toBeUndefined();
  });
});

describe("formatOAuthCommand", () => {
  it("quotes arguments containing spaces", () => {
    expect(formatOAuthCommand("bin", ["a b", "c"])).toBe("bin 'a b' c");
  });

  it("leaves simple arguments unquoted", () => {
    expect(formatOAuthCommand("opencode", ["mcp", "auth", "needmcp"])).toBe(
      "opencode mcp auth needmcp"
    );
  });
});

describe("Migration safety: switching auth mode drops stale credentials", () => {
  it("API-key entry and OAuth entry differ, and OAuth has no headers", () => {
    for (const client of allClients()) {
      if (!client.oauth?.buildEntry || !client.buildEntry) continue;
      const keyEntry = client.buildEntry(key, url);
      const oauthEntry = client.oauth.buildEntry(url);

      expect(JSON.stringify(keyEntry)).toContain(key);
      expect(JSON.stringify(oauthEntry)).not.toContain(key);
    }
  });

  it("preserves unrelated fields shared between both modes", () => {
    const kilo = allClients().find((c) => c.id === "kilo-code")!;
    const oauthEntry = kilo.oauth!.buildEntry!(url);
    const keyEntry = kilo.buildEntry!(key, url);

    // Both keep the transport settings; only the auth differs.
    expect(oauthEntry.type).toBe(keyEntry.type);
    expect(oauthEntry.url).toBe(keyEntry.url);
    expect(oauthEntry.alwaysAllow).toEqual(keyEntry.alwaysAllow);
  });
});
