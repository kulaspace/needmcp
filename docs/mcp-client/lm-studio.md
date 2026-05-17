---
title: LM Studio
description: Step-by-step setup instructions for LM Studio MCP client.
---

# LM Studio Integration

LM Studio allows you to run local LLMs and connect them to external tools and knowledge bases via the Model Context Protocol.

## Configuration

To connect LM Studio to the NeedMCP server, use the following JSON configuration in your client settings:

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

1. Open LM Studio and navigate to the **AI Chat** or **Program** section on the right side.
2. Click on the **Settings** icon (gear) or look for an **MCP** configuration option.
3. Click on **Edit mcp.json** or **Add Server**.
4. Paste the JSON configuration provided in the **Configuration** section above into the `mcpServers` object.
5. Click **Save** to apply the changes.
6. For more information, visit the [LM Studio MCP Support](https://lmstudio.ai/blog/lmstudio-v0.3.17) page.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your LM Studio chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
