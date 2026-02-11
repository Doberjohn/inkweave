---
allowed-tools: Bash(pnpm:*), mcp__Claude_in_Chrome__tabs_context_mcp, mcp__Claude_in_Chrome__tabs_create_mcp, mcp__Claude_in_Chrome__navigate
description: Start the Vite dev server and open the app in Chrome
---

1. Run the app dev server in the background:

```
pnpm dev
```

2. After starting, read the output to find the URL (usually http://localhost:5173 or :5174).

3. Open the app URL in a Chrome tab using the MCP browser tools:
   - Get/create a tab group with `tabs_context_mcp` (createIfEmpty: true)
   - Create a new tab with `tabs_create_mcp`
   - Navigate to the dev server URL
