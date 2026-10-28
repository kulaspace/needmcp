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
  (used by Opencode); `supportsNativeOAuth` makes the CLI ask the client to do sign-in itself
  instead of writing an API key.

## How the client registry works

The core abstraction is one `ClientConfig` (`src/clients/types.ts`) per assistant. `ALL_CLIENTS` in
`src/clients/index.ts` is the single source of truth. Each client declares a `format`, and the
dispatcher in `setup.ts` routes on it:

- `json` -> `JSON_CLIENTS` (`clients/json.ts`) — read/merge/write a JSON/JSONC config file via `mcp-writer.ts`
- `toml` -> `TOML_CLIENTS` (`clients/toml.ts`) — `smol-toml`, always `mcp_servers.needmcp`
- `cli`  -> `CLI_CLIENTS` (`clients/cli.ts`) — builds a command string, executed with `execFileSync(..., shell: true)`
- `ui`   -> `uiClients()` (`clients/ui.ts`) — no auto-write; just prints manual `instructions`

**Adding a client:** add one object to the right array; do not touch `setup.ts` unless you need a new
`format`. `configKey` is `string | string[]` — a string hits a top-level key, an array walks nested
objects (`["mcp"]` for Opencode). Always resolve it through
`resolveClientConfigKey()`. `serverName` defaults to `needmcp` (Zed uses `NeedMCP`).

`detectPaths` works for **every** format, including `json`: when no config file exists yet, the
client is still reported as `detected` if any listed binary resolves on `PATH`. Without it a
freshly installed client reads as `not found` and sinks to the bottom of the `setup` picker,
which is indistinguishable from "not supported".
The API-key header is `X-API-Key`; entry shapes differ per client (`url`, `serverUrl`, `httpUrl`,
`type: http|remote`, …) — copy the exact shape from a sibling entry, they are not interchangeable.

## Two credential families, one /mcp route

The server accepts **both** an API key and an OAuth access token on `/mcp`, discriminated by
token prefix (`app/Http/Middleware/SimpleApiKeyAuth.php` in the backend repo):

| Prefix | Kind | Lifetime |
| :--- | :--- | :--- |
| `sk-need-*` / `sk_need_*` | API key | until revoked |
| `mcp_at_*` | OAuth access token | **1 hour** (`config/oauth.php: access_token_ttl`) |

Three rules follow, and breaking any of them ships a broken client:

1. **OAuth config entries must be header-free.** The server reads `X-API-Key` *before*
   `Authorization: Bearer` and feeds both into the same variable, so a leftover key wins over a
   valid OAuth token and fails with `Invalid or revoked API key`.
2. **The CLI never persists an OAuth token.** Access tokens expire in an hour and only the client
   owns the refresh loop; writing `mcp_at_*` to `~/.needmcp/config.json` would silently expire.
3. **Never write a `guest_id` cookie.** Guest access is disabled server-side and the cookie is
   client-controlled; it carries no authentication.

Guard tests in `oauth-clients.test.ts` scan every client in `ALL_CLIENTS` and fail if any builder
emits `Authorization`, `Bearer`, or `guest_id` into an entry.

## OAuth capability model

`ClientConfig.oauth` (in `clients/types.ts`) replaces the ad-hoc Opencode special case:

- `mode: "native"` — the CLI runs `addArgs` then `loginArgs` through the client's binary
  (Claude Code, Amp, Factory, OpenCode, Codex, Qwen, Gemini, Kilo).
- `mode: "config-only"` — write `buildEntry`, sign-in happens in-app (Cursor, VS Code, Zed, Kiro,
  Crush).
- no `oauth` field — API-key only. Keep it that way for clients without verified support
  (Windsurf, JetBrains, Trae, Antigravity, Amazon Q, LM Studio, Visual Studio, Copilot CLI).

Every builder in `clients/oauth-clients.ts` cites the doc it was verified against. If you cannot
verify a client's argv, do not guess — leave it on the API-key path.

**Gemini caveat:** NeedMCP does not advertise `authorization_response_iss_parameter_supported`, and
Gemini rejects callbacks without `iss` (RFC 9207). The entry must keep
`"authorizationResponseIssParameterSupported": false`.

## Opencode: two clients, one config shape

There are **two** Opencode clients (`opencode` and `opencode2`) but **one** config
shape shared by both. Do not reintroduce a per-version layout or a `mcp.servers`
wrapper; both binaries normalise the single `mcp.needmcp` shape.

Everything is written to `opencode.jsonc`, at `mcp.needmcp`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "needmcp": {
      "type": "remote",
      "url": "https://needmcp.com/mcp",
      "enabled": true,
      "headers": { "X-API-Key": "sk-need-..." }
    }
  }
}
```

`headers` is present in API-key mode and **absent** in OAuth mode. No
`mcp.servers` wrapper, no `oauth` field, no `disabled` field.

| Fact | Evidence |
| :--- | :--- |
| Both versions accept `mcp.<name>` and read `opencode.jsonc` | `opencode2 debug config`, `opencode mcp list` |
| 2.x normalises `mcp.<name>` to `mcp.servers.<name>` **internally**; the file on disk stays `mcp.<name>` | `opencode2 debug config` output |
| 1.x **rejects** a literal `mcp.servers` key in the file -> `Invalid input mcp.servers`, hiding **every** server | `opencode mcp list` in a project dir |
| `opencode mcp auth needmcp` exists in 1.x | `opencode mcp --help` |

Rules encoded in code:

- `configKey` is the plain string `"mcp"`. There is no function form.
- `oauth.addArgs` always returns `null`: the file is written by hand, never via
  `opencode mcp add`. `oauth.loginArgs` is `["mcp","auth","needmcp"]`.
- Order in `runNativeOAuth`: write the file first, then run `mcp auth`. A
  `mcp auth` cannot resolve a server that is not in the config yet.
- If the `opencode` binary is missing, the config is still written and the exact
  command is printed. Never hard-fail there.
- `opencode.json` is never read, written or deleted. `opencode.jsonc` is the only
  target, so there is no migration path and no `legacyPaths`.
- The writer **edits**: `mergeServerEntry` reads the existing document and
  inserts `mcp.needmcp`. `$schema`, `model`, `agents` and sibling servers must
  survive — `scripts/verify-flow.ts` asserts exactly this.

`npm run verify:opencode` exercises this end to end against the real binary.

**`opencode2 mcp list` is not a verification tool.** Its background service binds to the
first project directory it ever saw and keeps serving that one; from any other directory
it prints "No MCP servers configured" regardless of the local file, and `reload` fails
once that original directory is gone. Assert against `opencode2 debug config` instead —
it prints every config source and its parsed content.

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
- `live-server.test.ts` talks to the real backend (`NEEDMCP_TEST_MCP_URL`, default
  `https://needmcp.com/mcp`) to pin down discovery, DCR, PKCE, error shapes, and the
  `X-API-Key`-before-`Bearer` precedence. It skips itself when offline. Change an expectation here
  only after re-probing the server — these encode observed behaviour, not intentions.
- `migration.test.ts` writes real config files in `mkdtemp` and asserts that switching auth mode
  drops the stale credential without touching sibling servers or unrelated keys.
- `npm run smoke:auth` (`scripts/smoke-auth.ts`) is the end-to-end check: it lives outside
  `src/__tests__` so vitest ignores it, and drives the real writer against a temp directory.
- 139 tests, no snapshots, no required services or fixtures on disk.
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
