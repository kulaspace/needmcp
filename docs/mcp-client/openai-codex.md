---
title: OpenAI Codex
description: Step-by-step setup instructions for OpenAI Codex MCP client.
---

# OpenAI Codex Integration

OpenAI Codex powers advanced coding assistants, and its MCP support allows for seamless integration with external tools like NeedMCP for enhanced code generation.

## Configuration

To connect OpenAI Codex to the NeedMCP server, add the following to your Codex configuration file (typically `~/.codex/config.toml` or `.codex/config.toml`):

```toml
[mcp_servers.needmcp]
url = "https://needmcp.com/mcp"
http_headers = { "X-API-Key" = "YOUR_API_KEY" }
```

## Setup Instructions

1. Open your OpenAI Codex configuration file in a text editor.
2. Add the `[mcp_servers.needmcp]` section as shown in the **Configuration** block above.
3. Replace `YOUR_API_KEY` with your actual NeedMCP API key.
4. **Note:** If you experience startup timeout errors, try increasing the `startup_timeout_sec` setting to `40`.
5. For more details, refer to the [OpenAI Codex MCP docs](https://developers.openai.com/codex/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Codex chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
