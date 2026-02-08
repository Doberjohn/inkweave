# Planning

## Architecture

### Overview

Two-column single-page application (desktop) / tab-based navigation (mobile):
- **CardList** (340px fixed) - Card browser with search/filter
- **SynergyResults** (flex) - Synergy display for selected card

### Directory Structure

```
src/
├── features/
│   ├── cards/           # Card data, loading, filtering
│   │   ├── components/  # CardList, CardTile, CardPreview
│   │   ├── utils/       # Card helpers, type guards
│   │   ├── __tests__/   # Card loader tests
│   │   ├── loader.ts    # Card data loading
│   │   ├── types.ts     # Card types (Ink, CardType, LorcanaCard)
│   │   └── index.ts     # Barrel file
│   └── synergies/       # Synergy detection
│       ├── components/  # SynergyResults, SynergyCard
│       ├── engine/      # SynergyEngine, rules
│       ├── hooks/       # useSynergyFinder
│       ├── types.ts     # Synergy types
│       └── index.ts     # Barrel file
├── shared/
│   ├── components/      # Header, MobileNav, FilterDrawer, etc.
│   ├── constants/       # Design tokens (theme.ts)
│   ├── hooks/           # useResponsive, useMobileView, useTouchPreview
│   └── test-utils/      # Test factories
└── App.tsx              # Root component
```

### Key Design Decisions

**Feature-Based Architecture**
- Code organized by feature domain (cards, synergies)
- Shared code in `shared/` directory
- Barrel files (index.ts) for clean imports

**Synergy Engine**
- Pluggable rules pattern via `SynergyRule` interface
- Each rule defines `matches()` (does this card apply?) and `findSynergies()` (find related cards)
- Rules return strength (weak/moderate/strong) and human-readable explanations
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
| UI Framework | React 18 |
| Language | TypeScript 5 |
| Bundler | Vite 5 |
| Testing | Vitest + @testing-library/react |
| Styling | Inline CSS + design tokens |
| State | React hooks (no external library) |

## Synergy Rules

1. **Singer + Songs** - Singer keyword plays Songs at reduced cost
2. **Evasive + Quest** - Evasive characters trigger quest abilities safely
3. **Shift Targets** - Floodborn cards shift onto same-named characters
4. **Princess Tribal** - Princess classification synergies
5. **Villain Tribal** - Villain classification synergies
6. **Hero Tribal** - Hero classification synergies
7. **Challenger + Buffs** - Challengers benefit from strength boosts
8. **Exert Synergies** - Exert effects + exerted-enemy benefits
9. **Draw Engine** - Draw triggers + "when you draw" effects
10. **Ink Ramp** - Ink acceleration + high-cost cards
11. **Ward + Aggression** - Ward protects aggressive plays

## Future Considerations

- Add more synergy rules (Bodyguard, location synergies, damage-based)
- Card image caching/optimization
- Deck sharing via URL
- Match simulation/goldfish testing
- Filter by synergy type in results
- Batch synergy analysis (multiple selected cards)
