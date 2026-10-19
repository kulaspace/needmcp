import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Several files probe the real Opencode binaries, and an npm `.cmd` shim
    // costs ~1.7s to spawn on Windows. Run in parallel that stacks up fast, so
    // the default 5s is too tight for tests that are merely waiting on a probe.
    testTimeout: 30000,
    // `.env` in the repo points at a local backend for manual CLI runs. Vitest
    // auto-loads it from cwd, which would redirect the live-server tests and any
    // test that resolves a default URL. Tests must see a predictable environment.
    env: {
      NEEDMCP_BASE_URL: "https://needmcp.com",
      NEEDMCP_MCP_URL: "https://needmcp.com/mcp",
    },
  },
});
