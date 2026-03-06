# Planning

## Architecture

### Overview

pnpm workspaces monorepo with two packages:
- **inkweave-synergy-engine** (`packages/synergy-engine/`) — Standalone synergy detection package. Zero React dependencies.
- **inkweave-web** (`apps/web/`) — React web application that consumes the synergy engine.

Desktop: two-column SPA (CardList + SynergyResults). Mobile: tab-based navigation with bottom nav.

### Directory Structure

```
inkweave/
├── packages/
│   └── synergy-engine/       # Standalone synergy detection package
│       └── src/
│           ├── index.ts      # Public API exports
│           ├── types/        # LorcanaCard, Synergy types
│           ├── utils/        # Card helpers (textContains, hasKeyword, etc.)
│           └── engine/       # SynergyEngine class, rules, cache
└── apps/
    └── web/                  # React web application
        └── src/
            ├── App.tsx       # Root component (two-column layout)
            ├── features/
            │   ├── cards/    # Card loading, components, hooks
            │   └── synergies/# Synergy display components, hooks
            └── shared/
                ├── components/ # Hero, SearchBar, FilterDrawer, etc.
                ├── constants/  # Design tokens (theme.ts)
                ├── contexts/   # CardPreviewContext
                ├── hooks/      # useResponsive, useMobileView, useTouchPreview
                └── test-utils/ # Test factories
```

### Key Design Decisions

**Feature-Based Architecture**
- Code organized by feature domain (cards, synergies)
- Shared code in `shared/` directory
- Barrel files (index.ts) for clean imports

**Synergy Engine**
- Pluggable rules pattern via `SynergyRule` interface
- Each rule defines `matches()` (does this card apply?) and `findSynergies()` (find related cards)
- Rules return strength and human-readable explanations
- Results grouped by synergy type for display

**State Management**
- `useSynergyFinder` hook manages card data, filters, selection, and synergy calculation
- Synergies memoized and only recompute on card selection or game mode change

**Data Loading**
- Cards loaded once on init from static JSON
- All operations in-memory after initial load
- Cards deduplicated by `fullName`

**Responsive Design**
- Desktop: Two-column layout
- Mobile: Tab-based navigation with bottom nav
- Touch-optimized interactions (long-press preview)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces |
| UI Framework | React 18 |
| Language | TypeScript 5 |
| Bundler | Vite 5 |
| Testing | Vitest + @testing-library/react + Playwright (E2E) |
| Styling | Inline CSS + design tokens |
| State | React hooks (no external library) |
| Hosting | Vercel |
| Error Tracking | Sentry (EU/DE region) |
| Analytics | Vercel Analytics + Ahrefs |

## Synergy Rules (Current)

8 rules across 2 categories:

| Rule ID | Category | Playstyle | Description |
|---------|----------|-----------|-------------|
| `shift-targets` | `direct` | — | Shift cards + same-named base characters. Strength based on curve gap + inkwell. |
| `lore-loss` | `playstyle` | `lore-denial` | Cards that make the opponent lose lore pair together. |
| `location-at-payoff` | `playstyle` | `location-control` | "At location" payoff effects + Location cards. |
| `location-play-trigger` | `playstyle` | `location-control` | "When you play at location" triggers + Location cards. |
| `location-buff` | `playstyle` | `location-control` | Cards that buff characters at locations + Location cards. |
| `location-move` | `playstyle` | `location-control` | Move-to-location effects + Location cards. |
| `location-in-play-check` | `playstyle` | `location-control` | "If you have a location" checks + Location cards. |
| `location-tutor` | `playstyle` | `location-control` | Location search/tutor effects + Location cards. |

Location support cards also have cross-synergies with each other (complementary roles get stronger ratings).

See `packages/synergy-engine/REMOVED_RULES.md` for archived rules.

## Synergy Categories (#39)

Two higher-level categories that describe *how* synergies create value:

**Direct Synergies** — Two specific cards interact in a powerful way. The value comes from the *pair*. Remove either card and the synergy disappears.
- Example: Shift — a 4-cost Shift card landing on a 3-cost base. Strength depends on their specific cost relationship.

**Playstyle Synergies** — Cards reinforce a shared way of playing. The value comes from *density* — the more cards supporting the playstyle, the more consistent the deck.
- Example: Lore Loss — stacking lore-denial cards creates a coherent strategy.
- Example: Location Strategy — cards that care about locations all push toward the same game plan.

A single card can appear in multiple categories (e.g., a card with Shift + lore-loss text matches both a direct rule and a playstyle rule with separate scores and explanations).

## UI Redesign Plan (Epic #29)

Dark fantasy theme with Scryfall-inspired card grids and Dreamborn-style two-column layout.

### Phase 1: Design System Foundation (#35) — DONE (PR #69)
- Dark color palette: background `#0d0d14`, surface `#1a1a2e`, gold `#d4af37`
- Gray scale inversion for automatic dark adaptation
- All `COLORS.white` background usages split to `surface`/`background` tokens

### Phase 2: Card Grid Transformation (#36) — Next
- Add `thumbnailUrl` to LorcanaCard (extract from raw `images.thumbnail`)
- Rewrite CardTile to vertical image tile (thumbnail + name overlay)
- CardList from flex-column → CSS Grid (`repeat(auto-fill, minmax(110px, 1fr))`)
- Widen sidebar 340px → 480px
- Fix E2E selectors that depend on current layout

### Phase 3: Synergy Panel Redesign (#37)
- SynergyCard → image tile with overlaid strength badges
- SynergyGroup → CSS Grid layout

### Phase 4: Header, Filters, and Polish (#38)
- Gold header wordmark, glowing filter buttons
- Polish remaining components

## Future Considerations

### Deck Builder + Deck Synergy Score
The app will eventually include a deck builder where users select cards and build decks. The core value proposition: every deck comes with a **synergy score** — a numeric total representing how well the cards work together.

Key concepts:
- Individual synergy scores between card pairs aggregate into a deck-level score
- Aggregation differs by category:
  - **Direct synergies**: pair quality × pair count (how many specific combos exist)
  - **Playstyle synergies**: playstyle coherence × card density (probably with diminishing returns — the 8th lore-loss card adds less than the 4th)
- The deck scoring algorithm becomes an **embeddable widget** (#58) — other deck-building sites can input deck cards and get a synergy score calculated by our engine

Dependency chain: `#39 (categories)` → `#132 (numeric scoring)` → `#9 (community voting)` → deck builder → widget

### Numeric Scoring (#132)
Migrate from `weak | moderate | strong` string enum to a 1-10 numeric scale. Prerequisite for community voting (#9) where users adjust scores up/down from the engine's baseline.

### Community Features
- User-created synergies + sharing (#8)
- Vote for synergies + score system (#9)

### Other
- Card image caching/optimization (#126)
- PWA support (#122)
- Deck sharing via URL
- Batch synergy analysis (multiple selected cards)
