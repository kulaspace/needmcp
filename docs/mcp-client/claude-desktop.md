---
title: Claude Desktop
description: Step-by-step setup instructions for Claude Desktop MCP client.
---

# Claude Desktop Integration

Integrate the NeedMCP server with Claude Desktop to enhance your development workflow with AI-driven component generation.

## Configuration

To connect Claude Desktop to the NeedMCP server, use the following JSON configuration in your client settings:

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

## Setup Instructions

1.  Open your Claude Desktop developer settings.
2.  Locate and edit your `claude_desktop_config.json` file.
3.  Add the JSON configuration provided above to the `mcpServers` section.
4.  For more information, refer to the [Claude Desktop MCP documentation](https://modelcontextprotocol.io/quickstart/user).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Claude Desktop chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
