---
title: ChatGPT (Web)
description: Step-by-step setup instructions for ChatGPT (Web) MCP client.
---

# ChatGPT (Web) Integration

Integrate the NeedMCP server with ChatGPT Web to enhance your conversations with AI-driven component generation via Developer Mode.

## Configuration

To connect ChatGPT (Web) to the NeedMCP server, follow these steps to enable Developer Mode and create a remote connector.

### Developer Mode Settings
| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Name**           | `NeedMCP`                                          |
| **Description**    | `Production-ready UI components for any framework` |
| **MCP Server URL** | `https://needmcp.com/mcp`                          |
| **Header**         | `X-API-Key: YOUR_API_KEY`                          |

## Setup Instructions

1.  Enable Developer Mode: Go to **Settings** → **Apps** → **Advanced settings** and enable **Developer Mode**.
2.  Create an App: In **Settings** → **Apps**, click **Create App**.
3.  Fill in the details from the table above, replacing `YOUR_API_KEY` with your actual NeedMCP API key.
4.  Start a new chat, click the plus icon, hover over **More**, and select the **NeedMCP** app.
5.  Alternatively, you can simply say `use NeedMCP` in your prompt.
6.  For more information, refer to the [OpenAI MCP documentation](https://platform.openai.com/docs/mcp).

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your ChatGPT Web chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
