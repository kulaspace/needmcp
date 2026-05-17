---
title: BoltAI
description: Step-by-step setup instructions for BoltAI MCP client.
---

# BoltAI Integration

Integrate the NeedMCP server with BoltAI to enhance your development workflow with AI-driven component generation.

## Configuration

To connect BoltAI to the NeedMCP server, use the following JSON configuration in your client settings:

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

1.  Open the **Settings** page in BoltAI.
2.  Navigate to the **Plugins** section.
3.  Enter the JSON configuration provided above.
4.  For more details, refer to [BoltAI's Documentation](https://docs.boltai.com/docs/plugins/mcp-servers).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your BoltAI chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
