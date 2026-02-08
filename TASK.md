# Task Log

## Completed Features

### Initial Implementation
- Project setup with Vite + React + TypeScript
- Card data loading from LorcanaJSON format
- Three-column layout (CardList, SynergyResults, DeckPanel)
- Card filtering by ink, type, keyword, classification, set
- Search by card name
- Game mode toggle (Core vs Infinity)

### Synergy Engine
- Pluggable rule system with `SynergyRule` interface
- 10 synergy detection rules implemented
- Synergy strength classification (weak/moderate/strong)
- Human-readable explanations for each synergy
- Results grouped by synergy type

### Deck Builder
- Add/remove cards with quantity controls (1-4 copies)
- Deck statistics (cost curve, ink distribution, type breakdown)
- Save/load multiple decks to localStorage
- New deck, rename, clear functionality
- JSON import/export

### Deck Analysis
- Synergy score calculation
- Key cards identification (high synergy connections)
- Weak links detection (cards with 0-1 synergies)
- Card suggestions based on deck contents

### UI/UX
- Card preview popover on hover
- Error boundary for graceful error handling
- Loading states
- Design token system for consistent styling

### Mobile Responsive
- Responsive layout with breakpoint at 768px
- Bottom tab navigation for mobile (Cards, Synergies, Deck)
- Touch support with long-press (400ms) for card preview
- FilterDrawer bottom sheet for mobile filters
- Larger touch targets (44px) on mobile
- Safe area inset support for iOS devices

## Current Status

Application is functional with all core features implemented including mobile responsive support. Build passes, ESLint passing (1 pre-existing warning about Fast Refresh).

---

## Open Code Review Items

### 🟠 High Priority

(None currently)

### 🟡 Medium Priority

(None currently)

### 🟢 Low Priority

(None currently)

---

## Recently Resolved (Code Review Round 2)

### 🟠 High Priority

- [x] **[PERFORMANCE]** `getDeckSuggestions` O(n*m) complexity. **FIXED**: Implemented `SynergyCache` module (`src/features/synergies/engine/SynergyCache.ts`) that caches synergy results keyed by card pair IDs. Both functions now use cached lookups.

- [x] **[PERFORMANCE]** `getDeckSynergyAnalysis` O(n²) complexity with 3,600+ calls per deck change. **FIXED**: Now uses shared `synergyCache.checkBidirectionalSynergy()` which caches results. Subsequent deck modifications hit the cache for already-computed pairs.

### 🟡 Medium Priority

- [x] **[BUG]** `DeckPanel.tsx:105-115` - FileReader has no error handler. **FIXED**: Added `reader.onerror` handler with user alert.

- [x] **[PERFORMANCE]** `SynergyCard.tsx` - Component not wrapped in `React.memo()`. **FIXED**: Wrapped component in `memo()` to prevent unnecessary re-renders.

- [x] **[PERFORMANCE]** `SynergyGroup.tsx:50-58` - Card list causes re-renders on toggle. **FIXED**: Extracted card list to memoized `SynergyCardList` subcomponent.

- [x] **[UX]** `useSynergyFinder.ts` - No error recovery for failed card load. **FIXED**: Added `retryLoad` callback and "Try Again" button in App.tsx error UI.

### 🟢 Low Priority

- [x] **[BUG]** `DeckStats.tsx:14` - `Math.max(...[])` returns `-Infinity`. **FIXED**: Check array length before spread.

- [x] **[CODE-QUALITY]** `CardPreviewContext.tsx` - Fast Refresh warning from mixed exports. **FIXED**: Extracted `useCardPreview` hook to separate `useCardPreview.ts` file.

- [x] **[ROBUSTNESS]** `useDeckBuilder.ts` - localStorage QuotaExceededError not handled. **FIXED**: Added error handling with user feedback when storage is full.

---

## Resolved Code Review Items

### 🔴 Critical Priority

- [x] **[BUG]** Wrong import path in `src/hooks/useSynergyFinder.ts:3` - imports from `"../sharedEngine/shared"` but file is at `"../engine/shared"`. **FIXED**: Corrected import path.

### 🟠 High Priority

- [x] **[BUG]** `addCard` in `src/hooks/useDeckBuilder.ts:185-216` returns `added` before `setDeck` callback executes (React state updates are async), so return value may be stale. **FIXED**: Now checks constraints via `deckRef.current` before state update.

- [x] **[REFACTOR]** Duplicate SynergyEngine instances: singleton in `src/hooks/useSynergyFinder.ts:15` and another in `src/hooks/useDeckBuilder.ts:10`. **FIXED**: Created `src/engine/shared.ts` with single shared instance.

- [x] **[PERFORMANCE]** `CardPreviewPopover.tsx:136-137` - Window dimensions read on every render. **FIXED**: Now uses cached viewport dimensions from `useResponsive` hook with memoization.

- [x] **[PERFORMANCE]** `useResponsive.ts:31` - isTouchDevice recalculated on resize. **FIXED**: Touch detection now computed once on mount and stored separately from resize-dependent state.

### 🟡 Medium Priority

