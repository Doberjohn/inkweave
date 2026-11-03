/**
 * Vercel Routing Middleware. Two jobs:
 *
 * 1. Send every card URL to its one address, /card/:id/:slug.
 *
 *    A known id under a bare /card/:id or under another slug (a card renamed since, or a slug typed
 *    by hand) gets a 308 to its current slug URL, the query kept. Its current slug URL falls
 *    through to the prerendered page. An id the map lacks gets the 404 page with status 404, so a
 *    crawler reads a made-up card address as missing rather than as a page.
 *
 *    The map (middleware-data/card-slugs.json) is generated at build time from the SAME engine
 *    `cardSlug` the app, sitemap, and prerender use, so the redirect target always matches a
 *    prerendered page. 308 (permanent) matches the repo's other vercel.json redirects and
 *    preserves the request method.
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
import slugMap from './middleware-data/card-slugs.json';

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
  // The card URLs, bare and with a slug; /sw.js for the retired-host worker.
  matcher: ['/card/:id', '/card/:id/:slug', '/sw.js'],
};

export default function middleware(request: Request): Response | Promise<Response> | undefined {
  const url = new URL(request.url);
  if (url.pathname === '/sw.js') return retiredHostServiceWorker(request, url);
  if (url.pathname.startsWith('/card/')) return cardAddress(url);
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

function cardAddress(url: URL): Response | Promise<Response> | undefined {
  const [id, slug] = url.pathname.slice('/card/'.length).split('/');
  // Own keys only, so an id like "constructor" can't pick up Object.prototype's.
  const current = Object.prototype.hasOwnProperty.call(SLUGS, id) ? SLUGS[id] : undefined;
  if (!current) return notFound(url);
  if (slug === current) return undefined; // the prerendered page
  return new Response(null, {
    status: 308,
    headers: {Location: `/card/${id}/${current}${url.search}`},
  });
}

/** For when the 404 page itself can't be fetched, as on a preview behind Vercel's login. */
const NOT_FOUND_FALLBACK = '<!doctype html><title>Page not found | Inkweave</title><p>Page not found. <a href="/">Go to Inkweave</a></p>';

/**
 * The deployment's own 404 page, the app's shell, with status 404: a browser runs the app, which
 * shows its not-found page, and a crawler reads the status. /404.html is outside the matcher, so
 * fetching it never comes back here.
 */
async function notFound(url: URL): Promise<Response> {
  const headers = {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'};
  try {
    const page = await fetch(new URL('/404.html', url));
    if (page.ok) return new Response(await page.text(), {status: 404, headers});
  } catch {
    // fall through to the plain page
  }
  return new Response(NOT_FOUND_FALLBACK, {status: 404, headers});
}
