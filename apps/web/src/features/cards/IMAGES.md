# Card image pipeline

Production is **content-addressed and self-hosted**; dev falls back to proxies. All URLs route through `resolveImageUrl(raw)` / `smallImageUrl(card)` in [`loader.ts`](loader.ts).

## The rule that matters

**Never put `immutable` on a URL that is not content-addressed.** Issue #323 was a year-long cache-poisoning bug from exactly that. Content addressing is what makes `Cache-Control: public, max-age=31536000, immutable` truthful: bytes change, so the URL changes, so every cache layer (browser, Vercel Edge, service worker) sees a fresh resource.

## Production build

Gated on `VITE_LOCAL_IMAGES=true`, set in `vercel.json`'s build command.

`scripts/download-card-images.mjs` runs first. It downloads card images from Ravensburger for every card in `allCards.json`, copies any committed preview AVIFs (`apps/web/public/card-images-preview/{id}{-sm}.avif`) for cards in `previewCards.json`, converts and resizes to two sizes, then **hashes each AVIF** (sha256 prefix, 16 hex chars) and writes:

- `apps/web/public/card-images/{id}.{hash}.avif`
- `apps/web/public/card-images/{id}.{hash}-sm.avif`

It also injects `imageHash` and `imageHashSm` into `allCards.json` and `previewCards.json`. `resolveImageUrl` then builds `/card-images/{id}.{imageHash}.avif`; `smallImageUrl` builds `/card-images/{id}.{imageHashSm}-sm.avif`.

The Ravensburger rewrite in `vercel.json` is now a dev-only fallback, dead in prod since every card has a hashed URL.

## Dev / CI

`VITE_LOCAL_IMAGES` unset. `resolveImageUrl` rewrites:

- `api.lorcana.ravensburger.com/images/...` → `/card-images/...`. The Vite dev proxy and the Vercel rewrite both forward to Ravensburger. The proxy key uses the trailing-slash form `'/card-images/'` so it does not also grab `/card-images-preview/*`.
- `lorcanaplayer.com/...` → `/card-images-preview/{id}.avif` (committed AVIFs). That host sits behind Cloudflare Bot Management, so server-to-server proxying fails.

`smallImageUrl` falls back to the `.avif` → `-sm.avif` string transform.

## Service worker

Caches `/card-images/.+\.avif$` with workbox `CacheFirst` (30 days). Content-addressed URLs make this safe. The SW's `navigateFallbackDenylist` excludes `/card-images/*`, `/card-images-preview/*`, and `/data/*`, so direct asset-URL navigations hit the file rather than the SPA's NotFoundPage.

## Debugging

`curl` returns 200 but the browser shows "404": almost always the SW is serving `index.html` for the navigation (check the Network tab's source column for `(ServiceWorker)`), or a stale browser/Edge cache entry on a non-hashed URL.

Check `apps/web/public/card-images*` for committed assets before theorizing about CDNs.
