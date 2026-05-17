---
title: Augment Code
description: Step-by-step setup instructions for Augment Code MCP client.
---

# Augment Code Integration

Integrate the NeedMCP server with Augment Code to enhance your development environment with AI-driven component generation.

## Configuration

To connect Augment Code to the NeedMCP server, use the following settings in your client:

- **Name:** `NeedMCP`
- **URL:** `https://needmcp.com/mcp`
- **Header Key:** `X-API-Key`
- **Header Value:** `YOUR_API_KEY`

## Setup Instructions

1.  In Augment Code, click the hamburger menu → **Settings**.
2.  Navigate to the **Tools** section.
3.  Click the **+ Add MCP** button.
4.  Enter the URL: `https://needmcp.com/mcp`.
5.  Add the header:
    - **Key:** `X-API-Key`
    - **Value:** `YOUR_API_KEY`
6.  Name the MCP: **NeedMCP**.
7.  Click **Add**.

## Style Locking

Once connected, it is highly recommended to use the `selectStyle` tool to lock a specific design language for your project. This ensures consistency and reduces AI hallucinations.

1.  In your Augment Code chat interface, call: `selectStyle(selected: "modern")` (replace "modern" with your preferred style slug).
2.  All subsequent component requests in this session will automatically use the locked style.
3.  To unlock or switch styles, use: `selectStyle(selected: "all")`.

---

[Back to AI Clients](/docs/mcp-client)
