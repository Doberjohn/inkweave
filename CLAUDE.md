# Lorcana Synergy Finder

React web application for finding synergistic card combinations in Disney Lorcana TCG.

## Tech Stack

- React 18 + TypeScript 5
- Vite bundler
- Inline CSS with design tokens (no UI framework)
- Static JSON card database

## Project Structure

```
src/
├── components/
│   ├── CardPreviewContext.tsx  # Hover preview state management
│   ├── CardPreviewPopover.tsx  # Floating card image on hover
│   ├── CardTile.tsx            # Card in list (has +add to deck button)
│   ├── SynergyCard.tsx         # Synergy result (has +add to deck button)
│   ├── Header.tsx              # App header with game mode toggle
│   ├── DeckPanel.tsx           # Main deck builder panel (right column)
│   ├── DeckCardRow.tsx         # Card row in deck with quantity controls
│   ├── DeckStats.tsx           # Cost curve, ink distribution, type breakdown
│   ├── DeckSynergyAnalysis.tsx # Deck synergy score, key cards, weak links
│   ├── DeckSuggestions.tsx     # Cards that synergize with deck
│   ├── SavedDecksModal.tsx     # Load/delete saved decks modal
│   └── ...                     # Other UI components
├── constants/      # Design tokens (theme.ts)
├── data/           # Card loading from LorcanaJSON format
├── engine/         # Synergy detection
│   ├── index.ts    # SynergyEngine class
│   └── rules.ts    # 12 synergy detection rules
├── hooks/
│   ├── useSynergyFinder.ts  # Card data, filtering, synergy calculation
│   └── useDeckBuilder.ts    # Deck state, persistence, synergy analysis
├── types/          # TypeScript interfaces
├── utils/          # Card helper functions
└── App.tsx         # Root component (three-column layout)

public/data/allCards.json  # Card database (LorcanaJSON format)
```

## Key Concepts

**Ink Colors**: Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
- Dual-ink cards (e.g., "Amethyst-Sapphire") use primary ink for filtering

**Card Types**: Character, Action, Item, Location

**Game Modes**:
- **Core** (default) - Sets 5+ only (excludes sets 1-4)
- **Infinity** - All sets included

**Synergy Types**: keyword, classification, shift, named, mechanic, ink, cost-curve

**Synergy Strength**: weak, moderate, strong

## Synergy Rules (src/engine/rules.ts)

1. Singer + Songs - Singer keyword plays Songs at reduced cost
2. Evasive + Quest - Evasive characters trigger quest abilities safely
3. Shift Targets - Floodborn cards shift onto same-named characters
4. Princess/Villain/Hero Tribal - Classification-based synergies
5. Challenger + Buffs - Challengers benefit from strength boosts
6. Exert Synergies - Exert effects + exerted-enemy benefits
7. Draw Engine - Draw triggers + "when you draw" effects
8. Ink Ramp - Ink acceleration + high-cost cards
9. Bodyguard Protection - Bodyguards protecting key characters
10. Ward + Aggression - Ward protects against removal

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Architecture Notes

- SynergyEngine uses pluggable rules pattern - add rules via `SynergyRule` interface
- Synergies memoized - only recompute on card selection or game mode change
- Card data loaded once on init, all operations in-memory
- Cards deduplicated by `fullName` (same card in multiple sets appears once)
- Three-column UI: CardList (340px) | SynergyResults (flex) | DeckPanel (380px)
- Floating card preview popover on hover (CardPreviewContext + CardPreviewPopover)
- Game mode toggle in header filters both card list and synergy results

## Deck Builder

### Key Types (src/types/index.ts)
- `DeckCard` - Card + quantity (1-4)
- `Deck` - id, name, cards[], createdAt, updatedAt
- `DeckStats` - totalCards, inkDistribution, costCurve, typeDistribution, validation

### useDeckBuilder Hook (src/hooks/useDeckBuilder.ts)
Main state management for deck building:
- `deck` / `deckStats` - Current deck and computed statistics
- `addCard(card)` - Add card (max 4 copies, max 60 total)
- `removeCard(cardId)` - Remove one copy
- `removeAllCopies(cardId)` - Remove all copies
- `setQuantity(cardId, qty)` - Set exact quantity
- `newDeck()` / `clearDeck()` / `renameDeck(name)`
- `saveDeck()` / `loadDeck(id)` / `deleteSavedDeck(id)` / `getSavedDecks()`
- `exportDeck()` / `importDeck(json)` - JSON import/export
- `getDeckSuggestions(allCards)` - Cards synergizing with 2+ deck cards
- `getDeckSynergyAnalysis()` - Full deck synergy analysis

**Important**: Uses `useRef` for `deckRef` to avoid stale closures in `saveDeck`/`exportDeck`.

### Synergy Analysis (DeckSynergyAnalysis type)
- `cardSynergies[]` - Each card's synergy count and connections
- `keyCards[]` - Top synergy hubs (above-average connections)
- `weakLinks[]` - Cards with 0-1 synergies (cut candidates)
- `overallScore` / `averageScore` / `connectionCount`

### localStorage Keys
- `lorcana-synergy-finder-decks` - Array of saved Deck objects
- `lorcana-synergy-finder-current-deck` - Current working deck (auto-persisted)

### Validation Rules
- Maximum 60 cards per deck
- Maximum 4 copies of any card
- Warning (not error) for 3+ ink colors
