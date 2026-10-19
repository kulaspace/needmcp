# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Opencode v2 support.** Opencode is now offered as two separate clients,
  `Opencode` (v1) and `Opencode (v2)`, because v2 moved server entries from
  `mcp.<name>` to `mcp.servers.<name>` and replaced `enabled` with `disabled`.
  Writing the wrong schema leaves the server silently disabled, so the variant
  is chosen explicitly instead of guessed.
- **Native Opencode OAuth.** When Opencode is selected, the CLI now asks whether
  to let Opencode handle sign-in or to write an API key. The OAuth path runs
  `opencode mcp add needmcp --url <url>` followed by
  `opencode mcp auth needmcp`, matching the order in the Opencode docs.
  `--global` is passed for v2 global scope; v1 does not document the flag.
- `getSection()` and path-aware `mergeServerEntry()` / `removeServerEntry()` in
  `mcp-writer.ts`. Nested keys such as `["mcp", "servers"]` are created on
  write, and emptied parent objects are pruned on removal. Plain string keys
  behave exactly as before.
- `supportsNativeOAuth` and `requiresScopeChoice` client flags.

### Changed

- **`needmcp setup` asks for authentication after the client is chosen.** The
  previous order ran the CLI's own OAuth login before the client was known, so
  configuring Opencode with native OAuth left an unused API key in
  `~/.needmcp/config.json` and made the user sign in twice. Clients that do not
  support native OAuth are unaffected: they still get the API key prompt.
- Opencode now writes `opencode.jsonc` in preference to `opencode.json`.
- Opencode client entries in the setup menu show the schema they write, so v1
  and v2 are distinguishable at a glance.

### Fixed

- Opencode configurations written by the CLI used the v1 layout only, which
  Opencode v2 ignores.

### Documentation

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
