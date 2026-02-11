# Inkweave

[![CI](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/Doberjohn/lorcana-synergy-finder/actions/workflows/ci.yml)

A React web application for discovering synergistic card combinations in Disney Lorcana TCG. Select a card to find cards that synergize with it through archetype detection and pattern-based rules.

## Features

- **Card Browser**: Search and filter cards by name, ink color, type, keyword, classification, or set
- **Synergy Detection**: Multiple synergy rules detect connections like Singer+Songs, Shift targets, tribal synergies
- **Archetype Synergies**: Detects archetype patterns (Discard, Bounce, Ramp, Damage/Removal)
- **Core Format**: Focused on Core format cards (sets 5+)
- **Deep Linking**: URL-based navigation — share links to specific cards (`/card/123`) or filtered views (`/browse?q=Elsa&ink=Sapphire`)
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

1. **Home** (`/`): Search from the hero or click a featured card
2. **Browse** (`/browse`): Search, filter by ink/type/cost/keyword, and browse all cards
3. **Card Detail** (`/card/:id`): View a card and its synergies — share the URL to link directly

## Tech Stack

- pnpm workspaces monorepo
- React 18 + TypeScript 5
- React Router v7 (URL-based navigation)
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
            ├── pages/        # Route pages (Home, Browse, Card, NotFound)
            ├── router.tsx    # React Router config
            ├── features/
            │   ├── cards/    # Card browsing, filtering, preview
            │   └── synergies/# Synergy display components
            └── shared/
                ├── components/# UI components (HeroSection, FilterModal, etc.)
                ├── contexts/  # CardDataContext (shared card state)
                ├── hooks/     # useResponsive, useFilterParams (URL sync)
                └── constants/ # Design tokens, layout values
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
