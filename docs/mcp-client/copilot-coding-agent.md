---
title: Copilot Coding Agent
description: Step-by-step setup instructions for Copilot Coding Agent MCP client.
---

# Copilot Coding Agent Integration

Integrate the NeedMCP server with Copilot Coding Agent to enhance your repository-level AI interactions with production-ready UI components.

## Configuration

To connect Copilot Coding Agent to the NeedMCP server, use the following JSON configuration in your repository settings:

```json
{
  "mcpServers": {
    "needmcp": {
      "type": "http",
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1.  Navigate to your repository on GitHub.
2.  Go to **Settings** → **Copilot** → **Coding agent** → **MCP configuration**.
3.  Add the JSON configuration provided above.
4.  For more information, refer to the [official GitHub documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Copilot Coding Agent chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
