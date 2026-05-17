---
title: Qodo Gen
description: Step-by-step setup instructions for Qodo Gen MCP client.
---

# Qodo Gen Integration

Qodo Gen is an AI-powered IDE extension that helps you write, test, and review code more efficiently with native support for the Model Context Protocol.

## Configuration

To connect Qodo Gen to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open the Qodo Gen chat panel in your IDE (VSCode or IntelliJ).
2. Click on the **Connect more tools** button.
3. Select **+ Add new MCP**.
4. Paste the JSON configuration provided in the **Configuration** section above.
5. For more detailed information, refer to the [Qodo Gen docs](https://docs.qodo.ai/qodo-documentation/qodo-gen/qodo-gen-chat/agentic-mode/agentic-tools-mcps).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Qodo Gen chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
