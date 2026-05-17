---
title: Qwen Code
description: Step-by-step setup instructions for Qwen Code MCP client.
---

# Qwen Code Integration

Qwen Code provides powerful AI coding capabilities that can be seamlessly extended through the Model Context Protocol for a more integrated development experience.

## Configuration

To connect Qwen Code to the NeedMCP server, run the following command in your terminal:

```sh
qwen mcp add --transport http needmcp https://needmcp.com/mcp \
  --header "X-API-Key: YOUR_API_KEY" \
  --header "Accept: application/json, text/event-stream"
```

## Setup Instructions

1. Open your terminal or command prompt.
2. Execute the command provided in the **Configuration** section above, replacing `YOUR_API_KEY` with your actual NeedMCP API key.
3. By default, this saves the configuration to the project scope (`.qwen/settings.json`). 
4. **Tip:** Use the `--scope user` flag if you want to save the configuration to the global user scope instead.
5. For more details, refer to the [Qwen Code MCP Configuration](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/) guide.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Qwen Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
