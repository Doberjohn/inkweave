# Planning

## Architecture

### Overview

Three-column single-page application:
- **CardList** (340px fixed) - Card browser with search/filter
- **SynergyResults** (flex) - Synergy display for selected card
- **DeckPanel** (380px fixed) - Deck builder and analysis

### Directory Structure

```
src/
├── components/     # React components
├── constants/      # Design tokens (theme.ts)
├── data/           # Card loading from LorcanaJSON
├── engine/         # Synergy detection (rules + engine)
├── hooks/          # React hooks (useSynergyFinder, useDeckBuilder)
├── types/          # TypeScript interfaces
├── utils/          # Card helper functions
└── App.tsx         # Root component
```

### Key Design Decisions

**Synergy Engine**
- Pluggable rules pattern via `SynergyRule` interface
- Each rule defines `matches()` (does this card apply?) and `findSynergies()` (find related cards)
- Rules return strength (weak/moderate/strong) and human-readable explanations
- Results grouped by synergy type for display

**State Management**
- `useSynergyFinder` hook manages card data, filters, selection, and synergy calculation
- `useDeckBuilder` hook manages deck state with `useRef` to avoid stale closures
- Synergies memoized and only recompute on card selection or game mode change

**Data Loading**
- Cards loaded once on init from static JSON
- All operations in-memory after initial load
- Cards deduplicated by `fullName`

**Persistence**
- Decks saved to localStorage
- Current working deck auto-persisted
- JSON import/export for sharing

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18 |
| Language | TypeScript 5 |
| Bundler | Vite 5 |
| Testing | Vitest |
| Styling | Inline CSS + design tokens |
| State | React hooks (no external library) |
| Storage | localStorage |

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
- Mobile-responsive layout
- Filter by synergy type in results
- Batch synergy analysis (multiple selected cards)
