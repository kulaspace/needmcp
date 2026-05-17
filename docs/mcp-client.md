---
title: AI Clients & Integration
order: 1
description: Connect your favorite AI coding assistants to NeedMCP for professional Design Token UI components.
---

# AI Clients & Integration

By connecting your AI coding assistant to NeedMCP, you give it direct access to a curated library of production-ready Design Token components. NeedMCP acts as an external knowledge base that your assistant can query at any time.

<Note>
  Looking for step-by-step installation guides? Visit the [Installation Guide](/docs/mcp-client/installation) for specific setup instructions for your IDE or assistant.
</Note>

## Authentication

NeedMCP requires a valid API key for all requests. Your API key should be provided using the `X-API-Key` custom header.

```json
{
  "headers": {
    "X-API-Key": "YOUR_API_KEY"
  }
}
```

You can generate and manage your API keys from the [NeedMCP Dashboard](https://needmcp.com/dashboard).

## Core Mechanisms

NeedMCP is designed to be flexible yet consistent. It uses a single endpoint but allows for runtime state management through specialized tools.

### 1. Single Endpoint Architecture

All MCP connections, regardless of the client or framework, use the same central URL:

*   **Server URL**: `https://needmcp.com/mcp`
*   **Protocol**: Model Context Protocol (MCP)

### 2. Style Locking (Recommended)

To ensure design consistency throughout your project, we recommend using the `selectStyle` tool at the beginning of your development session.

**How it works:**
1.  **Selection**: You call `selectStyle` with a specific style identifier (e.g., `"modern"`, `"glassmorphism"`).
2.  **Persistence**: For the duration of that session, all subsequent tool calls (like `getComponents`) will automatically use the locked style.
3.  **Accuracy**: This prevents the AI from "hallucinating" or mixing different design languages, keeping your UI clean and unified.

<Tip>
  Lock your style early. Use `selectStyle` with `"all"` only if you want to clear the lock and explore multiple styles simultaneously.
</Tip>

## Available Tools

The following tools are available to your AI assistant once connected to the NeedMCP server. For detailed parameter definitions, see the [Tools Reference](/docs/mcp-tools).

| Tool | Purpose | Primary Arguments |
| :--- | :--- | :--- |
| `selectStyle` | **Locks/Unlocks** a design style for the session. | `selected` (style slug or "all") |
| `getStyles` | **Discovers** available design systems and templates. | `page`, `limit` |
| `getComponents` | **Fetches** specific UI component code snippets. | `styleSlug`, `types` |
| `getDesignSystem` | **Retrieves** detailed design tokens and guidelines. | `styleSlug` |
| `getStyle` | **Provides** metadata for a specific style. | `styleSlug` |
| `sendFeedback` | **Reports** issues or suggests component improvements. | `type`, `content` |

## Quick Configuration Example

Most modern MCP-compatible clients (like Cursor or Claude Desktop) use a JSON-based configuration. Here is a standard setup template:

```json
{
  "mcpServers": {
    "needmcp": {
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Advanced Guides

We provide specialized guides for popular AI assistants that include best practices, custom rules, and advanced integration tips:

*   [**Cursor Integration**](/docs/mcp-client/cursor) - Optimized setup for Cursor Composer and `.cursorrules`.
*   [**Claude Desktop**](/docs/mcp-client/claude-desktop) - Configuration for the standalone Claude assistant.
*   [**VS Code (Cline/Roo)**](/docs/mcp-client/vscode) - Setup for VS Code extensions that support MCP.
