# inkweave-ui

Inkweave's design tokens, UI primitives and Lorcana display components, for the app (`apps/web`) and admin (`Doberjohn/inkweave-admin`) to share. They move in from the app phase by phase (milestone "Shared component library").

## What's here

| Folder | Holds | Import |
|---|---|---|
| `tokens/` | `theme.ts`, the design tokens (colors, type, spacing, radii, easings, shadows and the micro-pattern styles), and `lorcana.ts`, the ink colors, ink order and cost buttons | `inkweave-ui/tokens/theme` |
| `components/` | The primitives: buttons (`CtaButton`, `LinkButton`, `IconButton`, `NavArrowButton`), chips and tags, `DialogShell` and `BottomSheet`, `Tooltip`, `TabList`, `SortSelect`, `QuantityStepper`, the filter controls and the small icons | `inkweave-ui/components/CtaButton` |
| `lorcana/` | The Lorcana display components: `CardImageButton`, `CardLightbox`, `CardTextBlock`, `CardTranslationPanel` and `CardTranslationToggle`, `AbilityCallout` and `AbilityTag`, `InkCardPlaceholder`, `TierCircle`, `StrengthBadge`, the ink, cost and inkwell icons and filter groups, and `RaritySymbol` | `inkweave-ui/lorcana/InkIcon` |
| `hooks/` | `useBoop`, `useContainerWidth`, `useDialogFocus`, `useFinePointer`, `useHover`, `useResponsive`, `useRovingTabIndex`, `useScrollLock`, `useScrollSnapIndex`, `useTooltip`, `useTransitionPresence` and `useWheelTurn` | `inkweave-ui/hooks/useHover` |
| `utils/` | `focusedByKeyboard`, `prefersReducedMotion` and `touchGuard` | `inkweave-ui/utils/touchGuard` |
| `lib/` | `ctaStyles` and `isOff`, which the buttons share, `rarity` (each rarity's symbol and label) and `scoreUtils` (the synergy score tiers) | `inkweave-ui/lib/rarity` |
| `assets/` | The ink icons, inkwell glyphs and rarity symbols, each shipped as its own file (`?no-inline`) | `inkweave-ui/assets/amber.svg?no-inline` |
| `styles/` | `primitives.css`: the focus rings, overlay transitions, foil sweep, quantity pop and touch target the components draw with. A consumer imports it before its own stylesheet. `lorcana.css`: the ink card placeholder, drawn from `assets/`, imported after `primitives.css` | `inkweave-ui/styles/primitives.css` |
| `docs/` | The design-system docs stories (Colors, Typography, Spacing & Layout, MicroPatterns) | Storybook only |
| `test-utils/` | `createCard`, a card for the package's tests and stories | Tests and stories only |

The app's barrels (`shared/constants`, `shared/components`, `shared/hooks`) forward these names, so app code keeps importing tokens through `shared/constants`; a direct `inkweave-ui/tokens/*` import there fails lint. The app's own constants (set codes and names, sort and card-type options) stay in `apps/web/src/shared/constants/appConstants.ts`.

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
