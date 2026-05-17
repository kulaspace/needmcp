---
title: MCP Installation Guide
order: 1
description: Step-by-step setup instructions for connecting NeedMCP to your AI coding assistant.
---

# MCP Installation Guide

NeedMCP follows the **Model Context Protocol (MCP)**, an open standard that allows your AI coding assistant to securely interact with our component library. This guide provides the foundational configuration details needed to get started with any supported client.

## Core Configuration Details

NeedMCP uses a single-endpoint architecture with stateful style management. Authentication is handled via a custom header.

*   **Server URL**: `https://needmcp.com/mcp`
*   **Authentication Header**: `X-API-Key`
*   **Protocol**: MCP (Model Context Protocol)

### Style Management (Runtime Locking)

Unlike traditional APIs that use different endpoints for different styles, NeedMCP uses a single endpoint. You manage the design style directly through your AI assistant using the `selectStyle` tool.

**Key Benefits:**
*   **Simplified Setup**: Configure one URL and use it for all projects.
*   **Dynamic Switching**: Change your project's design language instantly without modifying config files.
*   **Reduced Hallucinations**: Locking a style ensures the AI remains focused on a single design system.

---

## Supported AI Clients

Select your preferred AI assistant or IDE below for specific, step-by-step integration instructions.

### Popular IDEs & Extensions
*   [**Cursor**](/docs/mcp-client/cursor) - The AI-native code editor.
*   [**VS Code (Cline/Roo)**](/docs/mcp-client/vscode) - Popular MCP-capable extensions for VS Code.
*   [**Claude Desktop**](/docs/mcp-client/claude-desktop) - Standalone assistant for macOS and Windows.
*   [**JetBrains AI Assistant**](/docs/mcp-client/jetbrains) - Integration for IntelliJ IDEA, WebStorm, and PyCharm.
*   [**Visual Studio 2022**](/docs/mcp-client/visual-studio-2022) - Setup for the professional Windows IDE.

### Specialized AI Coding Assistants
*   [**Windsurf**](/docs/mcp-client/windsurf) - Next-generation AI IDE.
*   [**Zed**](/docs/mcp-client/zed) - High-performance, collaborative code editor.
*   [**Trae**](/docs/mcp-client/trae) - Adaptive AI development environment.
*   [**Claude Code**](/docs/mcp-client/claude-code) - CLI-based coding assistant from Anthropic.

### Full Alphabetical List
| | | |
| :--- | :--- | :--- |
| [Amazon Q](/docs/mcp-client/amazon-q) | [Amp](/docs/mcp-client/amp) | [Augment Code](/docs/mcp-client/augment-code) |
| [BoltAI](/docs/mcp-client/boltai) | [ChatGPT Desktop](/docs/mcp-client/chatgpt-desktop) | [ChatGPT Web](/docs/mcp-client/chatgpt-web) |
| [Cline](/docs/mcp-client/cline) | [Copilot CLI](/docs/mcp-client/copilot-cli) | [Copilot Coding Agent](/docs/mcp-client/copilot-coding-agent) |
| [Crush](/docs/mcp-client/crush) | [Emdash](/docs/mcp-client/emdash) | [Factory](/docs/mcp-client/factory) |
| [Gemini CLI](/docs/mcp-client/gemini-cli) | [Google Antigravity](/docs/mcp-client/google-antigravity) | [Kilo Code](/docs/mcp-client/kilo-code) |
| [Kiro](/docs/mcp-client/kiro) | [LM Studio](/docs/mcp-client/lm-studio) | [OpenAI Codex](/docs/mcp-client/openai-codex) |
| [Opencode](/docs/mcp-client/opencode) | [Perplexity Desktop](/docs/mcp-client/perplexity-desktop) | [Qodo Gen](/docs/mcp-client/qodo-gen) |
| [Qwen Code](/docs/mcp-client/qwen-code) | [Roo Code](/docs/mcp-client/roo-code) | [Rovo Dev CLI](/docs/mcp-client/rovo-dev) |
| [Smithery](/docs/mcp-client/smithery) | | |

---

[Back to AI Clients & Integration](/docs/mcp-client)
