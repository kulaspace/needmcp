---
title: ChatGPT (Desktop)
description: Step-by-step setup instructions for ChatGPT (Desktop) MCP client.
---

# ChatGPT (Desktop) Integration

Integrate the NeedMCP server with the ChatGPT desktop app to enhance your conversations with AI-driven component generation.

## Configuration

The ChatGPT desktop app shares apps configured on the web. Set up the app on [chatgpt.com](https://chatgpt.com) first following the same steps as [ChatGPT (Web)](/docs/mcp-client/chatgpt-web).

## Setup Instructions

1.  Log in to [ChatGPT Web](https://chatgpt.com).
2.  Follow the instructions on the [ChatGPT (Web) Integration](/docs/mcp-client/chatgpt-web) page to connect the NeedMCP server.
3.  Once configured on the web, the NeedMCP integration will automatically be available in your ChatGPT Desktop app.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your ChatGPT Desktop chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
