---
title: Opencode
description: Step-by-step setup instructions for Opencode MCP client.
---

# Opencode Integration

Opencode is an open-source AI coding assistant that supports remote MCP servers to provide enhanced context and tools for developers.

## Configuration

To connect Opencode to the NeedMCP server, use the following JSON configuration in your client settings:

```json
{
  "mcp": {
    "needmcp": {
      "type": "remote",
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      },
      "enabled": true
    }
  }
}
```

## Setup Instructions

1. Open your Opencode configuration file.
2. Locate the `mcp` section or create it if it doesn't exist.
3. Add the `needmcp` configuration block as shown in the **Configuration** section above.
4. Ensure the `enabled` field is set to `true` to activate the connection.
5. For more detailed information, refer to the [Opencode MCP docs](https://opencode.ai/docs/mcp-servers).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Opencode chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
