---
title: Smithery
description: Step-by-step setup instructions for Smithery MCP client.
---

# Smithery Integration

Smithery provides an automated way to install and manage MCP servers for various AI clients using a simple and powerful CLI tool.

## Configuration

To install NeedMCP automatically via Smithery, use the following CLI command:

```bash
npx -y @smithery/cli@latest install needmcp --client <CLIENT_NAME> --key <YOUR_SMITHERY_KEY>
```

## Setup Instructions

1. Ensure you have Node.js and npm installed on your system.
2. Open your terminal or command prompt.
3. Run the command provided in the **Configuration** section above.
4. Replace `<CLIENT_NAME>` with the name of your AI client (e.g., `vscode`, `claude`, `cursor`).
5. Replace `<YOUR_SMITHERY_KEY>` with your personal key obtained from Smithery.
6. You can find your key and more details at [smithery.ai/server/needmcp](https://smithery.ai/server/needmcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your client's chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
