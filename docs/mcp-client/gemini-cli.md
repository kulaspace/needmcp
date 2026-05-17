---
title: Gemini CLI
description: Step-by-step setup instructions for Gemini CLI MCP client.
---

# Gemini CLI Integration

Gemini CLI allows you to interact with Google's Gemini models directly from your terminal with full support for the Model Context Protocol.

## Configuration

To connect Gemini CLI to the NeedMCP server, add the following to the `mcpServers` object in your configuration:

```json
{
  "mcpServers": {
    "needmcp": {
      "httpUrl": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

## Setup Instructions

1. Open the Gemini CLI settings file, typically located at `~/.gemini/settings.json`.
2. Locate the `mcpServers` section in the JSON file.
3. Add the `needmcp` configuration block as shown in the **Configuration** section above.
4. For more details, refer to the [Gemini CLI Configuration](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) guide.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Gemini CLI chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
