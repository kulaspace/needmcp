# needmcp-cli

NeedMCP official CLI — Configure MCP for AI coding assistants with one command.

## Prerequisites

- **Node.js** >= 22

## Get an API Key

1. Go to [needmcp.com](https://needmcp.com) and sign in
2. Navigate to the API Keys section in your dashboard
3. Generate a new key (format: `sk-need-xxx`)

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

Interactive setup — choose your AI client, select config scope (global or project), and enter your API key.

```bash
needmcp setup
```

Skip the API key prompt by passing it directly:

```bash
needmcp setup --key sk-need-xxxxxxxxxxxx
```

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
# 1. Get your API key at https://needmcp.com
# 2. Run setup (interactive)
needmcp setup

# 3. Lock a design style for your session
needmcp style set cream-artisan

# 4. Download design system to ./DESIGN.md
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
