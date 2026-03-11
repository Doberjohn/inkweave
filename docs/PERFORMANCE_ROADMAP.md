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
- [x] Thumbnail images used in card grids (loader extracts both `images.full` and `images.thumbnail`)
- [x] Vitest benchmarks for synergy engine (`pnpm bench:engine`) — findSynergies, checkSynergy, getPairSynergies
- [x] ~~Performance marks for synergy computation~~ (removed — synergies now pre-computed at build time, not measured at runtime)
- [x] Playstyle cover images converted PNG → WebP (~75% size reduction)
- [x] CSS inlined into HTML via custom Vite plugin (eliminates render-blocking CSS request)
- [x] Playstyle image references updated `.png` → `.webp`

---

## Priority 2 — Medium Impact, Low-Medium Effort

### Optimize remaining static images
**Issue**: #126 (partial) · **Labels**: performance

OG image (182 KB) and icons are unoptimized.

**Work**:
- Optimize favicon/apple-touch-icon
- Add `srcset`/`sizes` to card images for responsive loading
- Consider AVIF for browsers that support it

**Impact**: Further image weight reduction.

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

### ~~Move synergy engine to Web Worker~~ (Resolved)
Synergies are now pre-computed at build time and served as static JSON. The engine no longer runs in the browser, so Web Worker offloading is unnecessary.

### Add Brotli pre-compression
**Trigger**: When bundle nears budget limits

Vercel already serves Brotli on the fly, but pre-compression (`vite-plugin-compression`) uses maximum compression level for ~5-10% better ratios on large assets like `allCards.json`.

---

## Tools Available

| Command | Purpose |
|---------|---------|
| `pnpm analyze` | Interactive bundle treemap (gzip + brotli sizes) |
| `pnpm bench:engine` | Run synergy engine benchmarks (ops/sec) |
| `pnpm size` | Check bundle budgets (runs in CI) |
| `pnpm lighthouse` | Run Lighthouse CI locally (auto-detects Chrome) |
| Chrome DevTools → Lighthouse | Manual per-page audit |
| Chrome DevTools → Performance | Runtime profiling (renders, main thread) |
| React DevTools → Profiler | Component render timing and counts |
