---
title: Cline
description: Step-by-step setup instructions for Cline MCP client.
---

# Cline Integration

Integrate the NeedMCP server with Cline to enhance your development environment with AI-driven component generation via the MCP Server Marketplace or direct configuration.

## Configuration

To connect Cline to the NeedMCP server, use the following JSON configuration in your client settings:

```json
{
  "mcpServers": {
    "needmcp": {
      "url": "https://needmcp.com/mcp",
      "type": "streamableHttp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1.  Open **Cline**.
2.  Click the hamburger menu icon → **MCP Servers**.
3.  Choose the **Remote Servers** tab.
4.  Click **Edit Configuration**.
5.  Add the `needmcp` configuration provided above to the `mcpServers` section.
6.  Alternatively, you can install NeedMCP through the [Cline MCP Server Marketplace](https://cline.bot/mcp-marketplace).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Cline chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
