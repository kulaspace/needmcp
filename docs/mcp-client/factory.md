---
title: Factory
description: Step-by-step setup instructions for Factory MCP client.
---

# Factory Integration

Factory's droid supports MCP servers through its CLI, allowing you to integrate powerful autonomous agents into your development workflow.

## Configuration

To connect Factory to the NeedMCP server, run the following command in your terminal:

```sh
droid mcp add needmcp https://needmcp.com/mcp --type http --header "X-API-Key: YOUR_API_KEY"
```

## Setup Instructions

1. Ensure you have the Factory CLI (`droid`) installed on your system.
2. Open your terminal or command prompt.
3. Execute the command provided in the **Configuration** section above, replacing `YOUR_API_KEY` with your actual NeedMCP API key.
4. For more information, see the [Factory MCP docs](https://docs.factory.ai/cli/configuration/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Factory chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
