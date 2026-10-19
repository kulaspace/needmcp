# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Ask which OpenCode version you run.** OpenCode 1.x and 2.x install as
  separate binaries and write config layouts that each *reject* the other's, so
  exactly one layout can be written. When both are installed, `needmcp setup`
  now asks which one you use — on **every** run, since the answer is never
  persisted: switching binaries needs no reset. Verified with both real binaries
  and with stand-ins on PATH.
- `--opencode-layout v1|v2` (`-l`) to skip the question. Non-interactive runs
  without it now **fail** with a message naming the flag, instead of silently
  picking a layout the running binary would ignore.
- `needmcp list` reports an entry sitting at the other layout's path as
  `stale v1|v2 layout`, not `configured`.
- `scripts/verify-opencode-version.ts` and `scripts/verify-opencode-dual.ts`
  (`verify:opencode-version`, `verify:opencode-dual`) proving both branches.

### Fixed

- **Version detection on Windows npm installs.** `where opencode` lists the
  extensionless shell shim *before* `opencode.cmd`, and that file cannot be
  spawned — every probe failed, silently degraded to the 1.x layout, and
  mislabelled a real 2.x install. Candidates are now filtered to executables and
  batch shims, batch files run through `cmd.exe` with the path kept whole, and
  the answer is cached so setup pays for one probe instead of several.
- **Switching OpenCode versions left a broken entry behind.** The stale entry at
  the other layout's path is now removed in both directions (only `needmcp`), and
  an emptied `mcp.servers` container is dropped - 1.x rejects the key even when
  empty, hiding every server.

- **OAuth 2.1 client support across 14 clients.** `ClientConfig` now carries an
  `oauth` capability (`mode`, `addArgs`, `loginArgs`, `buildEntry`) instead of the
  single-purpose `supportsNativeOAuth` flag. Clients are split by how their
  sign-in is driven:

  - *Native* (the CLI runs the handshake): Claude Code, Amp, Factory, OpenCode,
    OpenAI Codex, Qwen Code, Gemini CLI, Kilo Code.
  - *Config-only* (the entry is written, sign-in happens in-app): Cursor,
    VS Code, Zed, Kiro, Crush.

  Clients documented as API-key only — Windsurf, JetBrains, Trae, Google
  Antigravity, Amazon Q, LM Studio, Visual Studio, Copilot CLI, Claude Desktop —
  keep the existing `X-API-Key` path byte-identically.
- `src/clients/oauth-clients.ts` holding every per-client argv and config-entry
  builder, each citing the documentation it was verified against.
- **Gemini CLI RFC 9207 workaround.** NeedMCP's authorization-server metadata does
  not advertise `authorization_response_iss_parameter_supported`, and Gemini
  rejects callbacks without `iss`. The written entry sets
  `"authorizationResponseIssParameterSupported": false`; without it every Gemini
  OAuth callback fails.
- `scripts/smoke-auth.ts` (`npm run smoke:auth`) — an end-to-end check of the
  auth-mode switch against real files in a temp directory.
- `scripts/e2e-opencode.ts` (`npm run verify:opencode`) — drives the real
  Opencode config writer, then asks the installed binary what it actually parsed,
  asserting the file is accepted, the entry lands at the version's own path, and
  the siblings survive.
- `scripts/verify-scope.ts` (`npm run verify:scope`) — proves a project-scope run
  never reads the global legacy config, and that a global run still migrates.
- `scripts/verify-mcp-add.ts` (`npm run verify:mcp-add`) — proves
  `opencode mcp add` writes only the needmcp entry, copying no user config.
- `src/clients/opencode-layout.ts` — version detection and the two Opencode entry
  shapes, each citing the binary behaviour it encodes.
- `legacyProjectPaths` on `ClientConfig`, so legacy migration sources are resolved
  per scope instead of mixing global and project files.
- `legacyPaths` on `ClientConfig`, for files that are read for migration but
  never written.
- Live server tests (`src/__tests__/live-server.test.ts`) that assert the
  backend's actual behaviour: RFC 9728/8414 discovery, RFC 7591 registration,
  PKCE S256, the `invalid_grant`/`invalid_token` error shapes, and the
  `X-API-Key`-before-`Bearer` precedence.

### Changed

- **OAuth entries are written header-free.** NeedMCP reads `X-API-Key` before
  `Authorization: Bearer` and feeds both into the same check, so a leftover API
  key takes precedence over a valid OAuth token and fails with
  `Invalid or revoked API key`. Switching a client to OAuth now replaces the entry
  without headers, dropping any stale key; switching back restores it.
