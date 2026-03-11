# Inkweave

Lorcana synergy finder for Core format with archetype-based synergy detection.

## MVP Status

Currently implementing MVP with:
- **Scope**: Core format only (sets 5+), no deck builder
- **UI**: Dark fantasy theme (deep purple, gold accents)
- **Synergies**: 4 archetypes (Discard, Bounce, Ramp, Damage/Removal) + existing rules

See `TASK.md` for MVP roadmap and GitHub issues #28-49.

## Tech Stack

- pnpm workspaces monorepo
- React 18 + TypeScript 5
- Vite bundler
- Inline CSS with design tokens (no UI framework)
- Static JSON card database

## Project Structure

```
inkweave/
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
├── packages/
│   └── synergy-engine/       # Standalone synergy detection package
│       ├── package.json      # inkweave-synergy-engine
│       ├── tsup.config.ts    # Build config
│       └── src/
│           ├── index.ts      # Public API exports
│           ├── types/        # LorcanaCard, Synergy types
│           ├── utils/        # Card helpers (textContains, hasKeyword, etc.)
│           └── engine/       # SynergyEngine class + rules
└── apps/
    └── web/                  # React web application
        ├── package.json      # inkweave-web
        ├── vite.config.ts
        └── src/
            ├── App.tsx       # Root component (two-column layout)
            ├── features/
            │   ├── cards/    # Card loading, components, hooks
            │   └── synergies/# Synergy display components, hooks
            └── shared/       # Constants, utilities, shared components
```

## Packages

### inkweave-synergy-engine

Standalone npm package for synergy detection. Zero React dependencies.

```typescript
import { SynergyEngine, type LorcanaCard } from "inkweave-synergy-engine";

const engine = new SynergyEngine();
const synergies = engine.findSynergies(card, allCards);
const result = engine.checkSynergy(cardA, cardB);
```

### inkweave-web

React web application that consumes the synergy engine package.

## Key Concepts

**Ink Colors**: Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
- Dual-ink cards (e.g., "Amethyst-Sapphire") match if either ink is selected; deck compatibility checks both inks

**Card Types**: Character, Action, Item, Location

**Game Mode**: Core only (sets 5+) - Infinity mode removed for MVP

**Synergy Categories**: direct (pair-specific, e.g. Shift), playstyle (strategy-reinforcing, e.g. Lore Steal)

**Archetypes** (MVP):
- Discard - opponent discard + payoffs
- Bounce - return to hand + ETB effects
- Ramp - ink acceleration + high-cost cards
- Damage/Removal - deal damage, banish + payoffs

**Synergy Score**: 1-10 numeric scale (all integers valid). Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4)

## Synergy Rules

Built-in rules in the engine package. **Keep this section up to date when modifying rule logic, scoring, or explanations.**

See `packages/synergy-engine/REMOVED_RULES.md` for archived rules (Singer, Evasive, Tribal, Challenger, Exert, Draw, Ink Ramp, Ward).

### Rule 1: Shift Targets (bidirectional)

Shift cards find same-named base characters; base characters find Shift cards. Both directions use the same scoring. Scores 3-10 based on curve gap, inkwell flexibility, free Shift cost tiers, and condition activation.

**Full documentation**: See [`SHIFT_TARGET_RULE.md`](SHIFT_TARGET_RULE.md) for detailed score tables, examples, condition matchers, and design rationale.

## Commands

```bash
# Root commands
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm dev              # Start web dev server

# Package-specific
pnpm build:engine     # Build synergy-engine package
pnpm test:engine      # Run engine tests
pnpm build:web        # Build web app
pnpm test:web         # Run web tests
```

## Architecture Notes

- SynergyEngine uses pluggable rules pattern - add rules via `SynergyRule` interface (runs at build time only; web app fetches pre-computed JSON)
- Synergies pre-computed at build time via `scripts/precompute-synergies.mjs`, fetched on demand per card selection
- Card data loaded once on init from `allCards.json`; synergy data lazy-loaded per card from `/data/synergies/{cardId}.json`
- Card data pre-deduplicated in `allCards.json` (same card in multiple sets appears once); loader expects clean data
- Two-column UI: CardList (340px) | SynergyResults (flex) - deck builder removed for MVP
- Floating card preview popover on hover (CardPreviewContext + CardPreviewPopover)
- Core format only (sets 5+)

