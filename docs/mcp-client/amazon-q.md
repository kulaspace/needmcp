---
title: Amazon Q Developer CLI
description: Step-by-step setup instructions for Amazon Q Developer CLI MCP client.
---

# Amazon Q Developer CLI Integration

Integrate the NeedMCP server with Amazon Q Developer CLI to enhance your command-line development with AI-driven component generation.

## Configuration

To connect Amazon Q Developer CLI to the NeedMCP server, use the following JSON configuration in your client settings:

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

1.  Open your Amazon Q Developer CLI configuration file.
2.  Add the JSON configuration above to the `mcpServers` section.
3.  For more details, refer to the [Amazon Q Developer CLI documentation](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Amazon Q Developer CLI chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
