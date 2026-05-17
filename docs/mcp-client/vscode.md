---
title: VS Code
description: Step-by-step setup instructions for VS Code MCP client.
---

# VS Code Integration

Visual Studio Code supports the Model Context Protocol through various extensions and native integrations, enabling a more powerful AI-assisted coding workflow.

## Configuration

To connect VS Code to the NeedMCP server, add the following to your MCP configuration file:

```json
{
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

1. Open your project in Visual Studio Code.
2. Create or edit the MCP configuration file, typically located at `.vscode/mcp.json`.
3. Add the `needmcp` configuration block to the `servers` object as shown in the **Configuration** section above.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
5. For more information, refer to the [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your VS Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
