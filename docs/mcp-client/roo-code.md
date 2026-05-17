---
title: Roo Code
description: Step-by-step setup instructions for Roo Code MCP client.
---

# Roo Code Integration

Roo Code is an AI-native coding environment that leverages the Model Context Protocol to provide a highly contextual and capable development experience.

## Configuration

To connect Roo Code to the NeedMCP server, use the following JSON configuration in your client settings:

```json
{
  "mcpServers": {
    "needmcp": {
      "type": "streamable-http",
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1. Open your Roo Code MCP configuration file.
2. Locate the `mcpServers` object in the configuration.
3. Add the `needmcp` configuration block as shown in the **Configuration** section above.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
5. For more detailed information, refer to the [Roo Code MCP docs](https://docs.roocode.com/features/mcp/using-mcp-in-roo).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Roo Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
