---
title: Cursor
description: Step-by-step setup instructions for Cursor MCP client.
---

# Cursor Integration

Cursor is an AI-powered code editor built for pair programming with an AI that natively supports the Model Context Protocol.

## Configuration

To connect Cursor to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open Cursor and navigate to **Settings** (Cmd+Shift+J or Ctrl+Shift+J).
2. Go to **Cursor Settings** → **MCP**.
3. Click on **Add new global MCP server**.
4. You can also manually add it by editing your Cursor `~/.cursor/mcp.json` file.
5. For more detailed information, refer to the [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Cursor chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