- `setup.ts` replaces the Opencode-specific `setupOpencodeWithOAuth()` with a
  generic `runNativeOAuth()` used by every native client. Failure handling is
  unchanged in spirit:
  - missing binary → write the config unauthenticated and print the exact commands;
  - `add` fails → report failure, nothing written;
  - `login` fails → success-with-warning, never a hard failure.
- `needmcp setup` now prompts per client ("How should \<Client\> authenticate to
  NeedMCP?") with **OAuth 2.1 preselected**, and `--auth oauth`/`--auth key` still
  short-circuit the prompt.
- Opencode is now routed through the shared capability model, including its
  `mcp add` step, so the client definition describes the whole flow instead of
  `setup.ts` special-casing it.

### Fixed

- **Opencode servers were registered but never called.** Verified against
  `opencode` 1.2.27 and `opencode2` 2.0.32, which turn out to use incompatible
  layouts that each reject the other's:

  | | 1.2.27 | 2.0.32 |
  | :--- | :--- | :--- |
  | Config key | `mcp.<name>` | `mcp.servers.<name>` |
  | Entry | `{type, url, enabled, oauth, headers}` | `{type, url, headers, disabled}` |
  | Reads `opencode.json` | yes | yes |
  | Reads `opencode.jsonc` | yes | **no** |

  - *Wrong schema for the installed version.* A single hard-coded layout served
    neither version: 1.x fails the whole config on `mcp.servers`
    (`Invalid input mcp.servers`, hiding every sibling), and 2.x never looks at
    `mcp.<name>`. `clients/opencode-layout.ts` now detects the installed binary
    and emits the matching key and entry shape. A stray entry under the other
    layout's path is removed on write.
  - *OAuth silently on.* Opencode enables OAuth for every remote server unless
    told otherwise, and while OAuth is active it ignores `X-API-Key` and parks the
    server at *needs authentication*. API-key mode now writes `"oauth": false`
    for 1.x and `"disabled": false` for 2.x.
  - *Config file the binary does not read.* `opencode.jsonc` is invisible to 2.x
    ("No MCP servers configured"). `opencode.json` is now the only write target —
    the single filename both versions read, and both parse it as JSONC. A leftover
    `opencode.jsonc` is read once to migrate its servers and is never modified.
- **`opencode mcp add` was invoked with flags the binary does not accept.**
  Opencode 1.x's `mcp add` is an interactive wizard with no flags at all, and
  2.x's `--header` takes `key=value`, not `key: value`. `mcp add` is now used only
  when 2.x is installed; 1.x writes the config directly. Sign-in via
  `opencode mcp auth needmcp` works in both versions and is unchanged.
- **A project-scope run cloned the global config.** `legacyPaths` mixed global and
  project paths, so any project without a target file was seeded from
  `~/.config/opencode/*`, dragging in its providers, plugins and agents.
  Legacy sources are now resolved per scope (`legacyPaths` vs
  `legacyProjectPaths`): a project run reads only project-scope legacy files.
- **`.env` was ignored unless the CLI was launched from its own directory.**
  `dotenv/config` loads relative to the process cwd, and `constants.ts` read
  `process.env` at import time — before the entry module's body ran under ESM
  hoisting — so a local override silently fell back to `https://needmcp.com`.
  `src/env.ts` now loads `.env` from both the cwd and the install directory, and
  the default endpoints are lazy getters instead of top-level constants.
  `setup` also prints the resolved endpoint and flags when it came from the
  environment.
- Comments in `opencode.json` are dropped silently on rewrite; the CLI now warns
  before doing it.

### Security

- The CLI never persists an OAuth access token. Access tokens live one hour
  (`config/oauth.php: access_token_ttl`) and only the client owns the refresh
  loop; a token written to `~/.needmcp/config.json` would silently expire.
- Guard tests scan every client in `allClients()` and fail if any builder emits an
  `Authorization`, `Bearer`, or `guest_id` value into a config entry.
- No `guest_id` cookie is ever written: guest access is disabled server-side and
  the cookie carries no authentication.

### Documentation

- `README.md` gains an "OAuth 2.1 vs API key" section: the two credential
  families and their prefixes, why OAuth entries must be header-free, the full
  per-client support matrix with automatic-install status, the Gemini RFC 9207
  caveat, and the absence of a token revocation endpoint.
- `docs/mcp-client/opencode.md` documents both schemas and the
  register-then-authenticate order, and notes that `opencode mcp add` has no
  header flag so `X-API-Key` must be used via OAuth or a manual edit.

## [1.6.0] - 2026-10-07

### Security

- **OAuth login now uses the Authorization Code flow with PKCE (RFC 7636,
  `S256`).** The CLI generates a `code_verifier` and sends only its
  `code_challenge` to the authorization page. The API key is no longer delivered
  through the browser redirect URL, which previously exposed it in browser
  history, HTTP/proxy logs, and the `Referer` header of the callback page — and
  could be intercepted by other local processes watching loopback URLs.
- The browser now only receives a single-use authorization code with a 60 second
  TTL; the CLI exchanges it for the API key in a direct back-channel
  `POST /oauth/cli/token` request, and the key is returned in the JSON body.

### Changed

- `handleCallback()` returns `{ code }` for the PKCE flow. As a temporary
  transition aid it still falls back to the legacy plaintext `api_key`/`token`
  callback parameters when no `code` is present, so CLI builds released before
  the PKCE rollout keep working against older servers. The fallback can be
  removed once the minimum required server version mandates PKCE.
- The authorization page now receives `code_challenge` and
  `code_challenge_method=S256` alongside the existing parameters.
- Token exchange failures surface the server message, and HTTP 429 is reported
  as "Too many authentication attempts. Please wait a minute and try again."

### Fixed

- A failed token exchange now renders the error page in the browser. The success
  page is written only after the exchange succeeds, so the browser can no longer
  report success for an authentication that actually failed.

### Documentation

- Updated `docs/cli_oauth.md` to the PKCE contract: new flow diagram,
  `code_challenge` parameters, the `POST /oauth/cli/token` endpoint, and the
  refreshed TypeScript example.

## [1.5.0] - 2026-05-19

### Changed

- **Guest mode is temporarily disabled.** The authentication menu now only offers
  **Login with Browser (OAuth)** and **Enter API Key**. An API key is required to
  complete setup. Guest mode can be re-enabled later via a single feature flag
  (`GUEST_MODE_ENABLED` in `src/setup.ts`).

### Fixed

- The CLI no longer hangs on the success notification after completing `setup`,
  `remove`, `style set`, or `design`. The process now exits explicitly once the
  command finishes, instead of waiting on lingering keep-alive sockets.

### Documentation

- Rewrote the authentication section of the README to document the browser OAuth
  login flow (`needmcp setup --auth oauth`), manual API key entry, and the new
  `--auth` / `--key` setup flags.

## [1.4.0] - 2026-05-19

### Added

- OAuth browser login option during `setup`. The CLI opens a local callback
  listener, launches the browser, and stores the auto-generated API key.

## [1.3.0] - 2026-05-19

### Added

- `needmcp design <slug>` command to download a style's design system as
  `DESIGN.md`.

## [1.2.3] - 2026-05-19

### Documentation

- Point documentation links to [needmcp.com/docs](https://needmcp.com/docs).

## [1.2.2] - 2026-05-19

### Fixed

- OpenAI Codex: write `http_headers` as an inline table per Codex docs.

## [1.2.1] - 2026-05-19

### Fixed

- Claude Code: use HTTP transport in the `claude mcp add` command.

## [1.2.0] - 2026-05-19

### Added

- Read the CLI version from `package.json` via tsup `define`.

## [1.1.0] - 2026-05-19

### Changed

- `style` is now a subcommand (`needmcp style set <slug>`).

## [1.0.3] - 2026-05-19

### Fixed

- Regenerated `package-lock.json`.

## [1.0.0] - 2026-05-19

### Added

- Initial release: `setup`, `remove`, and `style` commands.
- Support for configuring NeedMCP across AI coding assistants (JSON, TOML, and
  CLI clients).
- Automated npm publish workflow triggered on `v*` tags.

[1.6.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.6.0
[1.5.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.5.0
[1.4.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.4.0
[1.3.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.3.0
[1.2.3]: https://github.com/kulaspace/needmcp/releases/tag/v1.2.3
[1.2.2]: https://github.com/kulaspace/needmcp/releases/tag/v1.2.2
[1.2.1]: https://github.com/kulaspace/needmcp/releases/tag/v1.2.1
[1.2.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.2.0
[1.1.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.1.0
[1.0.3]: https://github.com/kulaspace/needmcp/releases/tag/v1.0.3
[1.0.0]: https://github.com/kulaspace/needmcp/releases/tag/v1.0.0
