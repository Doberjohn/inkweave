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
│       ├── package.json      # lorcana-synergy-engine
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

### lorcana-synergy-engine

Standalone npm package for synergy detection. Zero React dependencies.

```typescript
import { SynergyEngine, type LorcanaCard } from "lorcana-synergy-engine";

const engine = new SynergyEngine();
const synergies = engine.findSynergies(card, allCards);
const result = engine.checkSynergy(cardA, cardB);
```

### inkweave-web

React web application that consumes the synergy engine package.

## Key Concepts

**Ink Colors**: Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
- Dual-ink cards (e.g., "Amethyst-Sapphire") use primary ink for filtering

**Card Types**: Character, Action, Item, Location

**Game Mode**: Core only (sets 5+) - Infinity mode removed for MVP

**Synergy Categories**: direct (pair-specific, e.g. Shift), playstyle (strategy-reinforcing, e.g. Lore Denial)

**Archetypes** (MVP):
- Discard - opponent discard + payoffs
- Bounce - return to hand + ETB effects
- Ramp - ink acceleration + high-cost cards
- Damage/Removal - deal damage, banish + payoffs

**Synergy Strength**: weak, moderate, strong

## Synergy Rules

Built-in rules in the engine package:

1. Shift Targets (bidirectional) - Shift cards find same-named targets; base characters find Shift cards that can shift onto them

See `packages/synergy-engine/REMOVED_RULES.md` for archived rules (Singer, Evasive, Tribal, Challenger, Exert, Draw, Ink Ramp, Ward).

## Commands

```bash
# Root commands
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm dev              # Start web dev server

# Package-specific
pnpm build:engine     # Build synergy-engine package
pnpm test:engine      # Run engine tests (52 tests)
pnpm build:web        # Build web app
pnpm test:web         # Run web tests (290 tests)
```

## Architecture Notes

- SynergyEngine uses pluggable rules pattern - add rules via `SynergyRule` interface
- Synergies memoized - only recompute on card selection or game mode change
- Card data loaded once on init, all operations in-memory
- Cards deduplicated by `fullName` (same card in multiple sets appears once)
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
- **Issues**: When creating issues, always add appropriate labels. When listing issues, check for unlabeled ones proactively.

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

### Code Quality
- After writing or modifying significant code (new features, refactors, bug fixes), run the `code-simplifier` agent to polish for clarity and consistency
- Use `/refactor-code` for periodic comprehensive codebase audits
- When reviewing code or doing a re-review, always re-read the current file contents first — never assume you know what's already been changed. Diff against the actual working tree, not your memory of previous edits.
- When editing theme or config files, re-read the full file after edits to ensure no constants or exports were accidentally removed by the edit tool

### Data Integrity
- **Never override tool output with memory.** When presenting data from tool results (gh issue list, git log, API responses, etc.), use the actual tool output verbatim. Do not "correct" or reformat it based on memory or prior context — memory can be stale or wrong.
- **Never take action on assumptions.** If the user states a fact (e.g., "X doesn't have label Y"), do not assume they want it changed. Ask before modifying.

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

### Worktree & Agent Workflow
- **Default: sequential, one agent at a time.** Use parallel agents only for read-only research/exploration or trivially independent tasks with clear specs.
- **Prefer feature branches over worktrees.** Only use worktrees when you need to pause mid-task and switch context, or run concurrent dev servers.
- **Max 2 active worktrees.** Port assignments: main=5173, worktree-1=5174, worktree-2=5175.
- **Same-session cleanup.** Every worktree created in a session must be cleaned up in that session (or explicitly flagged for next session in MEMORY.md).
- **Never leave orphan branches.** After merging a PR, delete the local branch and worktree immediately.
- **Pre-commit timeout.** Always use `timeout: 600000` for git commit (pre-commit hooks run lint + test + E2E, ~2-3 min).
- **Port conflicts.** Before starting a dev server or running E2E tests, check ports 5173-5175 and kill stale processes.
