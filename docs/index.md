---
title: Documentation Overview
order: 0
description: Welcome to NeedMCP - The professional bridge between your AI assistant and high-quality Design Token components.
---

# Overview

Welcome to the **NeedMCP** documentation. This guide provides everything you need to integrate our Model Context Protocol (MCP) server into your AI-driven development workflow.

**NeedMCP** is a specialized MCP server that connects your AI assistant (such as Cursor or Claude) to a curated library of professional, theme-driven UI components.

## Core Concept: Theme-Driven Development

The defining feature of **NeedMCP** is its **Style Locking** system. Instead of relying on generic AI generations, you can select and "lock" a specific design aesthetic (e.g., _Modern_, _Glassmorphism_, _Industrial_).

Once a style is locked:

1.  **Contextual Awareness**: Your AI assistant immediately understands the design tokens, component logic, and aesthetic philosophy of that specific theme.
2.  **Consistent Building**: The AI uses these theme-specific components to build your UI, ensuring visual harmony across your entire project.
3.  **Framework Agnostic**: Whether you are using **React**, **Vue**, **Angular**, **Svelte**, or mobile frameworks like **Flutter**, NeedMCP provides the AI with the necessary logic to implement the chosen theme correctly.

<Tip>
  Use the `selectStyle` tool to lock a theme once, and let your AI maintain a consistent interface across your entire tech stack.
</Tip>

## Why NeedMCP?

- **Design Precision**: Stop "guessing" styles. Your AI knows exactly which components to use based on your chosen theme.
- **Universal Compatibility**: Works seamlessly with 34+ AI clients and all major frontend frameworks.
- **Production-Ready**: All components are pre-tested, accessible, and follow modern Design Token best practices.
- **Eliminate Hallucinations**: By providing absolute, unambiguous component definitions, NeedMCP ensures consistent output regardless of the AI model being used.
- **Instant Efficiency**: Your AI fetches and implements components directly into your codebase, significantly accelerating the prototyping and development phase.

## Quick Start Path

To begin using NeedMCP, follow these four essential steps:

1.  **[Authentication](/docs/mcp-client#authentication)**: Obtain your API key from the [NeedMCP Dashboard](/dashboard).
2.  **[Choose Your Client](/docs/mcp-client)**: Select your preferred AI assistant from our list of supported tools.
3.  **[Installation](/docs/mcp-client/installation)**: Follow the specific configuration guide for your chosen environment.
4.  **[Style Locking](/docs/mcp-client#mcp-modes)**: Use the `selectStyle` tool to lock a theme and start building.

## Support & Resources

- **Style Explorer**: Browse our full collection of [Styles & Components](https://needmcp.com).
- **Feedback**: Use the `sendFeedback` tool directly within your MCP client to report issues or suggest new features.
- **API Management**: Manage your access credentials via the [Dashboard](/api-keys).

---

### Navigation

- [**MCP Clients**](/docs/mcp-client) - Supported AI assistants and setup guides.
- [**Tools Reference**](/docs/mcp-tools) - Detailed documentation for all available MCP tools.
- [**Installation Guide**](/docs/mcp-client/installation) - Step-by-step setup for your IDE or terminal.
