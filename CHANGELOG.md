# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
