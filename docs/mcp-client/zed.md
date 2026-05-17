---
title: Zed
description: Step-by-step setup instructions for Zed MCP client.
---

# Zed Integration

Zed is a high-performance, collaborative code editor with built-in AI capabilities that can be seamlessly extended via MCP context servers.

## Configuration

To connect Zed to the NeedMCP server, add the following to your Zed `settings.json`:

```json
{
  "context_servers": {
    "NeedMCP": {
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1. Open Zed and access your global settings by opening `settings.json`.
2. Locate the `context_servers` section or create it if it doesn't exist.
3. Add the `NeedMCP` configuration block as shown in the **Configuration** section above.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
5. For more information, refer to the [Zed Context Server docs](https://zed.dev/docs/assistant/context-servers).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Zed chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
