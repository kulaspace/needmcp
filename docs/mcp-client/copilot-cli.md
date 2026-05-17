---
title: Copilot CLI
description: Step-by-step setup instructions for Copilot CLI MCP client.
---

# Copilot CLI Integration

Integrate the NeedMCP server with Copilot CLI to enhance your command-line interface with AI-driven component generation.

## Configuration

To connect Copilot CLI to the NeedMCP server, use the following JSON configuration in your client settings:

```json
{
  "mcpServers": {
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

1.  Open your Copilot CLI configuration file located at `~/.copilot/mcp-config.json`.
2.  Add the JSON configuration provided above to the `mcpServers` section.
3.  For more details, refer to the Copilot CLI documentation.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Copilot CLI chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
