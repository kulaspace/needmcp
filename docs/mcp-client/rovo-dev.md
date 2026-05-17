---
title: Rovo Dev CLI
description: Step-by-step setup instructions for Rovo Dev CLI MCP client.
---

# Rovo Dev CLI Integration

Rovo Dev CLI allows you to leverage AI in your local development environment with support for external MCP servers for enhanced task automation.

## Configuration

To connect Rovo Dev CLI to the NeedMCP server, use the following JSON configuration:

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

1. Open your terminal and access the Rovo Dev CLI MCP configuration by running:
   ```bash
   acli rovodev mcp
   ```
2. In the configuration editor that opens, add the `needmcp` block to the `mcpServers` object as shown in the **Configuration** section above.
3. Save the changes and close the editor.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key to complete the setup.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Rovo Dev CLI chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
