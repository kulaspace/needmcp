---
title: Amp
description: Step-by-step setup instructions for Amp MCP client.
---

# Amp Integration

Integrate the NeedMCP server with Amp to enhance your development environment with AI-driven component generation.

## Configuration

To connect Amp to the NeedMCP server, run the following command in your terminal:

```sh
amp mcp add needmcp https://needmcp.com/mcp --header "X-API-Key: YOUR_API_KEY"
```

## Setup Instructions

1.  Open your terminal.
2.  Run the command shown above, replacing `YOUR_API_KEY` with your actual NeedMCP API key.
3.  For more details, refer to the [Amp MCP documentation](https://ampcode.com/manual#mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Amp chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
