# Synergy Spotlight banner exporter

Generates the shareable "Synergy Spotlight" images for a single card — the ones used for
Reddit / Facebook posts — straight from the live app, so the output is pixel-identical to
what the site renders.

```bash
pnpm banner <cardId>        # e.g. pnpm banner 2983
```

## What you get

Files land in `reports/banners/<cardId>/` (git-ignored), two per carousel page:

| File | Size | Use |
|------|------|-----|
| `<slug>-page-N.png` | 3600×3720, lossless | **Reddit** |
| `<slug>-page-N-fb2048.jpg` | 2048px wide, 4:4:4 JPEG | **Facebook** |

Facebook caps photos at 2048px on the longest side and re-compresses on upload, so the
`-fb2048` variant is pre-sized to that width (with `4:4:4` chroma so colored text and
gradients stay crisp). Reddit keeps the full-res PNG.

## How it works

The script (`scripts/export-banner.mjs`) is a thin camera pointed at the real UI:

1. Reads `apps/web/public/data/synergies/<id>.json`, counts the synergy groups, and derives
   the page count (`pageCountForGroups`) using the **same** `MAX_GROUPS = 6` / `ROWS_PER_PAGE = 3`
   rules as `BannerPage.tsx`. Errors out if the card has no precomputed synergies.
2. Ensures a dev server on `:5173` — reuses one that's already running, otherwise starts a
   throwaway Vite and shuts it down afterwards.
3. Drives headless Chromium (Playwright) at `deviceScaleFactor: 3`, navigating to
   `/banner/<id>?page=<n>`, waiting for the `.banner-stage` element plus fonts/images, hiding
   dev-only floating overlays, and screenshotting just that element → the PNG.
4. Derives the Facebook JPEG from that PNG with sharp.

The rendering itself is three files:

- `apps/web/src/router.tsx` — the `/banner/:cardId?page=N` route (lazy, dev/generator only).
- `apps/web/src/pages/BannerPage.tsx` — loads the card + precomputed synergies, slices groups
  into pages.
- `apps/web/src/features/synergies/components/SynergyBanner.tsx` — the 1200×1240 stage:
  hero + CTA/QR on the left, one synergy per row on the right, badge + set logo.

## Making a new card look as polished as Pocahontas

The layout reproduces for any card automatically. The bespoke touches are opt-in, via four
maps in `SynergyBanner.tsx`, each keyed by card id:

| Map | Controls | Fallback when absent |
|-----|----------|----------------------|
| `HERO_OVERRIDES` | transparent "pop-out" hero art | the card's normal full-res art |
| `CARD_BLURBS` | the per-synergy sentence copy | generic `BANNER_BLURBS` line |
| `CARD_PICKS` | the exact 3 partner cards per row (by id) | top 3 by synergy score |
| `CARD_BLURB_HIGHLIGHTS` | which phrases are bolded in a blurb | nothing bolded |

Workflow for the next spotlight card:

1. `pnpm banner <newId>` to see the generic version.
2. Add that card's entries to the four maps for full polish. Pick partner card ids from the
   card's own `apps/web/public/data/synergies/<newId>.json` so they're genuinely in the group
   (that keeps the "+N more" counts honest).
3. Re-run `pnpm banner <newId>`.

Shared assets (card back, QR) live in `apps/web/public/art/banner/`; per-card pop-out art goes
there too.

## Notes

- `MAX_GROUPS` / `ROWS_PER_PAGE` are duplicated between this script and `BannerPage.tsx`
  because a `.mjs` script can't import the `.tsx` constants. If you retune the page size in the
  route, update both — the comment in each file points at the other.
- The card must be a Core card with precomputed synergies. Run `pnpm precompute-synergies`
  first if you've just changed rules or data.
