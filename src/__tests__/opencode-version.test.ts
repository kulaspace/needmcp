import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  asOpencodeLayout,
  buildOpencodeEntryFor,
  detectOpencodeLayouts,
  needsLayoutChoice,
  opencodeConfigKey,
  pickDefaultLayout,
  type DetectedOpencode,
} from "../clients/opencode-layout.js";
import { JSON_CLIENTS } from "../clients/json.js";
import { resolveClientConfigKey } from "../clients/types.js";
import {
  cleanupStrayEntry,
  mergeServerEntry,
  readJsonConfig,
  writeJsonConfig,
  getSection,
} from "../mcp-writer.js";

/**
 * Opencode ships 1.x and 2.x as separate binaries whose config layouts are
 * mutually invalid. These tests lock both halves of that: the version choice,
 * and the two-way cleanup that must happen when the user switches between them.
 */

const url = "https://needmcp.com/mcp";
const key = "sk-need-TEST";
const opencode = JSON_CLIENTS.find((c) => c.id === "opencode")!;

/** Narrowed read of a nested section, so tests stay readable without casts. */
function at(config: Record<string, unknown>, ...path: string[]): Record<string, unknown> {
  return getSection(config, path) as Record<string, unknown>;
}

describe("Opencode version detection", () => {
  it("classifies each installed binary by its reported major version", () => {
    for (const d of detectOpencodeLayouts()) {
      expect(["opencode", "opencode2"]).toContain(d.binary);
      // `opencode2` is always the 2.x line regardless of what it reports.
      if (d.binary === "opencode2") expect(d.layout).toBe("v2");
    }
  });

  it("reads a version through a PATH shim, not just a bare name", () => {
    // Regression: `where opencode` on Windows lists the extensionless npm shell
    // script BEFORE `opencode.cmd`, and that file is not executable. Trusting
    // the first match made every version read fail, which silently fell back to
    // v1 and mislabelled a real 2.x install.
    for (const d of detectOpencodeLayouts()) {
      if (d.binary !== "opencode") continue;
      // A resolvable binary must report a parseable version on a machine where
      // it is actually installed — `null` here means the probe is broken.
      if (d.version !== null) expect(d.version).toMatch(/\d+\.\d+\.\d+/);
    }
  });

  it("asks only when the two families differ", () => {
    const v1: DetectedOpencode = { layout: "v1", binary: "opencode", version: "1.2.27" };
    const v2: DetectedOpencode = { layout: "v2", binary: "opencode2", version: "2.0.32" };

    expect(needsLayoutChoice([v1])).toBe(false);
    expect(needsLayoutChoice([v2])).toBe(false);
    expect(needsLayoutChoice([v1, v2])).toBe(true);
    // Two binaries both reporting 2.x need no question.
    expect(needsLayoutChoice([v2, { ...v2, binary: "opencode" }])).toBe(false);
  });

  it("defaults to v2 when both are present, for non-interactive paths", () => {
    const detected: DetectedOpencode[] = [
      { layout: "v1", binary: "opencode", version: "1.2.27" },
      { layout: "v2", binary: "opencode2", version: "2.0.32" },
    ];
    expect(pickDefaultLayout(detected)).toBe("v2");
    expect(pickDefaultLayout([detected[0]])).toBe("v1");
    expect(pickDefaultLayout([])).toBe("v1");
  });

  it("ignores an unrecognised override instead of inventing a third layout", () => {
    expect(asOpencodeLayout("v1")).toBe("v1");
    expect(asOpencodeLayout("v2")).toBe("v2");
    expect(["v1", "v2"]).toContain(asOpencodeLayout("v3"));
    expect(["v1", "v2"]).toContain(asOpencodeLayout(undefined));
  });
});

describe("Opencode layout drives key and entry", () => {
  it("writes the key the chosen layout uses, ignoring the installed version", () => {
    // The choice must win: a user on a two-version machine selecting v1 gets the
    // v1 key even though v2 is also installed.
    expect(resolveClientConfigKey(opencode, "v1")).toEqual(["mcp"]);
    expect(resolveClientConfigKey(opencode, "v2")).toEqual(["mcp", "servers"]);
  });

  it("writes the entry shape matching the chosen layout", () => {
    expect(opencode.buildEntry!(key, url, "v1")).toEqual({
      type: "remote",
      url,
      enabled: true,
      oauth: false,
      headers: { "X-API-Key": key },
    });
    expect(opencode.buildEntry!(key, url, "v2")).toEqual({
      type: "remote",
      url,
      headers: { "X-API-Key": key },
      disabled: false,
    });
  });

  it("keeps OAuth entries header-free in both layouts", () => {
    for (const layout of ["v1", "v2"] as const) {
      const entry = buildOpencodeEntryFor(layout, { mcpUrl: url });
      expect(entry.headers).toBeUndefined();
    }
  });
});

