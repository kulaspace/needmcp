---
title: Windsurf
description: Step-by-step setup instructions for Windsurf MCP client.
---

# Windsurf Integration

Windsurf is a next-generation AI agent for coding that leverages the Model Context Protocol to interact with external tools and provide a more autonomous development experience.

## Configuration

To connect Windsurf to the NeedMCP server, add the following to your Windsurf MCP configuration file:

```json
{
  "mcpServers": {
    "needmcp": {
      "serverUrl": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Setup Instructions

1. Open your Windsurf MCP configuration file.
2. Locate the `mcpServers` object in the JSON structure.
3. Add the `needmcp` configuration block as shown in the **Configuration** section above.
4. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
5. For more detailed information, refer to the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Windsurf chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
