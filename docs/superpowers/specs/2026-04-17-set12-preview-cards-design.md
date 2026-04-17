# Set 12 Preview Cards — Design

**Issue**: [#278](https://github.com/Doberjohn/inkweave/issues/278)
**Date**: 2026-04-17
**Status**: Approved

## Problem

Set 12 (The Wilds Unknown) introduces Pixar IPs (Toy Story, The Incredibles, Brave) to Lorcana. Cards reveal gradually during preseason, weeks before the external card source publishes the full `allCards.json`. We need to:

1. Show revealed cards on a dedicated page with Set 12 branding
2. Include revealed cards in synergy computation so they integrate with the existing engine
3. Keep `allCards.json` untouched — it stays canonical, regenerated wholesale from the external source at graduation time
4. Provide a clean graduation path when the full set releases

## Non-goals

- **Instant display** (seconds after reveal). We accept a full deploy cycle per batch of added cards.
- **Admin UI** for adding cards. Data is curated manually via `previewCards.json` edits.
- **Supabase storage** or any runtime database dependency for card data.
- **Graduation tooling** — manual process for MVP, automation deferred.

## Architecture

### Data layer — two JSON sources, merged

```
previewCards.json ──┐
                    ├──► merged card pool ──► SynergyEngine ──► per-card synergy files
allCards.json ──────┘                                          (precompute-synergies.mjs)

At runtime:
previewCards.json ──┐
                    ├──► merged card array ──► useCardData() ──► app state
allCards.json ──────┘                          (loader.ts)
```

- `allCards.json` stays untouched. External source regenerates it wholesale at set graduation.
- `previewCards.json` follows the same LorcanaJSON format. Manually curated. Optional — if absent, the app works exactly as before.
- Merge happens in three places: loader (runtime), precompute script (build time), image download script (build time).

### Merge semantics

**Deduplication by card id**: if a card exists in both files, the `allCards.json` version wins. This makes graduation safe — dropping a stale `previewCards.json` file after updating `allCards.json` won't break anything.

**Graceful missing file**: if `previewCards.json` is missing or empty, no error. Loader logs a debug message and returns `allCards.json` data only.

### Reveals page — `/reveals`

Dedicated page with Set 12 branding. NOT a filtered view of the browse page — has its own visual identity including the set logo and three Pixar franchise logos (Toy Story, The Incredibles, Brave).

**Components:**
- **Set header**: Set 12 logo + optional splash art (design deferred to Pencil session)
- **Franchise filter chips**: three clickable logos. Clicking one filters the grid to cards from that franchise. Clicking the active one resets to show all. Only one franchise active at a time (mutually exclusive).
- **Card grid**: same CSS Grid as BrowsePage (`gap: 12px`, responsive columns). Cards clickable if they have synergies (linked to `/card/:cardId`), otherwise display-only tiles.
- **Empty state**: when `previewCards.json` has no Set 12 cards yet, render a themed "Coming soon" message instead of an empty grid.

**Franchise detection**: deferred to implementation. The field (`classifications`, `subtypes`, or custom) will be determined from actual Set 12 card data once revealed. Spec assumes a string value matchable to one of three franchises.

**Synergy awareness**: page loads `_manifest.json` (card IDs with precomputed synergies) once on mount. Cards in the manifest render as clickable `<Link>` elements; cards absent from the manifest render as non-interactive tiles with no hover state.

## Files affected

### Created

| File | Purpose |
|------|---------|
| `apps/web/public/data/previewCards.json` | Preview card data (LorcanaJSON format). Starts with empty `cards: []` array. |
| `apps/web/src/pages/RevealsPage.tsx` | Reveals page component |
| `apps/web/src/pages/RevealsPage.stories.tsx` | Storybook stories (required by CI `check:stories`) |
| `apps/web/src/features/reveals/` | Feature folder for reveals-specific components if the page grows |

### Modified

| File | Change |
|------|--------|
| `apps/web/src/features/cards/loader.ts` | `fetchCardsFromLocal()` fetches `/data/previewCards.json` with graceful 404, merges by id |
| `scripts/precompute-synergies.mjs` | Load both JSON files, merge before transforming cards |
| `scripts/download-card-images.mjs` | Iterate cards from both files when building image task list |
| `apps/web/src/router.tsx` | Add `/reveals` route with lazy-loaded component |
| `apps/web/src/shared/components/CompactHeader.tsx` | Add "Reveals" link to desktop nav strip |
| `apps/web/src/shared/components/MobileBottomNav.tsx` | Add "Reveals" link (or decide on placement — 2 tabs + search currently) |

## Data flow — concrete example

**Scenario**: User adds "Woody, Deputy Sheriff" to `previewCards.json`, pushes to git.

1. Vercel build triggers
2. `download-card-images.mjs`: reads both JSON files, downloads Woody's image, resizes to AVIF
3. `build:engine`: no change, just rebuilds TypeScript
4. `precompute-synergies.mjs`: loads both files, merges into one array (1429 existing + 1 new = 1430 cards), runs engine across the merged pool, writes `{woody-id}.json` to `public/data/synergies/`
5. `build:web`: Vite build as normal
6. Deploy

**At runtime:**
1. `useCardData()` hook triggers `fetchCardsFromLocal()`
2. Loader fetches `/data/allCards.json` (always) and `/data/previewCards.json` (404-tolerant)
3. Returns merged card array to the app
4. `/reveals` page mounts, filters for `setCode === '12'`, fetches `_manifest.json`
5. Woody appears in the grid — clickable because synergies exist

## Key design decisions

**1. Merge on read, not on build.** The two JSON files stay separate on disk. Loader merges them at runtime. Rationale: cleaner graduation (delete one file), no build step that rewrites source files.

**2. Loader handles merge — not a wrapper hook.** Keeping merge logic in `fetchCardsFromLocal()` means every consumer (tests, Storybook, scripts) gets merged data automatically. No risk of a call site skipping the merge.

**3. Reveals page does its own filtering.** Rather than adding a `preview` flag to cards, the page filters by `setCode === '12'`. This keeps the card type unchanged and makes the reveals page self-contained.

**4. Synergy awareness via `_manifest.json` fetch.** Already used by `usePrecomputedSynergies`. Reuse the same fetch pattern — don't add a new data flow for "is this card clickable."

**5. No new nav slot on mobile.** MobileBottomNav currently has 2 tabs + search. Adding a third tab crowds the design. Options: (a) add as third tab with a Set 12 icon, (b) temporarily replace the search button during Set 12 reveal season, (c) promote Reveals into the mobile home page hero instead. Decision deferred to Pencil design session — default to (a) for initial implementation.

## Graduation path

When external source publishes full Set 12:

1. Update `apps/web/public/data/allCards.json` with the regenerated export (includes Set 12)
2. Empty `previewCards.json`: `{ "metadata": {...}, "sets": {}, "cards": [] }` (or delete the file entirely)
3. Rebuild and deploy — engine recomputes synergies against the canonical card pool
4. Optional: remove `/reveals` route if not repurposed for Set 13

Dual-presence handling: if step 2 is skipped, the deduplication rule (allCards wins) silently handles the overlap. The site still works, just with a redundant file.

## Rollback

**Per-card**: remove card entry from `previewCards.json`, rebuild, deploy.
**Full feature**: empty `previewCards.json`, remove `/reveals` route, revert loader/script changes. No database rollback needed.

## Testing strategy

**Unit tests:**
- Loader merge logic: both files load, dedup by id, graceful 404 on missing preview file, empty preview file handling
- Reveals page: renders empty state, renders grid with cards, franchise filter toggles correctly, manifest-aware linking

**E2E tests:**
- `/reveals` loads without errors when `previewCards.json` is empty
- `/reveals` loads with test card data and shows expected grid
- Franchise filter click reduces visible cards, second click resets
- Clickable card tile navigates to `/card/:cardId`

**Build verification:**
- `pnpm build:engine && pnpm precompute-synergies` succeeds with a test card in `previewCards.json`
- Synergy file written for the test card
- Card appears in `_manifest.json`

## Open questions (resolved during implementation)

1. **Franchise field**: what property on `LorcanaCard` identifies Toy Story / Incredibles / Brave? Likely `classifications` or `subtypes`. Resolve when first Set 12 card data is available.
2. **Mobile nav placement**: tab vs home-page promotion. Resolve in Pencil design.
3. **Splash art**: include in header or skip. Resolve in Pencil design.

## Future enhancements (out of scope)

- `scripts/graduate-card.mjs` — automate moving individual cards from preview to main pool
- Franchise-themed backgrounds that change based on active filter
- Countdown timer to release date
- Animation treatments on card reveal (e.g., new cards glow for 24 hours after being added)
