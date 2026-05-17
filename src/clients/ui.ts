import type { ClientConfig } from "./types.js";
import { DEFAULT_MCP_URL } from "../constants.js";

export const UI_CLIENTS: ClientConfig[] = [
  {
    id: "amazon-q",
    name: "Amazon Q Developer CLI",
    format: "ui",
    instructions: `1. Open Amazon Q Developer CLI configuration file
2. Add to mcpServers:
   "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } }
3. Save and restart`,
  },
  {
    id: "augment-code",
    name: "Augment Code",
    format: "ui",
    instructions: `1. In Augment Code, click hamburger menu → Settings
2. Navigate to Tools section
3. Click + Add MCP
4. URL: ${DEFAULT_MCP_URL}
5. Add header: X-API-Key = YOUR_API_KEY
6. Name: NeedMCP, then click Add`,
  },
  {
    id: "boltai",
    name: "BoltAI",
    format: "ui",
    instructions: `1. Open BoltAI Settings → Plugins
2. Enter this JSON:
   { "mcpServers": { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
3. Save and restart BoltAI`,
  },
  {
    id: "chatgpt-desktop",
    name: "ChatGPT Desktop",
    format: "ui",
    instructions: `1. Log in to ChatGPT Web (chatgpt.com)
2. Follow the ChatGPT (Web) setup instructions
3. Once configured on web, it automatically syncs to Desktop`,
  },
  {
    id: "chatgpt-web",
    name: "ChatGPT Web",
    format: "ui",
    instructions: `1. Go to Settings → Apps → Advanced settings → enable Developer Mode
2. Go to Settings → Apps → Create App
3. Name: NeedMCP, Description: Production-ready UI components
4. MCP Server URL: ${DEFAULT_MCP_URL}
5. Header: X-API-Key = YOUR_API_KEY
6. Save, then start chat with "use NeedMCP"`,
  },
  {
    id: "cline",
    name: "Cline",
    format: "ui",
    instructions: `1. Open Cline → hamburger menu → MCP Servers
2. Choose Remote Servers tab → Edit Configuration
3. Add to mcpServers:
   { "needmcp": { "url": "${DEFAULT_MCP_URL}", "type": "streamableHttp", "headers": { "X-API-Key": "YOUR_API_KEY" } } }
4. Save and restart`,
  },
  {
    id: "copilot-coding-agent",
    name: "Copilot Coding Agent",
    format: "ui",
    instructions: `1. Go to GitHub → Settings → Copilot → Coding agent → MCP configuration
2. Add this JSON:
   { "mcpServers": { "needmcp": { "type": "http", "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
3. Save`,
  },
  {
    id: "emdash",
    name: "Emdash",
    format: "ui",
    instructions: `1. Open Emdash → Settings → MCP
2. Enable "Enable NeedMCP MCP"
3. Configure your agent to connect to NeedMCP server`,
  },
  {
    id: "google-antigravity",
    name: "Google Antigravity",
    format: "ui",
    instructions: `1. Open your Antigravity MCP configuration file
2. Add to mcpServers:
   { "needmcp": { "serverUrl": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } }
3. Save`,
  },
  {
    id: "jetbrains",
    name: "JetBrains AI Assistant",
    format: "ui",
    instructions: `1. In JetBrains IDE: Settings → Tools → AI Assistant → Model Context Protocol (MCP)
2. Click + Add → HTTP tab
3. Paste this JSON:
   { "mcpServers": { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
4. Apply and OK`,
  },
  {
    id: "kiro",
    name: "Kiro",
    format: "ui",
    instructions: `1. Open Kiro → Kiro → MCP Servers
2. Click + Add
3. Paste this JSON:
   { "mcpServers": { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
4. Save`,
  },
  {
    id: "lm-studio",
    name: "LM Studio",
    format: "ui",
    instructions: `1. Open LM Studio → AI Chat → Settings (gear icon)
2. Click Edit mcp.json or Add Server
3. Add to mcpServers:
   { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } }
4. Save`,
  },
  {
    id: "perplexity-desktop",
    name: "Perplexity Desktop",
    format: "ui",
    instructions: `1. Open Perplexity Desktop → Perplexity → Settings → Connectors
2. Click Add Connector → Advanced setup
3. Server Name: NeedMCP
4. Paste this JSON:
   { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } }
5. Save`,
  },
  {
    id: "qodo-gen",
    name: "Qodo Gen",
    format: "ui",
    instructions: `1. Open Qodo Gen chat panel in your IDE
2. Click "Connect more tools" → + Add new MCP
3. Paste this JSON:
   { "mcpServers": { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
4. Save`,
  },
  {
    id: "roo-code",
    name: "Roo Code",
    format: "ui",
    instructions: `1. Open Roo Code MCP configuration file
2. Add to mcpServers:
   { "needmcp": { "type": "streamable-http", "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } }
3. Save and restart`,
  },
  {
    id: "rovo-dev",
    name: "Rovo Dev CLI",
    format: "ui",
    instructions: `1. Run: acli rovodev mcp
2. In the editor, add to mcpServers:
   { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } }
3. Save and close`,
  },
  {
    id: "smithery",
    name: "Smithery",
    format: "ui",
    instructions: `1. Run: npx -y @smithery/cli@latest install needmcp --client <CLIENT_NAME> --key <YOUR_SMITHERY_KEY>
   Replace <CLIENT_NAME> with your client (e.g., vscode, claude, cursor)
   Replace <YOUR_SMITHERY_KEY> with your Smithery key
2. Get your key at: https://smithery.ai/server/needmcp`,
  },
  {
    id: "trae",
    name: "Trae",
    format: "ui",
    instructions: `1. Open Trae → Model Context Protocol settings → "Add manually"
2. Paste this JSON:
   { "mcpServers": { "needmcp": { "url": "${DEFAULT_MCP_URL}", "headers": { "X-API-Key": "YOUR_API_KEY" } } } }
3. Save`,
  },
];
