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
| Opencode | `opencode.json` / `opencode.jsonc` | ✅ |
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