- [x] **[VALIDATION]** `importDeck` in `src/hooks/useDeckBuilder.ts:368-385` has minimal validation. **FIXED**: Now validates card objects, quantities (1-4), and total cards (max 60).

- [x] **[ACCESSIBILITY]** Components use `<button>` but lack proper ARIA attributes. **FIXED**:
  - `CardTile.tsx` - added `aria-pressed` for selected state
  - `FilterButton` in `CardList.tsx` - added `aria-pressed` for active filters
  - `DeckStats.tsx`, `DeckSynergyAnalysis.tsx`, `DeckSuggestions.tsx` - added `aria-expanded` to collapsible sections
  - `TabButton` in `DeckSynergyAnalysis.tsx` - added `aria-pressed`

- [x] **[ACCESSIBILITY]** `Header.tsx:32-63` game mode toggle buttons. **FIXED**: Added `aria-pressed` and `role="group"` with `aria-label`.

- [x] **[ACCESSIBILITY]** `SavedDecksModal.tsx` missing modal semantics. **FIXED**: Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.

- [x] **[ACCESSIBILITY]** `SynergyGroup.tsx:19-46` collapsible section. **FIXED**: Added `aria-expanded` to toggle button.

- [x] **[ACCESSIBILITY]** `DeckCardRow.tsx:131-188` increment/decrement buttons. **FIXED**: Added `aria-label` to decrement, increment, and remove-all buttons with card name context.

- [x] **[UX]** `CardTile.tsx:159-183` uses a `<div>` with onClick for the add-to-deck button. **FIXED**: Changed to proper `<button>` element with `disabled` and `aria-label` attributes.

- [x] **[ERROR-HANDLING]** `fetchCardsFromLocal` in `src/data/loader.ts:171-182` doesn't handle JSON parse errors. **FIXED**: Added try/catch around `response.json()`.

- [x] **[STYLE]** Hardcoded color values appear in several components instead of using theme tokens. **FIXED**:
  - Added `errorBg`, `errorBorder`, `successBg` to `src/constants/theme.ts`
  - Updated `DeckPanel.tsx`, `DeckStats.tsx`, `DeckSynergyAnalysis.tsx`, `SynergyResults.tsx` to use theme tokens

- [x] **[TESTING]** Only `src/engine/rules.test.ts` has tests. **FIXED**: Added tests for:
  - `loader.ts` - 17 tests for search, filtering, and unique extractors
  - `SynergyEngine` class - 10 tests for synergy detection, custom rules, and configuration
  - Total tests: 43 (up from 16)

- [x] **[CONSISTENCY]** Card type was `CardType[]` (array) but cards only have one type. **FIXED**: Simplified to `CardType` and updated all usages in loader.ts, useDeckBuilder.ts, cardHelpers.ts, and CardPreviewPopover.tsx.

- [x] **[DX]** ESLint dependencies missing. **FIXED**: Added eslint, @eslint/js, globals, eslint-plugin-react-hooks, eslint-plugin-react-refresh, typescript-eslint. Updated eslint.config.js to use flat config format. Fixed lint errors (unused imports).

- [x] **[FEATURE]** Mobile-responsive layout. **FIXED**: Implemented full mobile responsive design with:
  - useResponsive hook for viewport detection
  - useTouchPreview hook for long-press card preview
  - useMobileView hook for tab navigation state
  - MobileNav bottom tab component
  - MobileHeader compact header
  - FilterDrawer bottom sheet
  - Touch targets sized at 44px minimum
  - Safe area inset support

- [x] **[BUG]** `DeckPanel.tsx:76-85` - URL.revokeObjectURL timing issue. **FIXED**: Added 1 second delay before revoking URL to ensure download starts.

- [x] **[ERROR-HANDLING]** `App.tsx` - Mobile views not wrapped with error boundaries. **FIXED**: Each mobile view (Cards, Synergies, Deck) now wrapped with ErrorBoundary.

- [x] **[ACCESSIBILITY]** `FilterDrawer.tsx:64-72` - Backdrop keyboard accessibility. **FIXED**: Added `role="button"`, `tabIndex={0}`, and keyboard handlers (Enter/Space/Escape).

- [x] **[ACCESSIBILITY]** `CardPreviewPopover.tsx:113-130` - Dismiss hint not announced. **FIXED**: Added `role="status"` and `aria-live="polite"`.

- [x] **[PERFORMANCE]** `DeckCardRow.tsx` - Inline ternary computations. **FIXED**: Memoized derived values (`buttonSize`, `removeButtonSize`, `fontSize`, etc.) with `useMemo`.

- [x] **[PERFORMANCE]** `CardList.tsx:55` - displayedCards slice memoization. **FIXED**: Wrapped in `useMemo` with `cards` dependency.

- [x] **[VALIDATION]** `DeckPanel.tsx:91-109` - Import handler file extension validation. **FIXED**: Added check for `.json` extension before processing.

### 🟢 Low Priority

- [x] **[DEAD-CODE]** `useCardInteraction` hook in `src/shared/hooks/useCardInteraction.ts` was created but is not used. **FIXED**: Removed unused hook file.

