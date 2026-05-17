---
title: Google Antigravity
description: Step-by-step setup instructions for Google Antigravity MCP client.
---

# Google Antigravity Integration

Google Antigravity is a high-performance development environment with built-in MCP support for AI-assisted coding and advanced development workflows.

## Configuration

To connect Google Antigravity to the NeedMCP server, add the following to your Antigravity MCP configuration file:

```json
{
  "mcpServers": {
    "needmcp": {
      "serverUrl": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1. Open your Google Antigravity MCP configuration file.
2. Locate the `mcpServers` object in the JSON structure.
3. Add the `needmcp` configuration block as shown in the **Configuration** section above.
4. For more detailed information, refer to the [Antigravity MCP docs](https://antigravity.google/docs/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Google Antigravity chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
