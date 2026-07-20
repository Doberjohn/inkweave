/**
 * Vercel Routing Middleware — 308-redirect bare numeric /card/:id to its canonical slug URL
 * /card/:id/:slug (#498 Phase 1 follow-up).
 *
 * WHY: Phase 1 made the prerender crawl emit only slug routes, so a bare numeric /card/:id has no
 * prerendered file and Vercel's SPA rewrite served the homepage shell to non-JS crawlers —
 * reintroducing the "card URL looks like the homepage" anti-pattern the SEO audit fixed. This
 * redirects the numeric URL to the prerendered slug page instead.
 *
 * The map (middleware-data/card-slugs.json) is generated at build time from the SAME engine
 * `cardSlug` the app, sitemap, and prerender use, so the redirect target always matches a
 * prerendered page. Unknown ids (invalid card, non-numeric) are not in the map and fall through to
 * the SPA, which renders the noindex not-found page. Two-segment slug routes never match the
 * matcher, so prerendered pages are served untouched. 308 (permanent) matches the repo's other
 * vercel.json redirects and preserves the request method.
 */
import slugMap from './middleware-data/card-slugs.json';

const SLUGS = slugMap as Record<string, string>;

export const config = {
  // Single segment after /card/ only. /card/:id/:slug (two segments) is not matched.
  matcher: '/card/:id',
};

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url);
  const id = url.pathname.slice('/card/'.length);
  const slug = SLUGS[id];
  if (!slug) return; // unknown id: continue to the SPA (renders the noindex not-found page)
  return new Response(null, {
    status: 308,
    headers: {Location: `/card/${id}/${slug}${url.search}`},
  });
}
