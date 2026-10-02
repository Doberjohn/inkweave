/**
 * Vercel Routing Middleware. Two jobs:
 *
 * 1. 308-redirect bare numeric /card/:id to its canonical slug URL /card/:id/:slug (#498 Phase 1
 *    follow-up).
 *
 *    WHY: Phase 1 made the prerender crawl emit only slug routes, so a bare numeric /card/:id has no
 *    prerendered file and Vercel's SPA rewrite served the homepage shell to non-JS crawlers —
 *    reintroducing the "card URL looks like the homepage" anti-pattern the SEO audit fixed. This
 *    redirects the numeric URL to the prerendered slug page instead.
 *
 *    The map (middleware-data/card-slugs.json) is generated at build time from the SAME engine
 *    `cardSlug` the app, sitemap, and prerender use, so the redirect target always matches a
 *    prerendered page. Unknown ids (invalid card, non-numeric) are not in the map and fall through
 *    to the SPA, which renders the noindex not-found page. Two-segment slug routes never match the
 *    matcher, so prerendered pages are served untouched. 308 (permanent) matches the repo's other
 *    vercel.json redirects and preserves the request method.
 *
 * 2. Serve a self-unregistering service worker at /sw.js on retired hosts (#634).
 *
 *    WHY: www.inkweave.ink served the app until 2026-07-15 (#488), so returning visitors from that
 *    window hold a Workbox SW registered on www. It answers navigations from its precached shell,
 *    its allCards.json fetch 308s cross-origin to the apex, and its own CSP connect-src 'self'
 *    blocks that hop, so the app fails with Workbox "no-response". SW script fetches treat
 *    redirects as errors, so the browser's update check must get a 200 here; that is why
 *    vercel.json's host redirects exempt /sw.js (they run before this middleware). Keep this
 *    indefinitely: stuck clients heal only when they next navigate to the retired host. The apex
 *    /sw.js falls through to the real Workbox worker.
 *
 *    Never Instant Rollback or revert to a deployment without this branch while a retired host
 *    serves Production: that host would serve the full app and the real Workbox /sw.js again,
 *    installing new workers that strand once the redirect returns. Switch the domain back to
 *    Redirect first. The matcher cannot filter by host, so apex /sw.js update checks also run
 *    this middleware; do not narrow it.
 */
import slugMap from './middleware-data/card-slugs.json' with {type: 'json'};

const SLUGS = slugMap as Record<string, string>;

/** Exact-match only, so preview *.vercel.app deployments never get the retirement worker. */
const RETIRED_HOSTS = new Set(['www.inkweave.ink', 'lorcana-synergy-finder.vercel.app']);

/**
 * Clears Cache Storage, unregisters itself, then moves open tabs to the same path on the apex.
 * Caches go first so the tab can never be served stale; every step is independent so one failure
 * cannot strand the rest. No fetch listener, no importScripts, no network requests.
 */
const RETIREMENT_SW = `// Inkweave retired-host worker (#634): removes a service worker registered on a host that now
// 308s to https://inkweave.ink. No fetch listener, no importScripts, no network requests.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch (e) {}
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {}
      try {
        await self.registration.unregister();
      } catch (e) {}
      let windows = [];
      try {
        windows = await self.clients.matchAll({type: 'window'});
      } catch (e) {}
      await Promise.all(
        windows.map(async (client) => {
          try {
            const url = new URL(client.url);
            await client.navigate('https://inkweave.ink' + url.pathname + url.search + url.hash);
          } catch (e) {}
        }),
      );
    })(),
  );
});
`;

export const config = {
  // /card/:id: single segment only (/card/:id/:slug is not matched). /sw.js: retired-host worker.
  matcher: ['/card/:id', '/sw.js'],
};

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (url.pathname === '/sw.js') return retiredHostServiceWorker(request, url);
  if (url.pathname.startsWith('/card/')) return cardSlugRedirect(url);
  return undefined;
}

/** Lowercase, drop a :port suffix and a trailing FQDN dot ("www.inkweave.ink." routes here too). */
function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/:[0-9]+$/, '')
    .replace(/[.]$/, '');
}

function isRetiredHost(request: Request, url: URL): boolean {
  return (
    RETIRED_HOSTS.has(normalizeHost(request.headers.get('host') ?? '')) ||
    RETIRED_HOSTS.has(normalizeHost(url.hostname))
  );
}

function retiredHostServiceWorker(request: Request, url: URL): Response | undefined {
  if (!isRetiredHost(request, url)) return undefined; // apex: the real Workbox worker
  return new Response(RETIREMENT_SW, {
    status: 200,
    headers: {'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store'},
  });
}

function cardSlugRedirect(url: URL): Response | undefined {
  const id = url.pathname.slice('/card/'.length);
  const slug = SLUGS[id];
  if (!slug) return undefined; // unknown id: continue to the SPA (renders the noindex not-found page)
  return new Response(null, {
    status: 308,
    headers: {Location: `/card/${id}/${slug}${url.search}`},
  });
}