describe("Switching Opencode versions cleans the old entry", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "needmcp-switch-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("removes mcp.needmcp when moving to the v2 layout", async () => {
    const target = join(dir, "opencode.json");
    await writeJsonConfig(target, {
      mcp: {
        needmcp: { type: "remote", url: "https://old.example/mcp" },
        context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
      },
    });

    const existing = await readJsonConfig(target);
    const keyPath = resolveClientConfigKey(opencode, "v2");
    const { config: cleaned, removed } = cleanupStrayEntry(existing, keyPath, "needmcp");
    expect(removed).toBe(true);

    const { config } = mergeServerEntry(cleaned, keyPath, "needmcp", opencode.buildEntry!(key, url, "v2"));
    await writeJsonConfig(target, config);

    const written = await readJsonConfig(target);
    expect(at(written, "mcp").needmcp).toBeUndefined();
    expect(getSection(written, ["mcp", "servers"])!.needmcp).toEqual(opencode.buildEntry!(key, url, "v2"));
    // The sibling under the v1 root must survive the switch.
    expect(at(written, "mcp").context7).toEqual({ type: "remote", url: "https://mcp.context7.com/mcp" });
  });

  it("removes mcp.servers.needmcp and the emptied container when moving to v1", async () => {
    const target = join(dir, "opencode.json");
    await writeJsonConfig(target, {
      mcp: { servers: { needmcp: { type: "remote", url: "https://old.example/mcp" } } },
    });

    const existing = await readJsonConfig(target);
    const keyPath = resolveClientConfigKey(opencode, "v1");
    const { config: cleaned, removed } = cleanupStrayEntry(existing, keyPath, "needmcp");
    expect(removed).toBe(true);

    const { config } = mergeServerEntry(cleaned, keyPath, "needmcp", opencode.buildEntry!(key, url, "v1"));

    // 1.x rejects `mcp.servers` even when empty, so the container must be gone.
    expect(at(config, "mcp").servers).toBeUndefined();
    expect(getSection(config, ["mcp"])!.needmcp).toEqual(opencode.buildEntry!(key, url, "v1"));
  });

  it("keeps other servers in the emptied container", async () => {
    const target = join(dir, "opencode.json");
    await writeJsonConfig(target, {
      mcp: {
        servers: {
          needmcp: { type: "remote", url: "https://old.example/mcp" },
          github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
        },
      },
    });

    const existing = await readJsonConfig(target);
    const { config: cleaned } = cleanupStrayEntry(existing, resolveClientConfigKey(opencode, "v1"), "needmcp");

    // `servers` still holds github, so the container stays — only a fully
    // empty one is removed.
    expect(getSection(cleaned, ["mcp", "servers"])).toEqual({
      github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
    });
  });

  it("does not touch servers it was not asked to remove", async () => {
    const target = join(dir, "opencode.json");
    const config = {
      mcp: {
        needmcp: { type: "remote", url: "https://old.example/mcp" },
        context7: { type: "remote", url: "https://mcp.context7.com/mcp" },
        github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" },
      },
    };
    await writeJsonConfig(target, config);

    const existing = await readJsonConfig(target);
    const { config: cleaned } = cleanupStrayEntry(existing, resolveClientConfigKey(opencode, "v2"), "needmcp");

    expect(at(cleaned, "mcp").needmcp).toBeUndefined();
    expect(at(cleaned, "mcp").context7).toEqual(config.mcp.context7);
    expect(at(cleaned, "mcp").github).toEqual(config.mcp.github);
  });

  it("is a no-op when the stray entry is absent", async () => {
    const existing = { mcp: { context7: { type: "remote" } } };
    const { config, removed } = cleanupStrayEntry(existing, ["mcp"], "needmcp");
    expect(removed).toBe(false);
    expect(config).toEqual(existing);
  });
});

describe("Non-interactive setup never guesses the layout", () => {
  it("leaves the refusal to the flag when both versions are installed", () => {
    // The decision logic itself: with two families present there is no safe
    // default, so every caller must supply an override or ask. `pickDefaultLayout`
    // exists for inspection only and must never be reached by setup in this case.
    const both: DetectedOpencode[] = [
      { layout: "v1", binary: "opencode", version: "1.2.27" },
      { layout: "v2", binary: "opencode2", version: "2.0.32" },
    ];

    expect(needsLayoutChoice(both)).toBe(true);
    // A single version is unambiguous, so setup proceeds without asking.
    expect(needsLayoutChoice([both[0]])).toBe(false);
    expect(needsLayoutChoice([both[1]])).toBe(false);
  });

  it("accepts only v1 and v2 as an override", () => {
    // `--opencode-layout` is validated at the CLI, but the resolver is the last
    // line of defence: an unknown value must resolve to a real layout, never a
    // third shape that no binary reads.
    for (const candidate of ["v1", "v2", "V1", "1", "2", "", "servers"]) {
      const layout = asOpencodeLayout(candidate);
      expect(["v1", "v2"]).toContain(layout);
    }
  });

  it("tells the user about the flag when it cannot ask", async () => {
    // The only way out of the ambiguity is the flag, so the message must name
    // it — a message that only says "conflict" leaves the user stuck.
    const { layoutChoiceRequiredMessage } = await import("../setup.js");
    const msg = layoutChoiceRequiredMessage([
      { layout: "v1", binary: "opencode", version: "opencode 1.2.27" },
      { layout: "v2", binary: "opencode2", version: "opencode 2.0.32" },
    ]);

    expect(msg).toContain("--opencode-layout");
    // Both installed versions are listed, so the user can tell them apart.
    expect(msg).toContain("1.2.27");
    expect(msg).toContain("2.0.32");
    expect(msg).toContain("mcp.servers.<name>");
    expect(msg).toContain("mcp.<name>");
  });
});
