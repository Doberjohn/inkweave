# inkweave-ui

Inkweave's design tokens, UI primitives and Lorcana display components, for the app (`apps/web`) and admin (`Doberjohn/inkweave-admin`) to share. They move in from the app phase by phase (milestone "Shared component library").

## What's here

| Folder | Holds | Import |
|---|---|---|
| `tokens/` | `theme.ts`, the design tokens (colors, type, spacing, radii, easings, shadows and the micro-pattern styles), `lorcana.ts`, the ink colors, ink order and cost buttons, and `cardBar.ts`, a card's black bar as a share of its width | `inkweave-ui/tokens/theme` |
| `components/` | The primitives: buttons (`CtaButton`, `LinkButton`, `IconButton`, `NavArrowButton`), chips and tags, `DialogShell` and `BottomSheet`, `FilterDialog` (the Radix shell, #981), `Tooltip`, `TabList`, `SortSelect`, `QuantityStepper`, the filter controls and the small icons | `inkweave-ui/components/CtaButton` |
| `lorcana/` | The Lorcana display components: `CardImage` and `CardTile` (#980), the printing stack (`PrintingCarousel`, with `PrintingName` and `PrintingPeek`), the collection's `CopiesStripe`, `CardImageButton`, `CardLightbox`, `CardTextBlock`, `CardTranslationPanel` and `CardTranslationToggle`, `AbilityCallout` and `AbilityTag`, `InkCardPlaceholder`, `TierCircle`, `StrengthBadge`, the ink, cost and inkwell icons and filter groups, `FilterContent` (the filter sections, #981), `ConnectionGroup` (a synergy pair's rule rows, #981) and `RaritySymbol` | `inkweave-ui/lorcana/InkIcon` |
| `hooks/` | `useArtLoad` (card art's load over its placeholder, and `ArtOnScreen`), `useAutocomplete` (the card search box, #981), `useCardThrow` and `useTouchHold`, `useBoop`, `useContainerWidth`, `useDialogFocus`, `useFinePointer`, `useHover`, `useResponsive`, `useRovingTabIndex`, `useScrollLock`, `useScrollSnapIndex`, `useTooltip`, `useTransitionPresence` and `useWheelTurn` | `inkweave-ui/hooks/useHover` |
| `utils/` | `focusedByKeyboard`, `prefersReducedMotion` and `touchGuard` | `inkweave-ui/utils/touchGuard` |
| `lib/` | `ctaStyles` and `isOff`, which the buttons share, `rarity` (each rarity's symbol and label), `scoreUtils` (the synergy score tiers), `printings` (a card's printings, their order and names), `prerenderedArt` (the art the prerendered page showed, #915), `filterModel` (the filters' types and `FilterVocabulary`, #981), `chipNames` (a synergy line's {A}/{B} chips in words) and `whenLoadedAndIdle` | `inkweave-ui/lib/rarity` |
| `assets/` | The ink icons, inkwell glyphs and rarity symbols, each shipped as its own file (`?no-inline`) | `inkweave-ui/assets/amber.svg?no-inline` |
| `styles/` | `primitives.css`: the focus rings, overlay transitions, foil sweep, quantity pop and touch target the components draw with. A consumer imports it before its own stylesheet. `lorcana.css`: the ink card placeholder, drawn from `assets/`, and the printing stack's focus ring, imported after `primitives.css` | `inkweave-ui/styles/primitives.css` |
| `docs/` | The design-system docs stories (Colors, Typography, Spacing & Layout, MicroPatterns) | Storybook only |
| `test-utils/` | `createCard`, a card for the package's tests and stories, `TEST_FILTER_VOCABULARY`, a stand-in for the app's filter words, and the art and touch helpers `loadedArt`, `printingSwipe` and `touchMove`, which the app's tests share | `inkweave-ui/test-utils/loadedArt`, tests and stories only |

The app's barrels (`shared/constants`, `shared/components`, `shared/hooks`) forward these names, so app code keeps importing tokens through `shared/constants`; a direct `inkweave-ui/tokens/*` import there fails lint. The app's own constants (set codes and names, sort and card-type options) stay in `apps/web/src/shared/constants/appConstants.ts`.

## Rules

- **Source, not a build.** The package ships `.ts` and `.tsx` files and has no build step. Each consumer compiles it with its own Vite and React Compiler. `apps/web/build-guards.ts` fails the app's build when React Compiler compiled none of its components.
- **Subpath exports only.** Import `inkweave-ui/components/CtaButton`, never `inkweave-ui` or a path into `packages/ui`: `apps/web/eslint.config.js` blocks both.
- **No app ties.** Package source never imports the app, a router, Supabase, Vercel, PostHog or Sentry (`eslint.config.js`). It takes data, links and callbacks as props, and app behaviour through seams: CardTile's `artUrl` names the art's URL and `onIntent` runs as the visitor heads for a link tile, which the app's CardTile fills with its small grid art and its card modal's warm-up (#980). FilterContent's required `vocabulary` brings the app's words and rules (rarity names, set logos, art presets, the Dual-ink rule and the default buttons), useAutocomplete's required `search` finds and orders the suggestions, and ConnectionGroup reads each connection's `roleLabel`, which the app's `groupConnections` writes (#981).
- **One copy of page-wide state.** `lib/prerenderedArt` and `hooks/useArtLoad`'s `ArtOnScreen` hold state for the whole page, so the app imports them from here and keeps no copy: two would each hold half of it.
- **React is a peer.** The consumer's React is the one that renders.

## Gates

The package lints with the app's config, so every design-token rule (#508) and the useMemo/useCallback ban hold here too, plus admin's React Compiler bailout rules. `check:design` and `check:stories` (`apps/web/scripts/`) scan `packages/ui/src`, and the app's one Storybook loads its stories. CI type-checks and tests it, knip reads it, pre-push type-checks it, and master uploads its coverage to CodeScene with the app's.

```bash
pnpm --filter inkweave-ui test:run
pnpm --filter inkweave-ui typecheck
pnpm --filter inkweave-ui lint
```
