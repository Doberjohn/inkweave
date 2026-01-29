# Code Review Tasks - Lorcana Synergy Finder

Last reviewed: 2026-01-29

## 🔴 Critical Priority

- [ ] **[SECURITY]** Add input sanitization for deck import in `src/hooks/useDeckBuilder.ts:368-385`
  - `importDeck()` parses arbitrary JSON without validating card data structure
  - Malformed card objects could cause runtime errors or unexpected behavior
  - Should validate each `DeckCard` has proper `card` object with required fields

- [ ] **[SECURITY]** Sanitize localStorage data on load in `src/hooks/useDeckBuilder.ts:155-166`
  - Current deck loaded from localStorage without schema validation
  - Corrupted/tampered storage could crash the app or cause XSS via card text
  - Should validate structure matches `Deck` interface before use

- [ ] **[BUG]** Fix `addCard` return value race condition in `src/hooks/useDeckBuilder.ts:185-216`
  - `added` variable is set inside `setDeck` callback but returned synchronously
  - Due to React's batched state updates, `added` may not reflect actual result
  - Consider returning a boolean from a separate check or using a ref

## 🟠 High Priority

- [ ] **[PERFORMANCE]** Memoize `getDeckSuggestions` computation in `src/hooks/useDeckBuilder.ts:387-458`
  - Currently iterates all cards × deck cards on every call
  - Should use `useMemo` with proper dependency tracking instead of `useCallback`
  - O(n × m) complexity could be expensive with large card pools

- [ ] **[PERFORMANCE]** Memoize `getDeckSynergyAnalysis` in `src/hooks/useDeckBuilder.ts:460-552`
  - Similar O(n²) analysis recalculated on every call
  - Move calculation to `useMemo` with `[deck.cards]` dependency

- [ ] **[REFACTOR]** Duplicate `SynergyEngine` singleton instances across hooks
  - `useSynergyFinder.ts:15` and `useDeckBuilder.ts:10` each create separate instances
  - Should share a single instance or use context to avoid memory waste

- [ ] **[BUG]** `useMemo` dependency on `deckBuilder` object causes unnecessary recalculation in `src/App.tsx:40-47`
  - `deckBuilder` is a new object reference on each render
  - `deckSuggestions` and `deckSynergyAnalysis` memos will recalculate every render
  - Should depend on `deckBuilder.deck.cards` or extract stable function references

- [ ] **[TESTING]** Missing tests for critical hooks
  - `useDeckBuilder.ts` has no unit tests
  - `useSynergyFinder.ts` has no unit tests
  - Add tests for deck operations, persistence, and edge cases

- [ ] **[ERROR HANDLING]** No error boundary for individual panels
  - A crash in DeckPanel/CardList/SynergyResults takes down entire app
  - Consider wrapping each major panel in its own ErrorBoundary

## 🟡 Medium Priority

- [ ] **[PERFORMANCE]** Card list renders all 200 cards even when most are off-screen
  - `src/components/CardList.tsx:47` slices to 200 but still renders all
  - Consider virtualized list (react-window/react-virtual) for smooth scrolling

- [ ] **[ACCESSIBILITY]** Missing ARIA labels and keyboard navigation
  - Filter buttons lack `aria-pressed` state
  - Card tiles not keyboard navigable (no tabIndex/onKeyDown)
  - No skip-to-content links

- [ ] **[ACCESSIBILITY]** Color-only indicators for ink types
  - `src/components/CardTile.tsx` and filter buttons rely solely on color
  - Add text labels or patterns for colorblind users

- [ ] **[UX]** No loading state for deck operations
  - Save/Load/Import operations have no visual feedback
  - Add loading spinners or disabled states during operations

- [ ] **[UX]** `alert()` used for import failure in `src/components/DeckPanel.tsx:99`
  - Replace with toast notification or inline error message
  - Native alerts block the UI and look unprofessional

- [ ] **[TESTING]** Synergy rules test coverage is incomplete
  - `src/engine/rules.test.ts` only tests 5 of 10 rules
  - Missing tests for: Evasive+Quest, Challenger+Buffs, Draw Engine, Ink Ramp, Ward+Aggro

- [ ] **[TYPE SAFETY]** Type assertion in `src/components/CardList.tsx:49`
  - `filters.type as CardType | undefined` loses type safety
  - Should narrow type properly or adjust interface

- [ ] **[REFACTOR]** Large component files could be split
  - `DeckPanel.tsx` (368 lines) handles too many concerns
  - Extract DeckHeader, DeckActions, DeckCardList as separate components

- [ ] **[CONSISTENCY]** Mix of px values and SPACING constants
  - Some components use raw pixels: `"5px 10px"` in FilterButton
  - Should consistently use SPACING tokens throughout

## 🟢 Low Priority

- [ ] **[CLEANUP]** Remove unused `allCards` prop from `DeckPanel`
  - `src/components/DeckPanel.tsx:14` - prop is passed but never used

- [ ] **[CLEANUP]** Unused exports in engine
  - `synergyEngine` singleton in `src/engine/index.ts:202` is exported but never imported
  - Either remove or document intended use

- [ ] **[TYPES]** `GameMode` type could use const assertion
  - `src/types/index.ts:11` - consider `as const` array for exhaustive checking

- [ ] **[DX]** Missing ESLint configuration
  - `package.json` references eslint but no `.eslintrc` or config in `eslint.config.js`
  - Add proper linting rules for consistent code style

- [ ] **[DX]** No Prettier or formatting configuration
  - Add `.prettierrc` for consistent code formatting
  - Configure format-on-save for team consistency

- [ ] **[DOCS]** Add JSDoc to public API functions
  - `SynergyEngine` class methods lack documentation
  - `useDeckBuilder` return type is documented but not individual functions

- [ ] **[BUILD]** Consider code splitting for large card data
  - 6.6MB JSON loaded on initial page load
  - Could lazy-load or paginate card data

- [ ] **[FEATURE]** No debouncing on search input
  - `src/components/CardList.tsx:99` triggers filter on every keystroke
  - Add 200-300ms debounce for smoother UX

---

## Architecture Observations

### Strengths
1. Clean separation between data (loader), logic (engine), and UI (components)
2. Pluggable synergy rules pattern allows easy extension
3. TypeScript strict mode enforced with proper interfaces
4. Design token system for consistent styling
5. Good use of `useCallback` for event handlers
6. Singleton pattern for `SynergyEngine` avoids recreations

### Areas for Improvement
1. State management could benefit from reducer pattern for deck operations
2. No caching strategy for expensive synergy calculations
3. Missing error handling for network failures (card data fetch)
4. No offline support despite static JSON data
5. Consider React Query or SWR for data fetching patterns

### Security Considerations
1. No XSS risks in current implementation (no dangerouslySetInnerHTML)
2. localStorage data should be validated before use
3. JSON import needs stricter validation
4. Card images loaded from external URLs - consider CSP headers

### Performance Metrics to Monitor
1. Initial load time with 6.6MB card data
2. Synergy calculation time for complex cards
3. Deck analysis with 60 cards (O(n²) pairs)
4. Re-render count when filters change
