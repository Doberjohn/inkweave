# Inkweave

[![CI](https://github.com/Doberjohn/inkweave/actions/workflows/ci.yml/badge.svg)](https://github.com/Doberjohn/inkweave/actions/workflows/ci.yml)

A synergy finder for [Disney Lorcana TCG](https://www.disneylorcana.com/) focused on Core format. Select any card to discover what synergizes with it through pattern-based rules and archetype detection.

**Live at [inkweave.ink](https://www.inkweave.ink/)**

## Features

- **Card Browser** — Search and filter by name, ink color, type, ink cost, keyword, classification, or set
- **Synergy Detection** — Rules detect Shift targets, named companions, and more
- **Playstyle Archetypes** — Discovers cards that share strategic patterns: Discard, Location Control, Lore Denial
- **Synergy Scoring** — 1-10 numeric scale with strength tiers (Perfect, Strong, Moderate, Weak)
- **Core Format** — Cards from sets 5+ only
- **Deep Linking** — Shareable URLs for cards (`/card/123`), synergies (`/card/123/synergies`), and filtered views (`/browse?q=Elsa&ink=Sapphire`)
- **PWA** — Installable on mobile, offline card browsing after first visit
- **Responsive** — Full mobile support with bottom navigation, touch-friendly card preview on long-press

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

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

1. **Home** (`/`) — Search from the hero or click a featured card
2. **Browse** (`/browse`) — Search, filter, and browse all Core format cards
3. **Card Detail** (`/card/:id`) — View a card's details and synergy breakdown
4. **Synergies** (`/card/:id/synergies`) — Explore all synergy groups for a card
5. **Playstyles** (`/playstyles`) — Browse archetype strategies and their key cards

## Tech Stack

- pnpm workspaces monorepo
- React 19 + TypeScript 5
- React Router v7
- Vite + Vitest + Playwright
- Radix UI Primitives (headless accessible components)
- Inline CSS with design tokens

## Project Structure

```
inkweave/
├── packages/
│   └── synergy-engine/       # Standalone synergy detection package
│       └── src/
│           ├── types/        # LorcanaCard, Synergy types
│           ├── utils/        # Card helpers
│           └── engine/       # SynergyEngine class, rules, playstyles
└── apps/
    └── web/                  # React web application
        ├── e2e/              # Playwright E2E tests
        └── src/
            ├── pages/        # Route pages (Home, Browse, Card, Playstyles, etc.)
            ├── router.tsx    # React Router config
            ├── features/
            │   ├── cards/    # Card loading, browsing, filtering, preview
            │   └── synergies/# Synergy display, grouping, detail modal
            └── shared/
                ├── components/# Shared UI (Chip, FilterDialog, SearchAutocomplete, etc.)
                ├── contexts/  # CardDataContext, CardPreviewContext
                ├── hooks/     # useResponsive, useFilterParams, useScrollLock
                └── constants/ # Design tokens, layout values
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm lint` | Run ESLint |
| `pnpm build:engine` | Build synergy engine package |
| `pnpm precompute-synergies` | Regenerate static synergy JSON |

## Synergy Engine

The synergy engine is a standalone package (`inkweave-synergy-engine`) with zero React dependencies. It runs at build time to pre-compute synergy data, which the web app fetches as static JSON.

### Rules

| Rule | Type | What it detects |
|------|------|-----------------|
| **Shift Targets** | Direct | Shift cards paired with same-named base characters |
| **Named Companions** | Direct | Cards referencing specific named entities |
| **Discard** | Playstyle | Opponent discard enablers + hand-size payoffs |
| **Location Control** | Playstyle | 8 sub-roles: at-payoff, play-trigger, buff, ramp, move, in-play-check, tutor, boost |
| **Lore Denial** | Playstyle | Lore steal, lore reduction, and lore prevention |

## Card Data

Card data is sourced from [LorcanaJSON](https://lorcanajson.org/) and stored in `public/data/allCards.json`. Cards are deduplicated by `fullName` so the same card across sets appears once. Card images are single 337x470 AVIF files.

## License

MIT