- [x] **[CLEANUP]** `allCards` prop passed to `DeckPanel` in `src/App.tsx:99` is unused. **FIXED**: Removed from both `App.tsx` and `DeckPanel.tsx` interface.

- [x] **[PERFORMANCE]** `getCardQuantity` callback in `useDeckBuilder.ts:274-280` depends on `deck.cards` causing all card tiles to re-render when any deck change occurs. **FIXED**: Now uses memoized `Map` for O(1) lookups.

- [x] **[TYPING]** `src/components/CardList.tsx:49` casts `filters.type` to `CardType | undefined`. **FIXED**: Added `isCardType` type guard function for safer type checking.

- [x] **[DOCS]** Add JSDoc to exported hook return types. **FIXED**: Added JSDoc comments to `UseSynergyFinderReturn` and `UseDeckBuilderReturn` interfaces.

- [x] **[CLEANUP]** `showDebug` state in `SynergyResults.tsx:25` is development-only UI. **FIXED**: Removed debug toggle and related props from `SynergyResults`, `SynergyGroup`, and `SynergyCard`.

- [x] **[STYLE]** `SynergyGroup.tsx:18` uses hardcoded `marginBottom: "20px"`. **FIXED**: Changed to use `SPACING.xl` constant.

- [x] **[DRY]** `isCardType` type guard duplicated in CardList and FilterDrawer. **FIXED**: Created `src/features/cards/utils/typeGuards.ts` with shared implementation.

- [x] **[DRY]** Touch/hover logic duplicated across components. **RESOLVED**: Touch/hover handlers are appropriately co-located in each component since they have different behaviors (CardTile adds to deck, SynergyCard shows synergies, DeckCardRow adjusts quantity). A shared hook was deemed unnecessary.

- [x] **[CONSISTENCY]** `DeckCardRow.tsx:84,95` - Hardcoded image dimensions. **FIXED**: Now uses `LAYOUT.cardTileImageWidth` and `LAYOUT.cardTileImageHeight`.

- [x] **[MAINTAINABILITY]** `CardPreviewPopover.tsx` - Location card rotation duplicated. **FIXED**: Extracted to `LocationCardImage` subcomponent.

- [x] **[MAINTAINABILITY]** `MobileNav.tsx:114-150` - SVG icons inline. **FIXED**: Wrapped with `React.memo()` to prevent re-renders.

- [x] **[CODE-QUALITY]** `DeckPanel.tsx:53-58` - Multiple boolean states for collapsible sections. **FIXED**: Consolidated into single state object with `toggleSection` helper.

- [x] **[FUTURE-PROOFING]** `useResponsive.ts` - Missing SSR check in useEffect. **FIXED**: Added `typeof window === "undefined"` check.

- [x] **[CODE-QUALITY]** `theme.ts:122` - Z_INDEX.modal - 1 for backdrops. **FIXED**: Added explicit `modalBackdrop` and `popoverBackdrop` values.

---

## Known Issues

None currently tracked.

## MVP Roadmap

See [GitHub Issues](https://github.com/Doberjohn/lorcana-synergy-finder/issues) for full backlog.

### Epic 1: MVP Scope Reduction (#28)
- [x] Remove Deck Builder - #33
- [ ] Remove Infinity Mode - #34

### Epic 2: Dark Fantasy UI Theme (#29)
- [ ] Design System Update - #35
- [ ] Header Redesign - #36
- [ ] Card List Polish - #37
- [ ] Filter Redesign - #38

### Epic 3: Archetype Synergies (#30)
- [ ] Archetype Engine Infrastructure - #39
- [ ] Discard Archetype - #40
- [ ] Bounce Archetype - #41
- [ ] Ramp Archetype - #42
- [ ] Damage/Removal Archetype - #43

### Epic 4: Synergy Panel Redesign (#31)
- [ ] SynergyCard Restyle - #44
- [ ] Archetype Grouping - #45
- [ ] Archetype Filtering - #46

### Epic 5: Launch Readiness (#32)
- [ ] MVP Testing - #47
- [ ] MVP Documentation - #48
- [ ] MVP Final Polish - #49

---

## Backlog (Post-MVP)

### Core Features
- [ ] Add more synergy rules (Bodyguard, location) - #1
- [ ] Deck sharing via URL - #2
- [ ] Filter synergy results by type - #3

### Community Synergies Epic (#6)
- [ ] User synergy suggestions (anonymous) - #7
- [ ] User-created synergies + sharing - #8
- [ ] Vote for synergies + score system - #9

### Infrastructure
- [ ] SEO improvements - #12
- [ ] Protect synergy rules in production - #14

### Non-GitHub Tasks
- [ ] Update app icon

---

## Recently Completed

- [x] App branding: Name "Inkweave", domain purchased and configured on Vercel
- [x] Add tests for deck builder components (#5)
- [x] Add E2E testing with Playwright (#11) - #24
- [x] Add Vercel Analytics and Speed Insights (#13) - #19
- [x] Enlarge middle column card on hover (#10) - #21
- [x] Add tests for remaining deck components (#16) - #20
- [x] Rename app to Inkweave (#17) - #18
- [x] Card image lazy loading/caching
