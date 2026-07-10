---
description: Design-session conventions for the HTML/CSS mockups scratch folder.
paths:
  - "apps/web/public/mockups/**"
---

# Design Session Workflow (HTML/CSS Mockups)

Inkweave uses iterative HTML/CSS mockups instead of Figma. Mockups live in `apps/web/public/mockups/`, a **git-ignored, local-only** scratch folder for pre-code design work; the files are never committed. They are the working reference for visual design during a design session, before React implementation.

The tokens below are the **mockup** design language. The shipped app's tokens live in `apps/web/src/shared/constants/theme.ts`, which is the source of truth for React code.

## Session Structure
1. **Start**: Read ALL mockup files in parallel before making any changes. Never work from memory of a previous session, files may have changed.
2. **Scope**: Define what we're working on (new mockup, audit pass, specific fix). One focus at a time.
3. **Edit → Review → Iterate**: Make changes, user reviews in browser, discuss, refine. Repeat until approved.
4. **End**: Update plan file mockup status table. Document any pending items for next session.

## Multi-Pass Audit Methodology
When auditing mockups, use systematic cross-page passes, one concern per pass:

| Pass | Focus | Method |
|------|-------|--------|
| **Spacing/Breathing** | Gaps, padding, margins feel too tight | Read all files → compare numeric values across pages → normalize |
| **Consistency** | Same component looks different across pages | Pick a pattern (toolbar, chips, cards) → grep values across all mockups → align |
| **Typography** | Font sizes, weights, colors follow type scale | Check every `font-size` against the scale: 10 → 13 → 16 → 20 + 14px forms |
| **Color/Contrast** | Text colors meet WCAG AA (≥4.5:1 on dark bg) | Check every `color:` value against the 4-color palette |
| **Accessibility** | Headings, landmarks, ARIA, semantics | Verify h1 per page, `<main>`, `<header>`, `<nav>`, aria-labels on inputs |
| **Navigation** | Links go where expected, correct element types | `<a>` for navigation, `<button>` for actions. No misleading affordances |

**Key principle**: Always compare the SAME value across ALL pages. E.g., "toolbar gap" should be identical on browse, playstyle-detail, show-all, card-detail. Read all files, grep the property, normalize.

## Design Token Reference (locked in)
These values are final and must be used consistently across all mockups:

**Type Scale** (major third ~1.25):
- Display: `20px` (page titles, card names, hero names)
- Section: `16px` (section headings like "Synergies", group titles in show-all)
- Body: `13px` (most UI text, chips, labels, descriptions, breakdown rows)
- Micro: `10px` (badges, count circles, hover cues, metadata)
- Form exception: `14px` (search inputs only)
- Hierarchy via weight/case/color, NOT pixel nudges. No 11px, 12px, 22px.

**Text Color Palette** (4 colors, all WCAG AA):
- `#e8e8e8` — primary text (card names, headings, active UI)
- `#90a1b9` — muted text (labels, counts, secondary info, placeholders in non-input contexts)
- `#d4af37` / `#ffb900` — gold (brand, accents, active states, CTAs)
- `#c8c8d8` — description text (supplementary/educational content, slightly softer than primary)
- `#aaaaaa` — placeholder text inside inputs/empty states only

**Spacing System**:
- Left panel gap: `16px` | Left panel padding: `16px`
- Text box padding: `12px`
- Toolbar gap: `10px` (all pages)
- Group header margin-bottom: `8px`
- Group description margin: `8px 0 16px`
- Synergy group margin-bottom: `20px`
- Card grid gap: `10px` (synergy grids), `12px` (browse/playstyle grids)

**Toolbar Pattern** (shared across browse, playstyle-detail, show-all):
`[Filters btn (count)] | [result count] [active chips ✕] [Clear all] ... [Sort ▼]`
Card-detail uses group chips instead (intentionally different, it's filtering synergy groups, not card attributes).

**Navigation Semantics**:
- Logo "INKWEAVE" → `<a href="home">` (no arrow, just brand text; clicking logo = home is universal)
- Back navigation → `<a>` with explicit text ("← Back to all synergies")
- Breadcrumbs → `<nav>` with linked ancestors
- Filter chips, sort toggles → `<button>`

**Heading Hierarchy**:
- `<h1>` = page identity (card name on detail, page title on catalog, aggregate label in modal)
- `<h2>` = major sections ("Synergies", group titles in show-all)
- `<h3>` = group names within sections

## Cross-Page Consistency Checklist
Before approving any mockup, verify these match across all pages:
- [ ] Toolbar gap, button sizes, chip padding identical
- [ ] Font sizes follow type scale exactly (no custom sizes)
- [ ] Text colors from the 4-color palette only
- [ ] Close character: `×` (U+00D7) everywhere
- [ ] Logo: just "INKWEAVE" (no arrow), links to home
- [ ] Search input: `aria-label="Search cards"`, `placeholder="Search cards..."`
- [ ] Sort select: `aria-label` matches context ("Sort cards" or "Sort synergies")
- [ ] `<main>` landmark wraps page content
- [ ] `<h1>` exists exactly once per page
- [ ] Dashed tiles: `#151525` bg, `#444466` border, gold text
