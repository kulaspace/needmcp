---
title: Perplexity Desktop
description: Step-by-step setup instructions for Perplexity Desktop MCP client.
---

# Perplexity Desktop Integration

Perplexity Desktop brings the power of AI-driven search and discovery to your desktop with extensible MCP connectors for enhanced functionality.

## Configuration

To connect Perplexity Desktop to the NeedMCP server, use the following JSON configuration when adding a new connector:

```json
{
  "url": "https://needmcp.com/mcp",
  "headers": {
    "X-API-Key": "YOUR_API_KEY"
  }
}
```

## Setup Instructions

1. Open Perplexity Desktop and navigate to **Perplexity** → **Settings**.
2. Select the **Connectors** tab from the settings menu.
3. Click the **Add Connector** button.
4. Choose the **Advanced** setup option.
5. Enter `NeedMCP` (or your preferred name) as the **Server Name**.
6. Paste the JSON configuration provided in the **Configuration** section above into the input field.
7. Click **Save** to apply the settings.
8. For further information, see the [Perplexity MCP help article](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Perplexity chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
