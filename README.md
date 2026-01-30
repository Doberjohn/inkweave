# Lorcana Synergy Finder

A React web application for discovering synergistic card combinations in Disney Lorcana TCG. Select a card to find cards that synergize with it, and build decks with automatic synergy analysis.

## Features

- **Card Browser**: Search and filter cards by name, ink color, type, keyword, classification, or set
- **Synergy Detection**: 10 synergy rules detect connections like Singer+Songs, Shift targets, tribal synergies, and more
- **Deck Builder**: Build decks with quantity controls, save/load multiple decks, import/export as JSON
- **Deck Analysis**: View synergy scores, identify key cards and weak links, get card suggestions
- **Game Modes**: Toggle between Core (sets 5+) and Infinity (all sets)

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

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Run ESLint |

## Card Data

Card data is sourced from LorcanaJSON format and stored in `public/data/allCards.json`. Cards are deduplicated by `fullName` so the same card appearing in multiple sets only shows once.

## License

MIT