## UI Theme (MVP)

Dark fantasy theme inspired by Lorcana:
- Background: #0d0d14 (near black)
- Surface: #1a1a2e (dark purple)
- Primary: #d4af37 (gold accents)
- Text: #e8e8e8 (off-white)
- Glowing borders on hover, purple-tinted shadows

## Workflow Preferences

### Git Workflow
- Feature branches: `feature/<issue-number>-<description>` (e.g., `feature/5-deck-builder-tests`)
- Commit messages: Use semantic commit notation with issue reference (e.g., `test(deck): add tests (#5)`)
- PRs should include `Closes #<issue>` to auto-close issues on merge
- **Worktrees**: Never attempt to delete or remove a worktree directory you are currently inside. Remind the user to clean it up after exiting, or switch directories first.
- **Issues**: When creating issues, always add appropriate labels. When listing issues, check for unlabeled ones proactively. When adding/removing an issue from MVP, always update BOTH the `mvp` label AND the `MVP v1.0` milestone together.

### Pre-Commit Checks (REQUIRED)
Before EVERY commit, run these checks and fix any issues:
1. `pnpm run lint` - Fix all errors (warnings OK)
2. `pnpm run test` - All unit tests must pass
3. `pnpm run test:e2e` - All E2E tests must pass

Do NOT commit or push if any check fails.

After pushing, always confirm with clear output (e.g., git log showing commit on origin/master).

### Branch Naming
- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `test/` - Test additions/improvements

### Engine Rebuilds
- **IMMEDIATELY** after modifying any file in `packages/synergy-engine/src/`, run `pnpm build:engine`. Do not wait — rebuild right after the edit, before doing anything else (unit tests, browser testing, E2E, or further code changes). Vite and the web app resolve the workspace package from its built `dist/`, so changes are invisible until rebuilt.
- After engine rebuilds that affect synergy rules/scoring, also run `pnpm precompute-synergies` to regenerate the static synergy JSON files. The Vite dev server auto-detects stale data on startup (via `ensureSynergiesPlugin`), but mid-session changes require a manual re-run.

### Synergy Rule Documentation
- When modifying rule logic, scoring, or explanations in the engine, always update the **Synergy Rules** section in this file to match. This includes score tables, condition matchers, explanation templates, and display tier definitions.

### Code Quality
- After writing or modifying significant code (new features, refactors, bug fixes), run the `code-simplifier` agent to polish for clarity and consistency
- Use `/refactor-code` for periodic comprehensive codebase audits
- When reviewing code or doing a re-review, always re-read the current file contents first — never assume you know what's already been changed. Diff against the actual working tree, not your memory of previous edits.
- When editing theme or config files, re-read the full file after edits to ensure no constants or exports were accidentally removed by the edit tool

### Data Integrity
- **Never override tool output with memory.** When presenting data from tool results (gh issue list, git log, API responses, etc.), use the actual tool output verbatim. Do not "correct" or reformat it based on memory or prior context — memory can be stale or wrong.
- **Never take action on assumptions.** If the user states a fact (e.g., "X doesn't have label Y"), do not assume they want it changed. Ask before modifying.

### Communication
- **Never silently skip work.** If you decide not to implement something the user asked for (e.g., because the plan marks it as out of scope, or it belongs to a different issue), explicitly tell the user what you're skipping and why. Do not silently ignore mockup elements, requested features, or differences the user asked you to find.

### Critical Thinking (IMPORTANT)
- **Challenge decisions proactively.** When the user proposes an approach, or when you're about to implement something, pause and consider: is there a simpler way? A hidden downside? An assumption worth questioning?
- **Flag problems you notice.** If you spot issues with current implementations while working (dead code, unnecessary complexity, stale patterns, security concerns), call them out — even if they're outside the current task scope.
- **Challenge your own suggestions too.** Before recommending an approach, consider the tradeoffs and present them honestly. Don't just validate — pressure-test.
- **Tone: collaborative, not adversarial.** Frame challenges as "have you considered..." or "one concern with this is..." — the goal is better outcomes, not debate.

