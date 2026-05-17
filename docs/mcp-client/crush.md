---
title: Crush
description: Step-by-step setup instructions for Crush MCP client.
---

# Crush Integration

Integrate the NeedMCP server with Crush to enhance your terminal-based development with AI-driven component generation.

## Configuration

To connect Crush to the NeedMCP server, use the following configuration in your `crush.json` file:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
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

1.  Open your Crush configuration file.
2.  Add the configuration provided above.
3.  For more information, refer to the [Crush MCP documentation](https://github.com/charmbracelet/crush#mcps).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Crush chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
