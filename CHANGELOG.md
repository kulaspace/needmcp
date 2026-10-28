# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2026-10-21

### Fixed

- **A cancelled sign-in no longer reads as `authentication failed`.** `opencode
  mcp auth needmcp` opens an interactive prompt (`Re-authenticate? Yes / No`) and
  the CLI ran it with `execFileSync`. Without a terminal to answer it, opencode
  exits non-zero, which the CLI reported as a failed authentication even though
  nothing was wrong:

  ```
  Created — wrote mcp.needmcp in opencode.jsonc, but authentication failed
  (Command failed: opencode mcp auth needmcp). Run `opencode mcp auth needmcp` manually
  ```

  Sign-in is now driven by the user. When the process has a TTY the prompt is
  inherited and the user picks Yes/No — the exact behaviour of typing the
  command themselves. When there is no TTY (an agent, CI, piped output) the
  command is **not run at all**; the registered server is reported as ready with
  the command to run later. Either way the login step is never fatal: the entry
  is already written, and a server awaiting sign-in is recoverable while a hard
  failure is not.
- **Sign-in runs through `spawnSync`, not `execFileSync`.** On Windows
  `execFileSync` routes inherited handles through the shell's pipes, so the
  prompt never received real keystrokes. `spawnSync` with
  `stdio: "inherit"` passes stdin/stdout/stderr through untouched.
- **The reason a sign-in stopped is now reported.** The previous message
  truncated `err.message` to 200 characters, hiding whether the user cancelled,
  opencode exited with a code, or the server was unreachable. It now names the
  exit code or signal.
- **`mcp add` and the interactive client CLI use the same spawn path**, so a
  registration prompt behaves consistently; a non-TTY `mcp add` falls back to
  writing the entry directly instead of reporting a failure.

## [Unreleased]

### Changed

- **Opencode is offered as two clients again:** `opencode` (v1) and `opencode2`,
  each using its own binary for native OAuth while sharing the single
  `mcp.needmcp` shape in `opencode.jsonc`.


### Fixed

- **Opencode config is now a single hand-written file: `opencode.jsonc`.** The CLI
  previously detected the installed binary and chose between two incompatible
  layouts (`mcp.<name>` vs `mcp.servers.<name>`), asking which version you use on
  every run. That whole mechanism is gone. Both released binaries accept
  `mcp.needmcp` in `opencode.jsonc`, so there is one shape, one file, no prompt,
  and no `--opencode-layout` flag:

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

  `headers` is written in API-key mode and omitted in OAuth mode.
- **Setup no longer freezes after the scope prompt.** Detection used
  `execFileSync`, which stops the Node event loop entirely - measured at **0 timer
  ticks over 2.5s** - so the terminal sat blank while nothing could animate.
  Client detection is now async (`execFile`) and probed in parallel, leaving the
  loop alive throughout.
- **Every slow step now shows a spinner**: detecting installed clients and
  resolving the endpoint. On a non-TTY (CI, piped output) the spinner is skipped
  and the same step is logged as a plain line, so logs stay free of escape codes.
- `checkCliClient` probed one tool at a time with a blocking `where` call; it now
  runs them concurrently and asynchronously.

### Added

- **`opencode mcp auth needmcp` runs after the file is written** in OAuth mode.
  Order matters: a `mcp auth` cannot resolve a server that is not in the config
  yet. If the `opencode` binary is missing, the config is still written and the
  exact command is printed to run later.
- `scripts/verify-flow.ts` and `scripts/verify-mcp-add.ts` now assert the write is
  an **edit, not a replace**: `$schema`, `model`, `agents` and every sibling
  server survive, and `opencode.json` is never created or touched.
- `detectPaths` is honoured for every client format. Opencode now carries
  `["opencode", "opencode2"]`, so a fresh install shows as `detected` (and sorts
  with the other installed clients) instead of `not found` at the bottom of the
  picker. The list had previously treated "no config file yet" as "not
  installed" for every JSON client.

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
- Opencode is now routed through the shared capability model, so the client
  definition describes the whole flow instead of `setup.ts` special-casing it.

### Fixed

- **`.env` was ignored unless the CLI was launched from its own directory.**
  `dotenv/config` loads relative to the process cwd, and `constants.ts` read
  `process.env` at import time — before the entry module's body ran under ESM
  hoisting — so a local override silently fell back to `https://needmcp.com`.
  `src/env.ts` now loads `.env` from both the cwd and the install directory, and
  the default endpoints are lazy getters instead of top-level constants.
  `setup` also prints the resolved endpoint and flags when it came from the
  environment.
- Comments in `opencode.jsonc` are dropped silently on rewrite; the CLI now warns
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
