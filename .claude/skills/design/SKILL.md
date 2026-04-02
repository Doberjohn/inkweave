---
name: design
description: Design or update UI layouts and screens using Pencil. Use when the user asks to create, design, update, or iterate on layouts, mockups, wireframes, screens, pages, or UI components. Always use Pencil (.pen files) for visual design work.
argument-hint: <what to design or update>
---

# Design with Pencil

All visual design work (layouts, mockups, wireframes, screens) MUST be done in Pencil using `.pen` files. Never create HTML/CSS mockups or describe layouts in text — use Pencil.

## Phase 1: Design in Pencil

### Step 0: Verify Pencil is available

Call `get_editor_state()` to check if Pencil MCP is connected and responsive.

**If it fails or is unavailable**: Tell the user "Pencil isn't available — I can't proceed with the design. Please check the Pencil MCP connection." Then STOP. Do not attempt HTML mockups or text descriptions as a fallback.

### Step 1: Open or create the design file

Check `get_editor_state()` for the currently active `.pen` file.

- **New design**: Call `open_document('new')` to create a fresh `.pen` file, or `open_document(filePath)` if the user specifies a path.
- **Updating existing**: If there's already an active `.pen` file matching the task, use it. If not, ask the user which file to open.

### Step 2: Gather design context

Before designing, gather context for the task:

1. **Get guidelines**: Call `get_guidelines(topic)` with the relevant topic (`web-app`, `mobile-app`, `landing-page`, `design-system`, etc.)
2. **Get style guide**: Call `get_style_guide_tags` to find relevant tags, then `get_style_guide(tags)` for visual inspiration
3. **Read CLAUDE.md design tokens (MANDATORY)**: You MUST read the "Design Token Reference" section from CLAUDE.md before designing. Use Grep to find "Type Scale" in CLAUDE.md, then Read ~40 lines from that point. This contains the locked-in type scale (20/16/13/10px only), text color palette (4 colors), spacing system, and component patterns. Do NOT design from memory — read the actual values. Every font size, text color, and spacing value in the design must come from these tokens.
4. **If updating**: Call `batch_get(patterns)` to understand the current design structure before making changes

### Step 3: Design

Use `batch_design(operations)` to create or update the design. Follow these principles:

- **Inkweave theme**: Dark fantasy palette (#0d0d14 bg, #1a1a2e surface, #d4af37 gold, #e8e8e8 text)
- **Type scale**: 20px display, 16px section, 13px body, 10px micro
- **Spacing**: Follow the spacing system in CLAUDE.md Design Token Reference
- **Max 25 operations per `batch_design` call** — make multiple calls for complex designs

Use `snapshot_layout` between design steps to verify positioning.

### Step 4: Validate visually

After completing the design, call `get_screenshot` to capture the result. Present it to the user for review.

Ask: "Here's what I've designed. What would you like to change?"

### Iteration

Repeat Steps 3-4 as the user provides feedback. Each round:
1. Make changes via `batch_design`
2. `get_screenshot` to validate
3. Present and ask for feedback

---

## Phase 2: UI/UX Validation (after design approval)

Once the user approves the Pencil design, perform a UI/UX quality audit before implementation. Use ultrathink (extended thinking) to deeply analyze the design.

### Step 5: UI/UX Score

Take a final `get_screenshot` of the approved design. Then use extended thinking to evaluate the design across these dimensions, scoring each 1-10:

| Dimension | What to evaluate |
|-----------|-----------------|
| **Visual Hierarchy** | Does the eye flow naturally? Is the most important element immediately obvious? |
| **Consistency** | Do spacing, colors, typography follow the design tokens? Any deviations? |
| **Affordance** | Are interactive elements obviously clickable/tappable? Do they look like what they do? |
| **Information Density** | Is every element earning its space? Too sparse or too crowded? |
| **Accessibility** | Contrast ratios, touch targets (44px min), text sizes, color-only indicators? |
| **Responsiveness** | Will this layout adapt well to mobile/tablet/desktop? Any obvious breakpoint issues? |
| **Delight** | Does anything surprise or delight? Or does it feel generic/forgettable? |
| **Cohesion** | Does every element feel like it belongs to the same design system? |

Present the scorecard as a table with scores and one-line justifications. Flag any dimension scoring below 7 as needing attention before implementation.

**If any score is below 5**: STOP and iterate back to Phase 1 to fix critical issues before proceeding.

**If all scores are 7+**: Proceed to Phase 3.

**If some scores are 5-6**: Present the gaps and ask the user whether to iterate or proceed.

---

## Phase 3: Implementation

After the design passes validation, implement it in React using the frontend-design skill's principles adapted to Inkweave's established codebase.

### Step 6: Codebase context

Before writing code, understand the existing patterns:

1. **Read existing components** in the same feature area — match their patterns (inline styles, design tokens from `shared/constants`, hook usage)
2. **Check for reusable components** in `shared/components/` — never recreate what exists
3. **Read the Pencil design** one more time (`get_screenshot`) to have the visual target fresh

### Step 7: Implement with intention

Write production React code following these principles from the frontend-design skill, adapted to Inkweave conventions:

- **Typography**: Use the established Inkweave fonts (Playfair Display for display, Inter for UI). Do not introduce new fonts.
- **Color & Theme**: Use `COLORS`, `FONTS`, `FONT_SIZES` from `shared/constants` — never hardcode hex values. The dark fantasy palette IS Inkweave's identity.
- **Motion**: CSS transitions for hover/focus states. Keep animations subtle and purposeful — Inkweave's tone is refined, not flashy.
- **Spatial Composition**: Follow the spacing system from design tokens. Use the existing layout patterns (flex/grid with inline styles).
- **Backgrounds & Details**: Leverage the existing `EtherealBackground` component and surface/border tokens for depth.

**Inkweave-specific rules**:
- Inline styles with design tokens (not CSS modules or styled-components)
- `useResponsive()` hook for responsive behavior
- `CardPreviewProvider` wrapper for any component showing card images
- Stories file (`.stories.tsx`) alongside every new visual component
- Tests for interactive behavior

### Step 8: Visual verification

After implementation, use Chrome DevTools MCP to screenshot the running component at key breakpoints:
- **320px** (iPhone SE)
- **375px** (iPhone 12-14)
- **768px** (tablet)
- **1440px** (desktop)

Compare each screenshot against the Pencil design. Fix any discrepancies before presenting to the user.

### Step 9: Present result

Show the user the implementation screenshots alongside the original Pencil design. Highlight any intentional deviations (e.g., responsive adaptations that differ from the static mockup).
