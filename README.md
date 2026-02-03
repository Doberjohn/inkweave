# Inkweave

[![CI](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-98.07%25-brightgreen)

A React web application for discovering synergistic card combinations in Disney Lorcana TCG. Select a card to find cards that synergize with it, and build decks with automatic synergy analysis.

## Features

- **Card Browser**: Search and filter cards by name, ink color, type, keyword, classification, or set
- **Synergy Detection**: 12 synergy rules detect connections like Singer+Songs, Shift targets, tribal synergies, and more
- **Deck Builder**: Build decks with quantity controls, save/load multiple decks, import/export as JSON
- **Deck Analysis**: View synergy scores, identify key cards and weak links, get card suggestions
- **Game Modes**: Toggle between Core (sets 5+) and Infinity (all sets)
- **Responsive Design**: Full mobile support with touch-friendly interface and card preview on long-press

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. **Browse Cards**: Use the left panel to search and filter the card database
2. **Find Synergies**: Click a card to see all cards that synergize with it in the center panel
3. **Build Decks**: Click the + button on any card to add it to your deck in the right panel
4. **Analyze Deck**: View deck statistics, synergy analysis, and get suggestions for cards to add

## Tech Stack

- React 18 + TypeScript 5
- Vite bundler
- Vitest for testing
- Inline CSS with design tokens

## Project Structure

```
src/
├── features/           # Feature-based modules
│   ├── cards/          # Card browsing, filtering, preview
│   │   ├── components/ # CardList, CardTile, CardPreviewPopover
│   │   ├── utils/      # Card helper functions, type guards
│   │   ├── loader.ts   # Card data loading and filtering
│   │   └── types.ts    # Card-related types
│   ├── deck/           # Deck building functionality
│   │   ├── components/ # DeckPanel, DeckStats, DeckSuggestions
│   │   ├── hooks/      # useDeckBuilder hook
│   │   └── types.ts    # Deck-related types
│   └── synergies/      # Synergy detection engine
│       ├── components/ # SynergyResults, SynergyCard
│       ├── engine/     # SynergyEngine, rules
│       ├── hooks/      # useSynergyFinder hook
│       └── types.ts    # Synergy-related types
├── shared/             # Shared utilities and components
│   ├── components/     # Header, ErrorBoundary, FilterDrawer
│   ├── constants/      # Design tokens (theme.ts)
│   ├── hooks/          # useResponsive, useMobileView
│   └── test-utils/     # Test factories and setup
├── App.tsx             # Root component
└── main.tsx            # Entry point
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |

## Testing

| Metric | Coverage |
|--------|----------|
| Statements | 96.46% |
| Branches | 93.17% |
| Functions | 97.01% |
| Lines | 98.07% |

Run tests with coverage:
```bash
pnpm --filter web vitest run --coverage
```

Update README badge after running coverage:
```bash
node apps/web/scripts/update-coverage-badge.js
```

## Card Data

Card data is sourced from LorcanaJSON format and stored in `public/data/allCards.json`. Cards are deduplicated by `fullName` so the same card appearing in multiple sets only shows once.

## License

MIT
