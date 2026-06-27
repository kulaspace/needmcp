---
title: Claude Code
description: Step-by-step setup instructions for Claude Code MCP client.
---

# Claude Code Integration

Integrate the NeedMCP server with Claude Code to enhance your terminal-based development with AI-driven component generation.

## Configuration

To connect Claude Code to the NeedMCP server, run the following command in your terminal:

```sh
claude mcp add --transport http --scope user needmcp https://needmcp.com/mcp --header "X-API-Key: YOUR_API_KEY"
```

## Setup Instructions

1.  Open your terminal.
2.  Run the command shown above, replacing `YOUR_API_KEY` with your actual NeedMCP API key.
3.  For more details, refer to the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Claude Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