### Implementation Approach
- Before editing code or implementing changes, validate assumptions against real data first (e.g., test regex against actual card data, verify existing state)
- Do not jump to implementation until the user confirms the approach

### Testing Style
- Write focused, minimal tests - not exhaustive coverage
- One test per distinct behavior, no redundant variations
- Skip trivial edge cases unless they're critical paths
- Prefer readability over coverage percentage
- Aim for 5-15 tests per component/hook, not 30+
- **E2E test inventory**: `apps/web/e2e/E2E_TESTS.md` — update this file whenever E2E tests are added, removed, or edited

### Design Session Workflow (HTML/CSS Mockups)

Inkweave uses iterative HTML/CSS mockups instead of Figma. Mockups live in `apps/web/public/mockups/` and are the source of truth for visual design before React implementation.

#### Session Structure
1. **Start**: Read ALL mockup files in parallel before making any changes. Never work from memory of a previous session — files may have changed.
2. **Scope**: Define what we're working on (new mockup, audit pass, specific fix). One focus at a time.
3. **Edit → Review → Iterate**: Make changes, user reviews in browser, discuss, refine. Repeat until approved.
4. **End**: Update plan file mockup status table. Document any pending items for next session.

#### Multi-Pass Audit Methodology
When auditing mockups, use systematic cross-page passes — one concern per pass:

| Pass | Focus | Method |
|------|-------|--------|
| **Spacing/Breathing** | Gaps, padding, margins feel too tight | Read all files → compare numeric values across pages → normalize |
| **Consistency** | Same component looks different across pages | Pick a pattern (toolbar, chips, cards) → grep values across all mockups → align |
| **Typography** | Font sizes, weights, colors follow type scale | Check every `font-size` against the scale: 10 → 13 → 16 → 20 + 14px forms |
| **Color/Contrast** | Text colors meet WCAG AA (≥4.5:1 on dark bg) | Check every `color:` value against the 4-color palette |
| **Accessibility** | Headings, landmarks, ARIA, semantics | Verify h1 per page, `<main>`, `<header>`, `<nav>`, aria-labels on inputs |
| **Navigation** | Links go where expected, correct element types | `<a>` for navigation, `<button>` for actions. No misleading affordances |

**Key principle**: Always compare the SAME value across ALL pages. E.g., "toolbar gap" should be identical on browse, playstyle-detail, show-all, card-detail. Read all files, grep the property, normalize.

#### Design Token Reference (locked in)
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
Card-detail uses group chips instead (intentionally different — it's filtering synergy groups, not card attributes).

**Navigation Semantics**:
- Logo "INKWEAVE" → `<a href="home">` (no arrow, just brand text — clicking logo = home is universal)
- Back navigation → `<a>` with explicit text ("← Back to all synergies")
- Breadcrumbs → `<nav>` with linked ancestors
- Filter chips, sort toggles → `<button>`

**Heading Hierarchy**:
- `<h1>` = page identity (card name on detail, page title on catalog, aggregate label in modal)
- `<h2>` = major sections ("Synergies", group titles in show-all)
- `<h3>` = group names within sections

#### Cross-Page Consistency Checklist
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

### Worktree & Agent Workflow
- **Default: sequential, one agent at a time.** Use parallel agents only for read-only research/exploration or trivially independent tasks with clear specs.
- **Prefer feature branches over worktrees.** Only use worktrees when you need to pause mid-task and switch context, or run concurrent dev servers.
- **Max 2 active worktrees.** Port assignments: main=5173, worktree-1=5174, worktree-2=5175.
- **Same-session cleanup.** Every worktree created in a session must be cleaned up in that session (or explicitly flagged for next session in MEMORY.md).
- **Never leave orphan branches.** After merging a PR, delete the local branch and worktree immediately.
- **Pre-commit timeout.** Always use `timeout: 600000` for git commit (pre-commit hooks run lint + test + E2E, ~2-3 min).
- **Port conflicts.** Before starting a dev server or running E2E tests, check ports 5173-5175 and kill stale processes.
