# Tech Stack

## Why Each Tool Was Chosen

### Package Management

| Tool     | Why                                                                                                                                                                 |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **pnpm** | Saves disk space (shared store), faster installs than npm, strict `node_modules` prevents phantom dependencies, native monorepo support with `workspace:*` protocol |

### Build & Bundling

| Tool     | Why                                                                                                                                     |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| **Vite** | 10-100x faster dev server than Webpack (native ES modules, no bundling in dev), instant HMR, simple config, built-in TypeScript support |
| **tsup** | Zero-config TypeScript library bundler, uses esbuild (extremely fast), outputs ESM + types in one command, perfect for npm packages     |

### Language & Framework

| Tool           | Why                                                                                                             |
|----------------|-----------------------------------------------------------------------------------------------------------------|
| **TypeScript** | Catches bugs at compile time, better IDE autocomplete, self-documenting code with types, refactoring confidence |
| **React 18**   | Industry standard, huge ecosystem, hooks simplify state management, concurrent features for better UX           |

### Testing

| Tool                | Why                                                                                                                     |
|---------------------|-------------------------------------------------------------------------------------------------------------------------|
| **Vitest**          | Native Vite integration (shared config), Jest-compatible API (easy migration), 2-3x faster than Jest, built-in coverage |
| **Testing Library** | Tests behavior not implementation, encourages accessible markup, queries match how users find elements                  |
| **jsdom**           | Lightweight browser simulation, faster than real browser tests, sufficient for component testing                        |

### Linting

| Tool                   | Why                                                                                |
|------------------------|------------------------------------------------------------------------------------|
| **ESLint 9**           | Catches bugs, enforces consistency, flat config is simpler than legacy `.eslintrc` |
| **typescript-eslint**  | Type-aware linting rules (e.g., no floating promises), catches TS-specific issues  |
| **react-hooks plugin** | Enforces hooks rules (dependency arrays, call order) - prevents subtle bugs        |

### Monorepo Structure

| Choice                | Why                                                                                           |
|-----------------------|-----------------------------------------------------------------------------------------------|
| **Separate packages** | Engine has zero React dependencies → reusable in CLI, mobile, server                          |
| **Workspace linking** | `workspace:*` means changes to engine are immediately available in web app without publishing |

## What We Don't Use (and why)

| Avoided                   | Why                                                                          |
|---------------------------|------------------------------------------------------------------------------|
| **Webpack**               | Slower, more complex config, Vite does everything simpler                    |
| **Jest**                  | Slower, requires separate config from bundler, Vitest is drop-in replacement |
| **CSS frameworks**        | Inline styles with design tokens keeps bundle small, no unused CSS           |
| **State management libs** | React hooks + context sufficient for this app size                           |
| **npm/yarn**              | pnpm is faster and more disk-efficient                                       |

## Tools Overview

### Versions

| Tool       | Version |
|------------|---------|
| pnpm       | 9.0.0   |
| TypeScript | 5.3+    |
| React      | 18.2+   |
| Vite       | 5.0+    |
| Vitest     | 4.0+    |
| ESLint     | 9.39+   |
| tsup       | 8.0+    |

### Key Commands

```bash
pnpm dev              # Start web dev server
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm test:web         # Run web app tests only
pnpm test:engine      # Run engine tests only
pnpm lint             # Lint all packages
```

### Project Structure

```
inkweave/
├── apps/
│   └── web/                   # React web app (Vite)
│       ├── src/
│       │   ├── features/      # Feature modules (cards, deck, synergies)
│       │   └── shared/        # Shared components, hooks, constants
│       └── vite.config.ts
├── packages/
│   └── synergy-engine/        # Standalone TS package (tsup)
│       └── src/
│           ├── engine/        # SynergyEngine, rules
│           ├── types/         # Card, Synergy types
│           └── utils/         # Card helpers
├── pnpm-workspace.yaml        # Workspace config
├── vercel.json                # Deployment config
└── package.json               # Root scripts
```
