---
title: JetBrains AI Assistant
description: Step-by-step setup instructions for JetBrains AI Assistant MCP client.
---

# JetBrains AI Assistant Integration

JetBrains AI Assistant brings the power of AI directly to all JetBrains IDEs, including IntelliJ IDEA, WebStorm, and PyCharm, with full MCP support.

## Configuration

To connect JetBrains AI Assistant to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. In your JetBrains IDE, navigate to **Settings** → **Tools** → **AI Assistant** → **Model Context Protocol (MCP)**.
2. Click the **+ Add** button.
3. Select the **HTTP** tab in the dialog that appears.
4. Paste the JSON configuration provided in the **Configuration** section above.
5. Click **Apply** and then **OK** to save your changes.
6. For more details, refer to the [JetBrains AI Assistant Documentation](https://www.jetbrains.com/help/ai-assistant/configure-an-mcp-server.html).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your JetBrains AI Assistant chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
