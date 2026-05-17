---
title: Trae
description: Step-by-step setup instructions for Trae MCP client.
---

# Trae Integration

Trae is an AI-first IDE designed for an adaptive and intelligent development experience, with full support for the Model Context Protocol.

## Configuration

To connect Trae to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open Trae and navigate to the Model Context Protocol settings.
2. Use the **"Add manually"** feature to create a new server connection.
3. Paste the JSON configuration provided in the **Configuration** section above.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
5. For more detailed information, refer to the [Trae documentation](https://docs.trae.ai/ide/model-context-protocol?_lang=en).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Trae chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
