# Inkweave

[![CI](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml)

A React web application for discovering synergistic card combinations in Disney Lorcana TCG. Select a card to find cards that synergize with it through archetype detection and pattern-based rules.

## Features

- **Card Browser**: Search and filter cards by name, ink color, type, keyword, classification, or set
- **Synergy Detection**: Multiple synergy rules detect connections like Singer+Songs, Shift targets, tribal synergies
- **Archetype Synergies**: Detects archetype patterns (Discard, Bounce, Ramp, Damage/Removal)
- **Core Format**: Focused on Core format cards (sets 5+)
- **Responsive Design**: Full mobile support with touch-friendly interface and card preview on long-press

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
pnpm build
pnpm preview
```

## Usage

1. **Browse Cards**: Use the left panel to search and filter the card database
2. **Find Synergies**: Click a card to see all cards that synergize with it in the right panel

## Tech Stack

- pnpm workspaces monorepo
- React 18 + TypeScript 5
- Vite bundler
- Vitest + Playwright for testing
- Inline CSS with design tokens

## Project Structure

```
inkweave/
├── packages/
│   └── synergy-engine/       # Standalone synergy detection package
│       └── src/
│           ├── types/        # LorcanaCard, Synergy types
│           ├── utils/        # Card helpers
│           └── engine/       # SynergyEngine class + rules
└── apps/
    └── web/                  # React web application
        └── src/
            ├── features/
            │   ├── cards/    # Card browsing, filtering, preview
            │   └── synergies/# Synergy display components
            └── shared/       # Constants, utilities, shared components
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests (web) |
| `pnpm lint` | Run ESLint |

## Card Data

Card data is sourced from LorcanaJSON format and stored in `public/data/allCards.json`. Cards are deduplicated by `fullName` so the same card appearing in multiple sets only shows once.

## License

MIT
