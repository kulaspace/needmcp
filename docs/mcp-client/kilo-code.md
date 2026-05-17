---
title: Kilo Code
description: Step-by-step setup instructions for Kilo Code MCP client.
---

# Kilo Code Integration

Kilo Code is a modern, collaborative code editor that leverages the Model Context Protocol to provide context-aware AI assistance across your projects.

## Configuration

To connect Kilo Code to the NeedMCP server, you can use either the UI or manual file configuration.

### Manual Configuration

Create or edit `.kilocode/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "needmcp": {
      "type": "streamable-http",
      "url": "https://needmcp.com/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      },
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
```

## Setup Instructions

### Option 1: Configure via UI

1. Open **Kilo Code** and click the **Settings** icon in the top-right corner.
2. Navigate to **Settings** → **MCP Servers**.
3. Click **Add Server** and choose **HTTP Server** (Streamable HTTP Transport).
4. Enter the following details:
    - **URL**: `https://needmcp.com/mcp`
    - **Headers → Add Header**:
        - **Key:** `X-API-Key`
        - **Value:** `YOUR_API_KEY`
5. Click **Save**.

### Option 2: Manual Configuration

1. Create a directory named `.kilocode` in your project's root folder if it doesn't exist.
2. Create a file named `mcp.json` inside the `.kilocode` directory.
3. Paste the configuration block provided in the **Manual Configuration** section above.
4. Alternatively, you can edit your global `mcp_settings.json` file.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Kilo Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
