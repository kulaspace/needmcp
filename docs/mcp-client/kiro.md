---
title: Kiro
description: Step-by-step setup instructions for Kiro MCP client.
---

# Kiro Integration

Kiro is a lightweight and efficient IDE designed for speed, featuring native integration with the Model Context Protocol for enhanced AI capabilities.

## Configuration

To connect Kiro to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open Kiro and navigate to **Kiro** → **MCP Servers**.
2. Click the **+ Add** button to create a new MCP server entry.
3. Paste the JSON configuration provided in the **Configuration** section above.
4. Click **Save** to apply the changes.
5. For more details, refer to the [Kiro MCP Documentation](https://kiro.dev/docs/mcp/configuration/).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Kiro chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
