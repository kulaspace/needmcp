# needmcp-cli

NeedMCP official CLI — Configure MCP for AI coding assistants with one command.

## Prerequisites

- **Node.js** >= 22

## Authentication

NeedMCP uses an API key to authenticate requests. You can obtain a key in one of two ways:

### 1. Browser login (OAuth) — recommended

The easiest way. During `needmcp setup`, choose **Login with Browser (OAuth)**: a browser tab opens, you sign in to NeedMCP, and a dedicated API key is generated automatically and saved to `~/.needmcp/config.json`. No copy-pasting required.

### 2. Manual API key

1. Go to [needmcp.com](https://needmcp.com) and sign in
2. Navigate to the API Keys section in your dashboard
3. Generate a new key (format: `sk-need-xxx`) and paste it during setup

> **Note:** Guest mode (unauthenticated, limited requests) is temporarily disabled. An API key is required to complete setup.

## Installation

```bash
npm install -g needmcp
```

Or run directly with npx (no install required):

```bash
npx needmcp --help
```

## Commands

### `needmcp setup`

Interactive setup — choose your AI client, select config scope (global or project), and authenticate.

```bash
needmcp setup
```

When run, you'll be asked **how to authenticate**:

| Option | Description |
| :--- | :--- |
| Login with Browser (OAuth) | *(Recommended)* Opens your browser and auto-generates a dedicated API key |
| Enter API Key | Paste an existing `sk-need-xxx` key |

If a valid key is already stored at `~/.needmcp/config.json`, you'll be asked whether to reuse it.

#### OAuth 2.1 vs API key

> **Two different things share the OAuth name.** `needmcp setup --auth oauth` is
> *OAuth-to-get-a-key*: it signs you in and stores a long-lived `sk-need-*` key in
> `~/.needmcp/config.json`. **OAuth 2.1 client mode** (below) is different: the AI
> client itself obtains and refreshes an OAuth access token.

The NeedMCP `/mcp` endpoint accepts **both** credential families on the same route,
discriminated purely by token prefix:

| Credential | Prefix | Lifetime | Refreshed by |
| :--- | :--- | :--- | :--- |
| API key | `sk-need-*` / `sk_need_*` | until revoked | nobody (static) |
| OAuth access token | `mcp_at_*` | 1 hour | the client (`mcp_rt_*`, 30 days) |

For clients that speak OAuth 2.1, `needmcp setup` offers **OAuth 2.1** (default) or
**API key**. OAuth mode writes a **header-free** config entry so the client can run
its own browser sign-in and refresh loop. API-key mode is unchanged.

> **Why OAuth entries carry no header:** the server reads `X-API-Key` *before*
> `Authorization: Bearer` and feeds both into the same check. A leftover API key
> therefore takes precedence over a valid OAuth token and the connection fails with
> `Invalid or revoked API key`. Switching modes replaces the whole `needmcp` entry,
> so a stale header is dropped on the next setup run.

Supported clients and how OAuth is driven:

| Client | OAuth | Automatic? | How sign-in happens |
| :--- | :--- | :--- | :--- |
| Claude Code | ✅ | Yes | `claude mcp add --transport http`, then `/mcp` in-session |
| Amp | ✅ | Yes | `amp mcp add` — sign-in on first use |
| Factory (droid) | ✅ | Yes | `droid mcp add --type http`, then `/mcp` |
| OpenCode | ✅ | Yes | writes `opencode.json` (layout per installed version), then `opencode mcp auth needmcp` |
| OpenAI Codex | ✅ | Yes | `codex mcp add` → `codex mcp login needmcp` |
| Qwen Code | ✅ | Yes | `qwen mcp add --transport http` |
| Gemini CLI | ✅ | Yes | `gemini mcp add --transport http` (adds the RFC 9207 opt-out below) |
| Kilo Code | ✅ | Yes | `kilo mcp add` → `kilo mcp auth needmcp` |
| Cursor | ✅ | Config only | entry written; Cursor prompts in-app |
| VS Code | ✅ | Config only | `.vscode/mcp.json`, `type: http` |
| Zed | ✅ | Config only | `context_servers` entry, no header |
| Kiro | ✅ | Config only | `mcpServers` entry |
| Crush | ✅ | Config only | entry with `"oauth": true` |
| Windsurf, JetBrains, Trae, Google Antigravity, Amazon Q, LM Studio, Visual Studio, Copilot CLI, Claude Desktop | ❌ | — | **API key only** (OAuth missing or unstable) |

**Gemini CLI caveat:** Gemini validates the RFC 9207 `iss` parameter whenever an
issuer is discovered, and NeedMCP does not advertise
`authorization_response_iss_parameter_supported`. The written entry therefore
includes `"authorizationResponseIssParameterSupported": false`; without it every
callback is rejected.

**Opencode caveats** — all verified against the real binaries, `opencode`
1.2.27 and `opencode2` 2.0.32:

The two versions use incompatible config layouts and each rejects the other's:

| | Opencode 1.2.27 | Opencode 2.0.32 |
|---|---|---|
| Config key | `mcp.<name>` | `mcp.servers.<name>` |
| Entry | `{type, url, enabled, oauth, headers}` | `{type, url, headers, disabled}` |
| Reads `opencode.json` | yes | yes |
| Reads `opencode.jsonc` | yes | **no** |

- The installed version therefore decides the layout. When **both** versions are
  installed, `needmcp setup` asks which one you use — every run, since the answer
  is never persisted, so switching binaries needs no reset. Non-interactive runs
  must say so explicitly with `--opencode-layout v1|v2`; without it they fail
  rather than guess, because guessing writes a config the running binary silently
  ignores.
- Switching versions cleans up after itself: the entry left at the other
  layout's path is removed (only `needmcp`; other servers stay). When that empties
  `mcp.servers`, the container itself is dropped — 1.x rejects the key even when
  it holds nothing.
- `needmcp list` reports an entry sitting at the other layout's path as
  `stale v1|v2 layout` rather than `configured`, since the running binary cannot
  see it.
- The two layouts **cannot** be combined. 1.x fails the *entire* config with
  `Invalid input mcp.servers`, hiding every other server.
- `opencode.json` is the only file written — it is the one name both versions
  read. Both parse it as JSONC, so comments are still allowed in it.
- An old `opencode.jsonc` from an earlier CLI release is **read once** to
  migrate its servers and is never modified or deleted.
- `opencode mcp add` is used only for 2.x. 1.x's `mcp add` is an interactive
  wizard with no flags (`--url`, `--header`, `--global` are absent), so it
  cannot be scripted; 1.x falls back to writing the file directly.
- `mcp add --header` takes `key=value`, **not** `key: value`.
- API-key mode must keep the server live and keyed: 1.x needs `"oauth": false`
  (otherwise Opencode ignores `X-API-Key` and parks the server at *needs
  authentication* — the exact symptom of "the tool never gets called"); 2.x
  uses `"disabled": false`.
- `opencode2 mcp list` is not usable for verification: its background service
  binds to the first project directory it ever saw and keeps serving that one.
  Use `opencode2 debug config` to see what it actually parsed.

**No token revocation endpoint.** NeedMCP exposes no `/oauth/revoke`, so the CLI
cannot revoke an OAuth token programmatically. Use the client's own sign-out, or
revoke the connection from the NeedMCP dashboard.

#### Skip the prompts

Authenticate and configure in a single command:

```bash
# Authenticate with browser OAuth
needmcp setup --auth oauth

# Provide an API key directly
needmcp setup --key sk-need-xxxxxxxxxxxx
needmcp setup --auth key
```

| Flag | Description |
| :--- | :--- |
| `-k, --key <key>` | Use the provided NeedMCP API key |
| `-a, --auth <method>` | Auth method: `oauth` or `key` |
| `-l, --opencode-layout <version>` | Skip the OpenCode version question: `v1` or `v2` |

### `needmcp remove`

Remove the NeedMCP server entry from a client's configuration.

```bash
needmcp remove
```

### `needmcp style set <slug>`

Activate/lock a design style. If NeedMCP is not yet configured, setup runs automatically first.

```bash
needmcp style set cream-artisan
```

### `needmcp design <slug>`

Download a style's design system as `DESIGN.md` in the current directory.

Uses the API key from `~/.needmcp/config.json` (`X-API-Key` header) and respects `NEEDMCP_BASE_URL` if set. Fetches `GET /api/styles/{slug}/designmd`.

```bash
# Download to ./DESIGN.md
needmcp design modern-dashboard

# Overwrite without confirmation
needmcp design modern-dashboard --force
```

Behavior:

- Saves to `DESIGN.md` in the folder where the CLI is run
- If `DESIGN.md` already exists, prompts for confirmation (use `--force` / `-f` to skip)
- `403` — design system is premium (subscribe to access)
- `404` — style not found
- `401` — invalid API key (`needmcp setup` to configure)

### `needmcp --help`

Show help with all commands and examples.

### `needmcp --version`

Show installed version.

## Step-by-Step

```bash
# 1. Run setup (interactive) — choose "Login with Browser (OAuth)" when prompted
needmcp setup

# Alternatively, authenticate non-interactively:
#   needmcp setup --auth oauth          (browser login)
#   needmcp setup --key sk-need-xxxx    (paste your key)

# 2. Lock a design style for your session
needmcp style set cream-artisan

# 3. Download design system to ./DESIGN.md
needmcp design modern-dashboard

# Done! Your AI assistant now has access to NeedMCP components.
# To remove the configuration later:
needmcp remove
```

## Environment Variables

The CLI reads environment variables, including from a `.env` file in the
current working directory (via `dotenv`).

| Variable | Description |
| :--- | :--- |
| `NEEDMCP_BASE_URL` | Override the base URL for both API and MCP endpoints |
| `NEEDMCP_MCP_URL` | Override the base URL for the MCP server only |

> **Warning — do not run `needmcp` inside an untrusted repository.**
> Because a `.env` file in the current directory is loaded automatically, a
> repository that ships its own `.env` can redirect the base URL. Running
> `npx needmcp setup` in such a directory would send your API key to that
> server instead of `needmcp.com`.
>
> To stay safe:
> - Don't run `needmcp` in a cloned repository you don't trust.
> - Check for a local `.env` before running setup, or run setup from your home
>   directory (`cd ~ && npx needmcp setup`).
> - Only set `NEEDMCP_BASE_URL` yourself if you intend to point the CLI at
>   another server.

## Supported Clients

| Client | Configures | Auto |
| :--- | :--- | :---: |
| Cursor | `mcp.json` | ✅ |
| Claude Desktop | `claude_desktop_config.json` | ✅ |
| Windsurf | `mcp_config.json` | ✅ |
| Zed | `settings.json` | ✅ |
| VS Code | `.vscode/mcp.json` | ✅ |
| Gemini CLI | `settings.json` | ✅ |
| GitHub Copilot CLI | `mcp-config.json` | ✅ |
| Opencode | `opencode.json` (`mcp.<name>` on 1.x, `mcp.servers.<name>` on 2.x) | ✅ |
| Kiro | `mcp.json` | ✅ |
| Kilo Code | `mcp.json` | ✅ |
| Visual Studio 2022 | `.vs/mcp.json` | ✅ |
| Trae | `.trae/mcp.json` | ✅ |
| Crush | `crush.json` | ✅ |
| Google Antigravity | `mcp_config.json` | ✅ |
| OpenAI Codex | `config.toml` | ✅ |
| Claude Code | `claude mcp add` | ✅ |
| Amp | `amp mcp add` | ✅ |
| Factory (droid) | `droid mcp add` | ✅ |
| Qwen Code | `qwen mcp add` | ✅ |
| Augment Code | Manual via Settings | |
| BoltAI | Manual via Settings | |
| Cline | Manual via MCP Servers | |
| Roo Code | Manual via MCP Config | |
| JetBrains AI | Manual via Settings | |
| LM Studio | Manual via Settings | |
| Amazon Q Developer CLI | Manual via Settings | |
| ChatGPT Desktop | Manual via Settings | |
| ChatGPT Web | Manual via Settings | |
| Copilot Coding Agent | Manual via Settings | |
| Emdash | Manual via Settings | |
| Perplexity Desktop | Manual via Settings | |
| Qodo Gen | Manual via Settings | |
| Rovo Dev CLI | Manual via Settings | |
| Smithery | Manual via CLI | |

## Documentation

Full documentation at [needmcp.com/docs](https://needmcp.com/docs)
