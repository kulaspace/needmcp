---
title: MCP Tools Reference
order: 3
description: Complete technical reference for all NeedMCP tools available to your AI coding assistant.
---

# MCP Tools Reference

This guide provides a detailed technical reference for the specialized tools available through the NeedMCP server. These tools allow your AI assistant to browse styles, retrieve components, and understand design systems directly within your development environment.

## Connectivity

All NeedMCP tools are accessed via a single authenticated endpoint:

*   **Endpoint URL**: `https://needmcp.com/mcp`
*   **Total Available Tools**: 6

NeedMCP utilizes **Runtime Style Locking**. Instead of using different URLs for different design systems, you manage state using the `selectStyle` tool.

---

## Tool Definitions

### `getStyles`

Retrieve a paginated list of all available design styles and templates in the NeedMCP library.

*   **When to use**: Call this at the start of a project or session to explore available design languages.
*   **Parameters**:

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | `number` | No | `1` | The page number for results. |
| `limit` | `number` | No | `10` | Number of items per page (Max: 100). |

*   **Sample Response**:
```json
{
  "data": [
    {
      "slug": "modern",
      "name": "Modern UI",
      "category": "Minimalist",
      "description": "A clean, high-contrast design system for SaaS applications."
    }
  ],
  "pagination": { "page": 1, "total_pages": 3 }
}
```

---

### `getComponents`

Fetch production-ready Design Token component code for a specific design style.

*   **When to use**: Use this tool when you need the AI to generate or modify specific UI elements (e.g., buttons, cards, navigation).
*   **Framework Support**: Returns framework-agnostic HTML/Design Token. The AI is instructed to adapt this code to your specific tech stack (React, Vue, Flutter, etc.).
*   **Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `styleSlug` | `string` | No | The style ID (e.g., `modern`). Ignored if a style is currently locked. |
| `types` | `string` | No | Comma-separated categories (e.g., `button,card,input`). |

*   **Note**: If a style is locked via `selectStyle`, the `styleSlug` parameter is optional and will be overridden by the locked style.

---

### `getDesignSystem`

Retrieve comprehensive design documentation for a specific style, including color palettes and typography.

*   **When to use**: Call this to give your AI a deep understanding of the "rules" of a chosen style to ensure visual consistency across custom components.
*   **Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `styleSlug` | `string` | No | The style ID. Ignored if a style is currently locked. |

---

### `getStyle`

Get detailed metadata and available component types for a specific style.

*   **When to use**: Useful for understanding the breadth of a style (e.g., how many and what types of components are available) before fetching them.
*   **Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `styleSlug` | `string` | No | The style ID. Ignored if a style is currently locked. |

---

### `selectStyle`

Locks or unlocks a specific design style for all subsequent tool calls in the current session.

*   **When to use**: **Highly Recommended.** Call this at the beginning of your task to "lock" your AI into a specific design language.
*   **Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `selected` | `string` | **Yes** | Use a style slug (e.g., `"modern"`) to lock, or `"all"` to unlock. |

---

### `sendFeedback`

Submit feedback regarding specific components or suggest new features.

*   **When to use**: Typically called **automatically** by the AI assistant when it identifies a missing component or a bug in a retrieved snippet.
*   **Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `styleSlug` | `string` | No | The style ID being referenced. |
| `type` | `string` | No | `ineffective_component`, `missing_component`, or `suggestion`. |
| `content` | `string` | **Yes** | The detailed feedback or request. |

---

## Best Practices for Tool Usage

1.  **Initialize with `selectStyle`**: Always lock your preferred style early to prevent the AI from mixing design systems.
2.  **Request `getDesignSystem` once**: Provide the AI with the design rules at the start of the session to reduce future hallucinations.
3.  **Use Type Filtering**: When calling `getComponents`, specify only the types you need (e.g., `types="navbar,footer"`) to keep context windows lean and responses fast.
4.  **Trust Automatic Feedback**: If your AI suggests sending feedback via `sendFeedback`, allow it. This helps us improve the component library for you.

## Rate Limits & Security

*   **Authentication**: All requests must include your `X-API-Key`.
*   **Rate Limiting**: Usage is governed by your subscription plan. You can monitor your current quota on the [Dashboard](https://needmcp.com/dashboard).
