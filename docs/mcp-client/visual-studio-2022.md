---
title: Visual Studio 2022
description: Step-by-step setup instructions for Visual Studio 2022 MCP client.
---

# Visual Studio 2022 Integration

Visual Studio 2022 supports MCP servers to enhance its AI-driven development capabilities, enabling more powerful and context-aware tools.

## Configuration

To connect Visual Studio 2022 to the NeedMCP server, use the following JSON configuration:

```json
{
  "inputs": [],
  "servers": {
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

1. Open Visual Studio 2022 and navigate to the MCP server settings.
2. Locate the configuration file or UI for managing MCP servers.
3. Add the `needmcp` server entry to the `servers` object as shown in the **Configuration** section above.
4. Ensure the `type` is set to `http` and the `url` points to `https://needmcp.com/mcp`.
5. For more details, refer to the [Visual Studio MCP Servers documentation](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Visual Studio 2022 chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
