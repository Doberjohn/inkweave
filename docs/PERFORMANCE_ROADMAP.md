# Performance Roadmap

Remaining work from the March 2026 performance audit. Items are grouped by priority and effort.

## Current Baseline (PR #153)

| URL | Perf Score | LCP | Notes |
|-----|-----------|-----|-------|
| `/` | 85 | ~4s local | Hero + featured cards |
| `/browse` | **59** | ~7.5s local | 204 card images — worst page |
| `/card/957` | 78 | ~4.4s local | Card detail + synergy grid |
| `/card/957/synergies` | 86 | ~3.9s local | Synergy results |
| `/playstyles` | 74 | ~7.3s local | Cover images |
| `/playstyles/lore-denial` | 82 | ~4.7s local | Playstyle detail |

Bundle: 233 KB JS gzip (budget: 280 KB) · 262 KB card data gzip (budget: 300 KB)

## Completed

- [x] **#154** — Lighthouse CI thresholds + Core Web Vitals assertions
- [x] **#123** — Bundle analyzer (`pnpm analyze`)
- [x] `sideEffects: false` on both packages
- [x] Storybook separated from production build
- [x] All pages lazy-loaded with `lazyWithRetry()`
- [x] Sentry lazy-loaded (~150 KB off critical path)
- [x] `framer-motion` removed
- [x] Card data reduced 4.7 MB → 2.0 MB (67%)
- [x] Font loading optimized (preconnect, `display=swap`, dropped Cinzel)
- [x] Search debounced (150ms), resize debounced, preview throttled (RAF)
- [x] Components memoized (`memo()`, `useMemo`, `useCallback` on hot paths)
- [x] Bundle budgets enforced in CI (`size-limit`)

---

## Priority 1 — High Impact, Medium Effort

### Use thumbnail images in card grids
**Issue**: #126 · **Labels**: performance, feature

Card tiles render at 120–160px width but load full-resolution images. The raw card data has `images.thumbnail` but the loader only extracts `images.full`.

**Work**:
1. Update `packages/synergy-engine/src/types/` to include `thumbnailUrl` on `LorcanaCard`
2. Update `apps/web/src/features/cards/loader.ts` to extract `images.thumbnail`
3. Use `thumbnailUrl` in `CardTile`, `SynergyCard`, `FeaturedCards`
4. Keep `fullUrl` for `CardPage` detail view and `CardLightbox`

**Impact**: Major LCP improvement on `/browse` and `/playstyles` — the two worst-scoring pages.

### Add Vitest benchmarks for synergy engine
**Issue**: #25 (partial) · **Labels**: performance, testing

No performance regression tests exist. If `findSynergies()` gets slower, nothing catches it until users notice.

**Work**:
1. Add `packages/synergy-engine/src/__tests__/engine.bench.ts`
2. Benchmark `findSynergies()` with 500, 1000, 2000 cards
3. Benchmark `checkSynergy()` for each rule type
4. Add `pnpm bench:engine` script
5. Optionally add to CI as a non-blocking step

**Impact**: Prevents silent engine regressions. Vitest `bench` is built-in — zero new dependencies.

### Add performance marks for critical user flows
**Issue**: #25 (partial) · **Labels**: performance

No app-specific performance traces. Can't answer "how long from card click to synergies rendered?"

**Work**:
1. Add `performance.mark('card-selected')` in card click handler
2. Add `performance.mark('synergies-rendered')` after synergy results paint
3. Add `performance.measure('card-to-synergies', 'card-selected', 'synergies-rendered')`
4. Pipe to Sentry or Vercel Speed Insights for RUM visibility
5. Consider marks for: initial load → first card visible, search → results displayed

**Impact**: Real user flow timing — bridges the gap between Lighthouse (synthetic) and actual UX.

---

## Priority 2 — Medium Impact, Low-Medium Effort

### Optimize static images
**Issue**: #126 (partial) · **Labels**: performance

7 playstyle PNGs (~130 KB each), OG image (182 KB), and icons are unoptimized.

**Work**:
- Convert playstyle PNGs to WebP (one-time manual conversion or `sharp` script)
- Optimize favicon/apple-touch-icon
- Add `srcset`/`sizes` to card images for responsive loading
- Consider AVIF for browsers that support it

**Impact**: Reduces image weight ~30-50%. Most visible on `/playstyles`.

### Inline critical CSS
**Labels**: performance

CSS is only 2.2 KB but still an external file blocking first paint.

**Work**:
- Inline the full CSS in a `<style>` tag in `index.html` (at this size, manual is fine)
- Or use `vite-plugin-css-injected-by-js`

**Impact**: Eliminates one render-blocking round-trip. Small but free improvement.

### Update #25 acceptance criteria
**Issue**: #25 · **Labels**: performance

The original issue is broad ("audit and fix"). Many items are already done. Should be updated to reflect remaining work and closed when Priority 1 items are complete.

---

## Priority 3 — For Scale (Not Needed Yet)

### Virtualize card lists
**Trigger**: When card count per list exceeds ~300

Currently rendering up to 204 DOM nodes in `CardList`. Fine now, but add `@tanstack/react-virtual` (4 KB) when the cap increases.

### Split CardDataContext
**Trigger**: When consumers multiply or loading state changes become frequent

All consumers re-render on any context change. Split into `CardMetadataContext` (loading/error) and `CardListContext` (card data) for fine-grained subscriptions.

### Move synergy engine to Web Worker
**Trigger**: When rule complexity or card pool grows significantly

`findSynergies()` runs on the main thread (memoized). Use `comlink` to offload to a Worker if it starts blocking UI (>50ms).

### Add Brotli pre-compression
**Trigger**: When bundle nears budget limits

Vercel already serves Brotli on the fly, but pre-compression (`vite-plugin-compression`) uses maximum compression level for ~5-10% better ratios on large assets like `allCards.json`.

---

## Tools Available

| Command | Purpose |
|---------|---------|
| `pnpm analyze` | Interactive bundle treemap (gzip + brotli sizes) |
| `pnpm size` | Check bundle budgets (runs in CI) |
| `pnpm lighthouse` | Run Lighthouse CI locally (auto-detects Chrome) |
| Chrome DevTools → Lighthouse | Manual per-page audit |
| Chrome DevTools → Performance | Runtime profiling (renders, main thread) |
| React DevTools → Profiler | Component render timing and counts |
