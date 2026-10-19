# AGENTS.md

Guidance for AI agents working in this repo. Keep it terse and repo-specific.

## What this is

`needmcp` is a **published npm CLI** (`bin: needmcp -> dist/cli.mjs`, ESM, Node >= 22) that
configures MCP servers for ~40 AI coding assistants, plus `style set` and `design <slug>`
commands that call the NeedMCP backend API. Not a library, not a monorepo.

## Commands

- `npm run build` — tsup bundle to `dist/cli.mjs` (minified, single file, `__VERSION__` inlined)
- `npm test` — vitest, all tests under `src/__tests__/`
- `npm run typecheck` — `tsc --noEmit` (the only lint/typecheck gate; no eslint/prettier)
- Single test file: `npx vitest run src/__tests__/opencode.test.ts`
- Single test: `npx vitest run -t "adds --global for v2 global scope only"`

Before handing work off, run `npm run typecheck && npm test`. There is no lint step.

## Gotchas that cause real bugs

- **`__VERSION__` has no runtime fallback.** `src/index.ts` declares it and only tsup inlines it via
  `define`. Running source through anything but tsup (e.g. `tsx src/index.ts`) throws
  `__VERSION__ is not defined`. Use `npm run build && node dist/cli.mjs` to exercise the CLI.
- **Import specifiers must end in `.js`** (`./setup.js`), even from `.ts` sources — `module: NodeNext`.
- **`package-lock.json` is stale** (`1.5.0`) vs `package.json` (`1.6.0`). `npm ci` still passes; bump
  the lock if you touch deps.
- **Never call `loadConfig()` in tests / write to `~/.needmcp/config.json`** — tests must not touch the
  real home dir. Use `mkdtemp(tmpdir())` for file I/O (see `mcp-writer.test.ts`).
- **`dotenv/config` loads `.env` from `process.cwd()`** (imported first in `index.ts`). This is exactly
  the base-URL-redirect risk documented in the README — don't run `setup` in untrusted dirs and don't
  add cwd `.env` loading elsewhere.
- `requiresScopeChoice` forces the Global/Project prompt even when a client only has global paths
  (used by both Opencode variants); `supportsNativeOAuth` makes the CLI ask Opencode to do sign-in
  itself instead of writing an API key.

## How the client registry works

The core abstraction is one `ClientConfig` (`src/clients/types.ts`) per assistant. `ALL_CLIENTS` in
`src/clients/index.ts` is the single source of truth. Each client declares a `format`, and the
dispatcher in `setup.ts` routes on it:

- `json` -> `JSON_CLIENTS` (`clients/json.ts`) — read/merge/write a JSON/JSONC config file via `mcp-writer.ts`
- `toml` -> `TOML_CLIENTS` (`clients/toml.ts`) — `smol-toml`, always `mcp_servers.needmcp`
- `cli`  -> `CLI_CLIENTS` (`clients/cli.ts`) — builds a command string, executed with `execFileSync(..., shell: true)`
- `ui`   -> `UI_CLIENTS` (`clients/ui.ts`) — no auto-write; just prints manual `instructions`

**Adding a client:** add one object to the right array; do not touch `setup.ts` unless you need a new
`format`. `configKey` is `string | string[]` — a string hits a top-level key, an array walks nested
objects (`["mcp","servers"]` for Opencode v2). `serverName` defaults to `needmcp` (Zed uses `NeedMCP`).
The API-key header is `X-API-Key`; entry shapes differ per client (`url`, `serverUrl`, `httpUrl`,
`type: http|remote`, …) — copy the exact shape from a sibling entry, they are not interchangeable.

## Two Opencode variants are deliberate

`opencode` (v1: `configKey: ["mcp"]`) and `opencode-v2` (v2: `configKey: ["mcp","servers"]`) are
separate clients. **Do not collapse them or guess a schema by version** — writing the wrong layout
silently disables the server. The native-OAuth path runs `opencode mcp add` **then** `opencode mcp
auth needmcp` (order matters); `--global` is only passed for v2. See `clients/opencode-cli.ts`.

## Auth & network

- `src/oauth.ts` implements OAuth 2.1 PKCE (S256) against `/oauth/cli` + `POST /oauth/cli/token`.
  The callback page must never contain the API key — asserts exist in `oauth-flow.test.ts`; keep it that way.
- Base URL resolution: `process.env.* -> ~/.needmcp/config.json -> default` (`config.ts`). Env vars:
  `NEEDMCP_BASE_URL` and `NEEDMCP_MCP_URL` override everything (see `.env.example`). Both are read in
  `constants.ts` at import time, so env must be set before launch.
- Windows browser launch needs `&` escaped as `^&` for `cmd /c start` (`buildWindowsOpenArgs`) — the
  query params are silently dropped otherwise. Don't "simplify" this.

## Testing notes

- `oauth-flow.test.ts` binds a real loopback `http.Server` and mocks `node:child_process` so no browser
  opens. `opencode` / `claude` etc. binaries are never invoked in tests — keep it that way.
- 81 tests, no snapshots, no required services or fixtures on disk.
- Test files live only in `src/__tests__/**/*.test.ts` (`vitest.config.ts` `include`); a test elsewhere
  is silently skipped.

## Style / workflow conventions

- No eslint/prettier; match surrounding code. Two-space indent, double quotes, semicolons, trailing commas.
- Comments explain *why* (see the OAuth / Opencode files) — follow that tone, not *what*.
- Version lives in `package.json` and is picked up by tsup `define`; it is also hard-coded as a
  `User-Agent` string in `oauth.ts` — update both on a version bump.
- `CHANGELOG.md` follows Keep a Changelog + SemVer; add entries under `## [Unreleased]`.
- Releases: pushing a `v*` tag runs `.github/workflows/publish.yml` (`npm ci -> build -> test ->
  publish`, OIDC, no token). Don't manually deploy.

## Files worth knowing

- `src/index.ts` — commander wiring, `ExitPromptError` handling (Ctrl-C exits 0, `CliError` exits 1)
- `src/setup.ts` — interactive `setup` / `remove` flows and per-format dispatchers
- `src/mcp-writer.ts` — JSON/JSONC parse (comments + trailing commas) and atomic TOML/JSON writes
- `docs/` is **gitignored** locally and is not shipped — treat it as untracked notes, not source of truth.
