---
name: design
description: Design or update UI layouts and screens using Pencil. Use when the user asks to create, design, update, or iterate on layouts, mockups, wireframes, screens, pages, or UI components. Always use Pencil (.pen files) for visual design work.
argument-hint: <what to design or update>
---

# Design with Pencil

All visual design work (layouts, mockups, wireframes, screens) MUST be done in Pencil using `.pen` files. Never create HTML/CSS mockups or describe layouts in text — use Pencil.

## Step 0: Verify Pencil is available

Call `get_editor_state()` to check if Pencil MCP is connected and responsive.

**If it fails or is unavailable**: Tell the user "Pencil isn't available — I can't proceed with the design. Please check the Pencil MCP connection." Then STOP. Do not attempt HTML mockups or text descriptions as a fallback.

## Step 1: Open or create the design file

Check `get_editor_state()` for the currently active `.pen` file.

- **New design**: Call `open_document('new')` to create a fresh `.pen` file, or `open_document(filePath)` if the user specifies a path.
- **Updating existing**: If there's already an active `.pen` file matching the task, use it. If not, ask the user which file to open.

## Step 2: Gather design context

Before designing, gather context for the task:

1. **Get guidelines**: Call `get_guidelines(topic)` with the relevant topic (`web-app`, `mobile-app`, `landing-page`, `design-system`, etc.)
2. **Get style guide**: Call `get_style_guide_tags` to find relevant tags, then `get_style_guide(tags)` for visual inspiration
3. **Read CLAUDE.md design tokens (MANDATORY)**: You MUST read the "Design Token Reference" section from CLAUDE.md before designing. Use Grep to find "Type Scale" in CLAUDE.md, then Read ~40 lines from that point. This contains the locked-in type scale (20/16/13/10px only), text color palette (4 colors), spacing system, and component patterns. Do NOT design from memory — read the actual values. Every font size, text color, and spacing value in the design must come from these tokens.
4. **If updating**: Call `batch_get(patterns)` to understand the current design structure before making changes

## Step 3: Design

Use `batch_design(operations)` to create or update the design. Follow these principles:

- **Inkweave theme**: Dark fantasy palette (#0d0d14 bg, #1a1a2e surface, #d4af37 gold, #e8e8e8 text)
- **Type scale**: 20px display, 16px section, 13px body, 10px micro
- **Spacing**: Follow the spacing system in CLAUDE.md Design Token Reference
- **Max 25 operations per `batch_design` call** — make multiple calls for complex designs

Use `snapshot_layout` between design steps to verify positioning.

## Step 4: Validate visually

After completing the design, call `get_screenshot` to capture the result. Present it to the user for review.

Ask: "Here's what I've designed. What would you like to change?"

## Iteration

Repeat Steps 3-4 as the user provides feedback. Each round:
1. Make changes via `batch_design`
2. `get_screenshot` to validate
3. Present and ask for feedback
