# Card image pipeline

Production is **content-addressed and self-hosted**; dev falls back to proxies. All URLs route through `resolveImageUrl(raw)` / `smallImageUrl(card)` in [`loader.ts`](loader.ts). inkweave-ui's CardTile takes its art URL through `artUrl`, which the app's CardTile ([`components/CardTile.tsx`](components/CardTile.tsx)) fills with `smallImageUrl` where a grid asks for small art (#980).

## The rule that matters

**Never put `immutable` on a URL that is not content-addressed.** Issue #323 was a year-long cache-poisoning bug from exactly that. Content addressing is what makes `Cache-Control: public, max-age=31536000, immutable` truthful: bytes change, so the URL changes, so every cache layer (browser, Vercel Edge, service worker) sees a fresh resource.

## Production build

Gated on `VITE_LOCAL_IMAGES=true`, set in `vercel.json`'s build command.

`scripts/convert-preview-images.mjs --force` runs first. It turns any raw scan in the git-ignored `apps/web/public/card-images-raw/` into the preview AVIFs. A deploy checkout holds a raw only when admin has just committed one, so `--force` lets a replaced image win over the AVIF already committed for that card. Without it the build shipped the old art, because the conversion workflow's own commit is `[skip ci]` and deploys nothing (#750).

`scripts/download-card-images.mjs` runs next. It downloads card images from Ravensburger for every card in `allCards.json` and the collection files, copies the committed preview AVIF (`apps/web/public/card-images-preview/{id}{-sm}.avif`) for any id that has one, which then wins over the remote URL (a reveal card, a variant, or a promo printing whose art is the owner's scan, #805), converts and resizes to two sizes, then **hashes each AVIF** (sha256 prefix, 16 hex chars) and writes:

- `apps/web/public/card-images/{id}.{hash}.avif`
- `apps/web/public/card-images/{id}.{hash}-sm.avif`

It also injects `imageHash` and `imageHashSm` into `allCards.json`, `previewCards.json` and the collection files (each set chunk and `collection/promos.json`). `resolveImageUrl` then builds `/card-images/{id}.{imageHash}.avif`; `smallImageUrl` builds `/card-images/{id}.{imageHashSm}-sm.avif`.

Those URLs never use a card's `images` links, so the build's copies of the same files ship without them (#932): `cardDataPlugin` in `vite.config.ts` moves each card's and printing's `images` into `data/image-sources.json`, which no page loads, and the next build's restore reads them back from there (`withImageSources` in `scripts/lib/imageRestore.mjs`). `public/data/` keeps them, as does any build without `VITE_LOCAL_IMAGES=true`, such as CI's E2E preview build.

Committed preview AVIFs also pin cards whose Ravensburger link has died, so a build that has to download them again keeps their art. Keep these files through any preview-image cleanup, and delete one only when its card has a working link again:

- `544` Hydra - Deadly Serpent (Set 3 #108): links dead since 2026-10-19; the files are the bytes production served, so the hashes didn't change (#1095).

Variant printings (a card's alternate art in its `variants`: Epic, Enchanted and Iconic, #625, and the printings that keep their base card's rarity, #796) go through the same path under their own id: each is its own image subject, its hashes land on the nested entry, and the loader resolves it with the same `resolveImageUrl`. A committed preview AVIF beats a remote URL for a variant exactly as for a card. A variant the build could not image is a warning in the build log, not a failure; it renders as a broken image, like any unhashed card.

The Ravensburger rewrite in `vercel.json` is now a dev-only fallback, dead in prod since every card has a hashed URL.

### Link preview images

Each card page's `og:image` and `twitter:image` name an image of its own (#1133): the card's art, its name, how many cards it pairs with and its three best partners. `scripts/generate-og-images.mjs` draws them after the web build and before the crawl, from the build's own `allCards.json`, synergy files, fonts and the AVIFs above, filling `scripts/og/card-template.html` once per card in Chromium. It saves each as `dist/og/card/{id}.{hash}.jpg`, the hash being the JPEG's own (sha256 prefix, 16 hex chars), which is what lets `vercel.json` serve `/og/` as `immutable` and what gets Facebook to fetch a changed image. The drawing repeats byte for byte (the generator turns off Chromium's partial raster, which otherwise antialiased the logo differently from run to run), so a card that didn't change keeps its URL. The crawl (`scripts/prerender.mjs`) then writes each image's URL and alt text into its card page in place of index.html's site banner, so index.html must keep each of those tags exactly once. A card without art keeps the banner. Check 12 of `scripts/check-rendered-html.mjs` fails the deploy when a card page with art kept it, and `build:vercel` runs the crawl even when the image step fails, so that failure costs the deploy, not every page's prerender. Partners and their tags come from `scripts/lib/cardOgImage.mjs`. The images are about 100 KB each, about 120 MiB a deploy, and Vercel uploads only the ones it hasn't seen. Facebook keeps a link's preview until it scrapes the page again, which its Sharing Debugger forces.

## Dev / CI

`VITE_LOCAL_IMAGES` unset. `resolveImageUrl` rewrites:

- `api.lorcana.ravensburger.com/images/...` → `/card-images/...`. The Vite dev proxy and the Vercel rewrite both forward to Ravensburger. The proxy key uses the trailing-slash form `'/card-images/'` so it does not also grab `/card-images-preview/*`.
- `lorcanaplayer.com/...` → `/card-images-preview/{id}.avif` (committed AVIFs). That host sits behind Cloudflare Bot Management, so server-to-server proxying fails.

`smallImageUrl` falls back to the `.avif` → `-sm.avif` string transform.

A card with image hashes and no links draws from its hashed files in this mode too. That is the shape a production deployment's card data takes once #932's last phase moves the links out, and admin reads inkweave.ink's card data in such a build. The dev proxy serves a hashed path from `public/card-images/` (which `pnpm download-images` fills) rather than forwarding it to Ravensburger.

## Service worker

Caches `/card-images/.+\.avif$` with workbox `CacheFirst` (30 days). Content-addressed URLs make this safe. The SW's `navigateFallbackDenylist` excludes `/card-images/*`, `/card-images-preview/*`, and `/data/*`, so direct asset-URL navigations hit the file rather than the SPA's NotFoundPage.

## Debugging

`curl` returns 200 but the browser shows "404": almost always the SW is serving `index.html` for the navigation (check the Network tab's source column for `(ServiceWorker)`), or a stale browser/Edge cache entry on a non-hashed URL.

Check `apps/web/public/card-images*` for committed assets before theorizing about CDNs.
