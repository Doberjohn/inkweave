# inkweave-ui

Inkweave's design tokens, UI primitives and Lorcana display components, for the app (`apps/web`) and admin (`Doberjohn/inkweave-admin`) to share. They move in from the app phase by phase (milestone "Shared component library").

## Rules

- **Source, not a build.** The package ships `.ts` and `.tsx` files and has no build step. Each consumer compiles it with its own Vite and React Compiler. `apps/web/build-guards.ts` fails the app's build when React Compiler compiled none of its components.
- **Subpath exports only.** Import `inkweave-ui/components/CtaButton`, never `inkweave-ui` or a path into `packages/ui`: `apps/web/eslint.config.js` blocks both.
- **No app ties.** Package source never imports the app, a router, Supabase, Vercel, PostHog or Sentry (`eslint.config.js`). It takes data, links and callbacks as props.
- **React is a peer.** The consumer's React is the one that renders.

## Gates

The package lints with the app's config, so every design-token rule (#508) and the useMemo/useCallback ban hold here too, plus admin's React Compiler bailout rules. `check:design` and `check:stories` (`apps/web/scripts/`) scan `packages/ui/src`, and the app's one Storybook loads its stories. CI type-checks and tests it, knip reads it, pre-push type-checks it, and master uploads its coverage to CodeScene with the app's.

```bash
pnpm --filter inkweave-ui test:run
pnpm --filter inkweave-ui typecheck
pnpm --filter inkweave-ui lint
```
