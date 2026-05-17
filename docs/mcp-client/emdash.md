---
title: Emdash
description: Step-by-step setup instructions for Emdash MCP client.
---

# Emdash Integration

[Emdash](https://github.com/generalaction/emdash) is an orchestration layer designed for running multiple coding agents in parallel with seamless MCP integration.

## Configuration

To connect Emdash to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open Emdash and navigate to **Settings** → **MCP**.
2. Locate and enable the **"Enable NeedMCP MCP"** option.
3. Configure your specific coding agent (such as Codex, Claude Code, or Cursor) to connect to the NeedMCP server.
4. For further details, visit the [Emdash repository](https://github.com/generalaction/emdash).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Emdash chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
