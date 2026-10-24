/**
 * Post-build prerender crawl (issue #486).
 *
 * Renders the ALREADY-BUILT SPA (apps/web/dist) in headless Chromium and writes real,
 * content-bearing per-route HTML back into dist/<route>/index.html. This makes every card
 * and playstyle page visible to non-JS crawlers (Bing, GPTBot/ClaudeBot/Perplexity, social
 * unfurlers) and bakes each route's <title>/<meta>/<link rel=canonical> (set client-side by
 * the <Seo> component via React 19 native metadata) into the static response.
 *
 * Why a crawl instead of SSR: it runs the production bundle unchanged, so Rolldown/Oxc, the
 * React Compiler, react-router v7 Data Mode and VitePWA all execute exactly as they ship — it
 * asks nothing of the build toolchain and emits only HTML (zero impact on the JS bundle gate).
 *
 * Run AFTER `pnpm build:web`. In CI/Vercel the browser must be installed first
 * (`playwright install chromium`). Set PRERENDER_SAMPLE=1 to crawl a small subset for a fast
 * smoke check. Set PRERENDER_CPU_THROTTLE=<n> to slow each page's CPU n-fold (reproduces
 * render races such as #584's). Set PRERENDER_PHONE=0 to skip each route's phone capture
 * (#915). Set SKIP_PRERENDER=1 to skip the crawl and ship SPA-only:
 * .github/workflows/deploy-staging.yml does, because staging is never indexed (#741).
 */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, dirname, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAPTURE_MEDIA} from './lib/captureMedia.mjs';
import {contentType} from './lib/mime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = resolve(ROOT, 'apps/web/dist');
// Resolve Playwright from apps/web's node_modules (where @playwright/test is installed) —
// a root script can't see it otherwise.
const require = createRequire(resolve(ROOT, 'apps', 'web', 'package.json'));
const {chromium} = require('@playwright/test');
const PORT = 4179;
const CONCURRENCY = 8;
// The static shell <title> in index.html. A route is "rendered" once its <Seo> has replaced it.
const SHELL_TITLE = 'Inkweave — Master Lorcana Synergies';
// The hero logo's two files (apps/web/src/shared/constants/heroLogo.ts, #639): the crawl
// captures the animated one, and cleanPrerenderedHtml ships the static one.
const STATIC_LOGO_SRC = '/brand/logo-static.svg';
const ANIMATED_LOGO_SRC = '/brand/logo-animated.svg';
// The script tag <SpeedInsights /> adds to <head> at runtime, matched by its SDK name rather
// than its src, which varies by environment. cleanPrerenderedHtml drops it.
const SPEED_INSIGHTS_SCRIPT = /<script\b[^>]*\bdata-sdkn="@vercel\/speed-insights[^"]*"[^>]*><\/script>/g;
// The phone each route is captured on a second time (#915). The app picks its layout in
// JavaScript (useResponsive: a phone below 768 px), so the desktop capture's inline styles lay a
// phone's screen out wrong; index.html's inline script swaps the phone capture in there.
const PHONE = {
  viewport: {width: 390, height: 844},
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

/**
 * Is a reveal season live?
 *
 * `/reveals` redirects to '/' off-season, so crawling it then would capture the HOME
 * page under a /reveals URL — the exact failure this route is being added to fix.
 * Mirrors the app's data gate: a set in previewCards.json whose releaseDate is still
 * in the future. The season also needs VITE_IS_REVEAL_SEASON at build time, but that
 * is inlined into the bundle and not visible here; the runbook sets both together, and
 * a mismatch only costs one wasted route, which is today's behaviour anyway.
 */
export function isRevealSeasonActive(preview, now = new Date()) {
  return Object.values(preview?.sets ?? {}).some(
    (set) => set?.releaseDate && new Date(set.releaseDate) > now,
  );
}

async function hasActiveRevealSeason() {
  try {
    const preview = JSON.parse(await readFile(join(DIST, 'data', 'previewCards.json'), 'utf8'));
    return isRevealSeasonActive(preview);
  } catch {
    return false; // no preview data shipped means no season
  }
}

/** Enumerate every route worth prerendering, grouped so sampling can cover each kind. */
async function enumerateRoutes() {
  // Import the built engine from its dist path (matches scripts/precompute-synergies.mjs);
  // the workspace package name isn't resolvable from a root script.
  const enginePath = join(ROOT, 'packages', 'synergy-engine', 'dist', 'index.js');
  const {getAllPlaystyles, cardPath} = await import(
    new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href
  );
  const cardData = JSON.parse(await readFile(join(DIST, 'data', 'allCards.json'), 'utf8'));
  return {
    // Must stay in sync with STATIC_ROUTES in scripts/generate-sitemap.mjs. /vote was
    // missing here while present there (#525), so the deploy logged 1053 sitemap URLs
    // against 1052 prerendered routes and /vote fell through to the SPA rewrite —
    // serving the homepage's prerendered HTML, canonical and all.
    staticRoutes: [
      '/',
      '/browse',
      '/playstyles',
      '/vote',
      '/inks',
      '/ink/amber',
      '/ink/amethyst',
      '/ink/emerald',
      '/ink/ruby',
      '/ink/sapphire',
      '/ink/steel',
      '/about',
      '/release-notes',
      '/privacy',
      '/terms',
      '/disclaimer',
      // In season only. Deliberately NOT in generate-sitemap.mjs's STATIC_ROUTES: the
      // page is noindex, because it is live for a few weeks a year and redirects the
      // rest, and reveal card ids are renumbered at graduation. Prerendering it is for
      // link unfurls, not search — without it, sharing /reveals anywhere that does not
      // run JS (Discord, Slack, iMessage) shows the homepage's title and description.
      ...(await hasActiveRevealSeason() ? ['/reveals'] : []),
    ],
    playstyleRoutes: getAllPlaystyles().map((p) => `/playstyles/${p.id}`),
    cardRoutes: cardData.cards.map((c) => cardPath(c)),
  };
}

/**
 * The headers for a file the crawl serves from dist. Every file may be cached for an hour
 * (#867), so each worker's browser context fetches the bundle, the fonts and the 2 MB
 * allCards.json once instead of on every route: a card page fetched 78 files, 4.6 MB, and now
 * fetches about 18, 0.2 MB. Safe because dist doesn't change under the crawl (nothing fetches
 * the index.html files it writes; extensionless routes get the cached shell), and the cache
 * lives only in the crawl's own contexts, which close with it. Exported for
 * scripts/prerender.test.mjs.
 */
export function fileHeaders(ext) {
  return {'Content-Type': contentType(ext), 'Cache-Control': 'max-age=3600'};
}

/**
 * Minimal static server over dist with an SPA fallback (extensionless paths -> index.html).
 * `shellHtml` is the CLEAN build shell, cached once by the caller: the home-route crawl
 * overwrites dist/index.html with home's rendered HTML, so re-reading it per request would
 * bake home's <meta>/<link> into every subsequent route (React 19 does not dedup them).
 */
function startServer(shellHtml) {
  const server = createServer((req, res) => {
    void (async () => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const ext = extname(urlPath);
      if (ext) {
        const filePath = join(DIST, urlPath);
        if (filePath.startsWith(DIST) && existsSync(filePath)) {
          res.writeHead(200, fileHeaders(ext));
          res.end(await readFile(filePath));
          return;
        }
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(shellHtml);
    })();
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

/**
 * Clean a captured page before it is written to dist.
 *
 * 1. Strips index.html's static shell `<title>` (#492). React 19 hoists the per-route
 *    `<Seo>` title but does NOT remove the shell one (kept as a fallback for routes
 *    without `<Seo>`), leaving a redundant second title in the capture. The per-route
 *    title already came first and won for crawlers, so this is cosmetic — but exactly
 *    one `<title>` is what validators and scripts/check-rendered-html.mjs expect.
 *
 * 2. Rewrites the crawl server's absolute origin out of the HTML (#525). Vite's
 *    `__vitePreload` resolves modulepreload hrefs against the page origin, so a capture
 *    served from http://localhost:4179 bakes that origin into 7-14
 *    `<link rel="modulepreload">` tags per page. Shipped to production those are
 *    plain-HTTP subresource hints on an HTTPS page, which vercel.json's
 *    `default-src 'self'` CSP blocks outright — dead requests, wasted preload slots, and
 *    a batch of console violations on every page load for every visitor and every
 *    rendering crawler. Stripping the origin makes them root-relative, which is what
 *    they should have been.
 *
 * 3. Points the hero logo back at the static file (#639). HeroSection paints
 *    logo-static.svg and swaps to logo-animated.svg after `load`. The crawl captures after
 *    `networkidle`, which comes after that swap, so without this rewrite every shipped page
 *    would paint the animated logo from first paint, running per-frame work during load.
 *
 * 4. Drops the Speed Insights script tag. <SpeedInsights /> adds it at runtime, so the crawl
 *    captures it, and vercel.json serves the captured homepage as index.html for every route
 *    that isn't prerendered. A shipped tag makes the live component skip adding its own, and
 *    only that one carries the page's route pattern (useSpeedInsightsRoute) and follows
 *    client-side navigation. Left in, every non-prerendered route would report as `/`.
 *
 * Exported for scripts/prerender.test.mjs. The origin rewrite MUST remove every
 * occurrence — a single-replace regression would leave 6-13 per page and be invisible
 * in a spot check of the built output.
 */
export function cleanPrerenderedHtml(html, shellTitle, origin) {
  return html
    .replace(`<title>${shellTitle}</title>`, '')
    .replaceAll(origin, '')
    .replaceAll(ANIMATED_LOGO_SRC, STATIC_LOGO_SRC)
    .replaceAll(SPEED_INSIGHTS_SCRIPT, '');
}

/**
 * Is dist/index.html still the untouched build shell? (#542)
 *
 * The home route writes its capture to DIST itself (`outDir` in crawlRouteOnce), so crawling
 * `/` REPLACES the file this script reads as its shell. Within one process that is
 * handled — main() caches the shell before crawling. Across processes it is not: a second
 * `node scripts/prerender.mjs` without an intervening `pnpm build:web` reads the rendered
 * homepage and serves it as the shell for every route.
 *
 * Every downstream symptom of that is silent:
 *   - every route inherits HomePage's <Seo> metadata, so captures carry two real <title>s
 *   - cleanPrerenderedHtml no-ops, because it strips a LITERAL `<title>${shellTitle}` that
 *     a crawled shell no longer contains
 *   - worst, the corruption defeats its own detector: crawlRouteOnce treats a route as
 *     rendered once `document.title !== SHELL_TITLE`, and a crawled shell's title already
 *     differs — so the "title never left the shell" guard cannot fire and the run reports
 *     success while writing wrong HTML
 *
 * Anchored on the shell title rather than, say, an empty #root: PRERENDER_URL and
 * PRERENDER_SAMPLE make scoped re-runs a normal workflow, and the title is the one marker
 * that is present in every clean build and absent from every crawled one.
 */
export function isCleanShell(html, shellTitle) {
  // Comments are stripped first because index.html documents the shell title in prose
  // right next to it ("<title> above is a fallback for routes without <Seo>"). A comment
  // carrying the exact literal would otherwise satisfy this predicate on a crawled shell —
  // and would mislead cleanPrerenderedHtml too, whose single `.replace()` takes the FIRST
  // occurrence and would strip the comment's copy while leaving the real title behind.
  return html.replace(/<!--[\s\S]*?-->/g, '').includes(`<title>${shellTitle}</title>`);
}

/**
 * Routes whose real content lands AFTER their <Seo> title, so the title check passes too
 * early (#584). /browse: VirtuosoGrid mounts no tiles until it has measured its container,
 * and tiles are what start the image requests, so `networkidle` can settle before one card
 * link exists. These routes also wait for their selector, and any failed attempt re-crawls
 * the route on a fresh page, READY_ATTEMPTS attempts in all. The /browse selector is what
 * scripts/check-rendered-html.mjs demands of the capture: at least one href="/card/.
 */
export const READY_SELECTORS = {'/browse': 'a[href^="/card/"]'};
const READY_ATTEMPTS = 3;

/**
 * Card pages wait for their footer too (#532). It renders only once the card's synergies have
 * loaded, and its title passes as soon as the card itself renders, before the synergy request
 * has even started. check-rendered-html.mjs demands the footer's six ink-hub links of every
 * sampled card page, and the footer also means the synergy groups are in the capture.
 */
export const CARD_READY_SELECTOR = 'footer[aria-label="Site footer"]';

/** The selector `route` waits for before capture, if any. */
export function readySelectorFor(route) {
  return READY_SELECTORS[route] ?? (route.startsWith('/card/') ? CARD_READY_SELECTOR : undefined);
}

/**
 * Crawl `route` through `crawlOnce(route, selector)`. A route with a ready selector is
 * re-crawled until an attempt succeeds or READY_ATTEMPTS run out; every other route gets a
 * single attempt, so a genuinely broken crawl still reaches main()'s failure-rate guard
 * without a 3x delay. `crawlOnce` is a parameter so scripts/prerender.test.mjs can drive
 * the retries without a browser.
 */
export async function crawlRoute(route, crawlOnce) {
  const selector = readySelectorFor(route);
  const attempts = selector ? READY_ATTEMPTS : 1;
  let result;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await crawlOnce(route, selector);
    if (result.ok) return result;
    if (attempt < attempts) {
      console.warn(`[prerender] retry ${route} (${attempt}/${attempts}): ${result.error}`);
    }
  }
  return result;
}

/**
 * Debug knob (#584): PRERENDER_CPU_THROTTLE=<n> slows the page's CPU n-fold, to reproduce
 * render races on purpose.
 */
async function applyCpuThrottle(page) {
  const rate = Number(process.env.PRERENDER_CPU_THROTTLE || 0);
  if (rate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate});
  }
}

/**
 * Does the page show the route's real content (#584)? A route with a ready selector (see
 * readySelectorFor) waits up to 15 s for it: on /browse the title passes before the virtualized
 * grid has drawn a single card link, and on a card page before its footer. Every other route has
 * no selector and passes at once. Exported for scripts/prerender.test.mjs.
 */
export async function hasReadyContent(page, selector) {
  if (!selector) return true;
  return page
    .waitForSelector(selector, {state: 'attached', timeout: 15000})
    .then(() => true)
    .catch(() => false);
}

/**
 * Mark the page with the route it was captured on, and write each select's chosen option into
 * its markup (#915). Runs in the page through `page.evaluate`, so it uses nothing from this
 * module; `doc` is the page's own document there, and a stand-in in scripts/prerender.test.mjs.
 *
 * - The mark on #root is what index.html's inline script reads: vercel.json serves the home
 *   page's capture for every route without a file of its own, and the script empties a
 *   capture whose mark names another route before it can paint.
 * - A select's chosen option is a property, which `page.content()` never writes into the HTML,
 *   so Browse's capture showed its sort menu's first option, not the one the app shows.
 */
export function markPrerenderedRoot(route, doc = document) {
  doc.getElementById('root')?.setAttribute('data-prerender-route', route);
  for (const select of doc.querySelectorAll('select')) {
    for (const option of select.options) option.toggleAttribute('selected', option.selected);
  }
}

/**
 * Read the phone capture off its page (#915): #root's markup, and the image preloads in <head> as
 * markup, for mergePhoneCapture to copy. Runs in the page through `page.evaluate`, like
 * markPrerenderedRoot, after it.
 */
export function readPhoneCapture(doc = document) {
  const preloads = [...doc.head.querySelectorAll('link[rel~="preload"][as="image"]')];
  return {
    html: doc.getElementById('root')?.innerHTML ?? '',
    preloads: preloads.map((link) => link.outerHTML),
  };
}

/**
 * Merge the phone capture into the desktop page before it is captured (#915): its markup in an
 * inert `<template id="prerender-phone">` right after #root, which index.html's inline script
 * swaps in on a phone, and each capture's image preloads limited to the screens that show it
 * (`media`), so neither layout preloads the other's. Runs in the desktop page through
 * `page.evaluate`, like markPrerenderedRoot, so it uses nothing from this module: `media` is
 * CAPTURE_MEDIA.
 */
export function mergePhoneCapture({html, preloads, media}, doc = document) {
  const template = doc.createElement('template');
  template.id = 'prerender-phone';
  template.innerHTML = html;
  doc.getElementById('root')?.after(template);
  for (const link of doc.head.querySelectorAll('link[rel~="preload"][as="image"]')) {
    link.setAttribute('media', media.desktop);
  }
  const phonePreloads = doc.createElement('template');
  phonePreloads.innerHTML = preloads.join('');
  for (const link of phonePreloads.content.children) link.setAttribute('media', media.phone);
  doc.head.append(phonePreloads.content);
}

/**
 * Keep a phone from fetching the images only the desktop capture shows (#915). A phone's preload
 * scanner reads the desktop markup before the inline script swaps the phone capture in, and
 * fetches every eager image in it, so each eager image in #root that the phone capture doesn't
 * use turns lazy: index.html doesn't lay an unapproved #root out on a phone, so a lazy one never
 * loads there. Each also gets a preload limited to `desktopMedia`, carrying what decides how the
 * image is fetched, so a desktop still fetches it as early as the scanner did. Runs in the
 * desktop page after mergePhoneCapture, which put the phone capture in the page.
 */
export function deferDesktopOnlyImages(desktopMedia, doc = document) {
  const srcsOf = (nodes, name) => new Set([...nodes].map((node) => node.getAttribute(name)));
  const phone = doc.getElementById('prerender-phone').content;
  const phoneSrcs = srcsOf(phone.querySelectorAll('img'), 'src');
  const preloaded = srcsOf(doc.head.querySelectorAll('link[rel~="preload"][as="image"]'), 'href');
  // The image's attributes that decide how it is fetched, as its preload names them.
  const fetchAttributes = (img) =>
    [
      ['fetchpriority', 'fetchpriority'],
      ['crossorigin', 'crossorigin'],
      ['srcset', 'imagesrcset'],
      ['sizes', 'imagesizes'],
    ]
      .filter(([name]) => img.hasAttribute(name))
      .map(([name, as]) => [as, img.getAttribute(name)]);
  const preloadFor = (img) => {
    const link = doc.createElement('link');
    const attributes = [
      ['rel', 'preload'],
      ['as', 'image'],
      ['href', img.getAttribute('src')],
      ['media', desktopMedia],
      ...fetchAttributes(img),
    ];
    for (const [name, value] of attributes) link.setAttribute(name, value);
    return link;
  };
  const eagerImages = doc.querySelectorAll(
    '#root img[src]:not([loading="lazy"]):not([src^="data:"])',
  );
  for (const img of eagerImages) {
    const src = img.getAttribute('src');
    if (phoneSrcs.has(src)) continue;
    img.setAttribute('loading', 'lazy');
    if (preloaded.has(src)) continue;
    preloaded.add(src);
    doc.head.append(preloadFor(img));
  }
}

const errorMessage = (e) => (e && e.message ? e.message : String(e));

/**
 * Load `route` in `page` and wait for its content. Returns why the page isn't ready to capture,
 * or undefined once it is.
 */
async function loadRoute(page, route, selector) {
  // Tells the app it is being crawled, so it never loads Sentry: its modulepreload would be
  // baked into the captured HTML (#640; deploy check 7 in check-rendered-html.mjs).
  await page.addInitScript(() => {
    window.__INKWEAVE_PRERENDER__ = true;
  });
  await applyCpuThrottle(page);
  await page.goto(`http://localhost:${PORT}${route}`, {waitUntil: 'networkidle', timeout: 30000});
  // A route is "rendered" once its <Seo> has replaced the shell <title>, i.e. the real content
  // (not the loading skeleton) is on the page. If that never happens within the timeout, the
  // capture is just the empty shell — crawlRouteOnce returns ok:false so the failure-rate guard
  // in main() can catch a broken crawl. Otherwise a timing-out crawl would write content-less
  // shells for every route and still report success, shipping a hollow "prerender". Routes with
  // a ready selector are the exception: their content lands after the title, so
  // hasReadyContent waits for it below (#584, #532).
  const rendered = await page
    .waitForFunction((shell) => document.title && document.title !== shell, SHELL_TITLE, {
      timeout: 15000,
    })
    .then(() => true)
    .catch(() => false);
  const contentReady = await hasReadyContent(page, selector);
  if (!rendered) return 'title never left the shell (empty render)';
  if (!contentReady) return `content never rendered (${selector})`;
  return undefined;
}

/**
 * Capture `route` on a phone (#915), on a fresh page in its worker's phone `context`. Returns
 * `{capture}` from readPhoneCapture, or `{error}`.
 */
async function capturePhone(context, route, selector) {
  let page;
  try {
    page = await context.newPage();
    const problem = await loadRoute(page, route, selector);
    if (problem) return {error: `phone: ${problem}`};
    await page.evaluate(markPrerenderedRoot, route);
    return {capture: await page.evaluate(readPhoneCapture)};
  } catch (e) {
    return {error: `phone: ${errorMessage(e)}`};
  } finally {
    if (page) await page.close();
  }
}

/**
 * Merge `capture`, a route's phone capture, into the desktop capture open in `page`, and return
 * the page's HTML (#915). If the merge fails, even part way, the page ships as it was before the
 * merge, without a phone capture, and `error` says why. Exported for scripts/prerender.test.mjs,
 * which runs it on a jsdom document.
 */
export async function htmlWithPhone(page, capture) {
  const desktopOnly = await page.content();
  try {
    await page.evaluate(mergePhoneCapture, {...capture, media: CAPTURE_MEDIA});
    await page.evaluate(deferDesktopOnlyImages, CAPTURE_MEDIA.desktop);
    return {html: await page.content()};
  } catch (e) {
    return {html: desktopOnly, error: `phone: ${errorMessage(e)}`};
  }
}

/**
 * The HTML of the desktop capture open in `page`, with `route`'s phone capture added unless the
 * crawl skips phones (`phone` undefined). When the phone capture or its merge fails, the page
 * ships without one, so a phone shows its desktop capture, as before #915, and `error` says why.
 */
async function captureHtml(page, phone, route, selector) {
  if (!phone) return {html: await page.content()};
  const {capture, error} = await capturePhone(phone, route, selector);
  return capture ? htmlWithPhone(page, capture) : {html: await page.content(), error};
}

/**
 * One attempt at `route` on a fresh page in its worker's desktop context: mark it, add its phone
 * capture, capture it, clean it, write it, report on it. A desktop page that isn't ready is
 * still written, as it always was, but skips the phone, since the attempt has failed anyway.
 */
async function crawlRouteOnce({desktop, phone}, route, selector) {
  let page;
  try {
    page = await desktop.newPage();
    const problem = await loadRoute(page, route, selector);
    await page.evaluate(markPrerenderedRoot, route);
    const captured = await captureHtml(page, problem ? undefined : phone, route, selector);
    const html = cleanPrerenderedHtml(captured.html, SHELL_TITLE, `http://localhost:${PORT}`);
    const outDir = route === '/' ? DIST : join(DIST, route);
    await mkdir(outDir, {recursive: true});
    await writeFile(join(outDir, 'index.html'), html, 'utf8');
    const error = problem ?? captured.error;
    return error ? {route, ok: false, error} : {route, ok: true};
  } catch (e) {
    return {route, ok: false, error: errorMessage(e)};
  } finally {
    if (page) await page.close();
  }
}

/**
 * Preflight, run before anything is announced or a browser is launched: return the build
 * shell, or exit with an actionable message.
 *
 * Caching the shell here is what keeps the crawl correct — the home route writes its
 * capture to DIST itself, so crawling `/` replaces this very file mid-run. Re-reading it
 * per request would serve later routes a rendered homepage.
 *
 * The second check covers the same corruption across processes (#542): a re-run without an
 * intervening `pnpm build:web` reads an index.html a PREVIOUS invocation already
 * overwrote. That has to be fatal rather than best-effort, because every downstream
 * symptom is silent — and worst, it disarms crawlRouteOnce's own detector, which treats a
 * route as rendered once `document.title !== SHELL_TITLE`. A crawled shell's title already
 * differs, so the "title never left the shell" guard cannot fire and the run reports
 * success while writing wrong HTML.
 */
async function loadBuildShell() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[prerender] apps/web/dist not found — run `pnpm build:web` first');
    process.exit(1);
  }
  const shellHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  if (!isCleanShell(shellHtml, SHELL_TITLE)) {
    console.error(
      '[prerender] dist/index.html has already been crawled — the home route overwrites it.\n' +
        '            Run `pnpm build:web` to restore a clean shell before re-running.',
    );
    process.exit(1);
  }
  return shellHtml;
}

/**
 * One crawl worker's browser contexts: a desktop one, and a phone one (PHONE) unless the crawl
 * skips phones (PRERENDER_PHONE=0).
 */
async function openContexts(browser, phones) {
  const desktop = await browser.newContext({serviceWorkers: 'block'});
  const phone = phones ? await browser.newContext({serviceWorkers: 'block', ...PHONE}) : undefined;
  return {desktop, phone};
}

/**
 * Which routes this invocation crawls.
 *
 * `PRERENDER_URL` takes a single route and `PRERENDER_SAMPLE` takes a thin slice — both
 * exist so a reproduction does not need the full 1,060-route crawl, and both are the
 * workflow #542's guard protects.
 */
function selectRoutes({staticRoutes, playstyleRoutes, cardRoutes}, only, sample) {
  if (only) return [only];
  if (sample) return [...staticRoutes, ...playstyleRoutes.slice(0, 3), ...cardRoutes.slice(0, 5)];
  return [...staticRoutes, ...playstyleRoutes, ...cardRoutes];
}

async function main() {
  if (process.env.SKIP_PRERENDER === '1') {
    console.log('[prerender] skipped (SKIP_PRERENDER=1): shipping SPA-only');
    return;
  }
  const shellHtml = await loadBuildShell();
  const only = process.env.PRERENDER_URL;
  const sample = Number(process.env.PRERENDER_SAMPLE || 0);
  const phones = process.env.PRERENDER_PHONE !== '0';
  const routes = selectRoutes(await enumerateRoutes(), only, sample);

  console.log(
    `[prerender] ${routes.length} routes @ concurrency ${CONCURRENCY}${sample ? ' (SAMPLE)' : ''}, ` +
      `each captured on ${phones ? 'desktop and a 390x844 phone' : 'desktop only (PRERENDER_PHONE=0)'}`,
  );
  const started = Date.now();
  const server = await startServer(shellHtml);
  const browser = await chromium.launch();

  let idx = 0;
  let done = 0;
  let failed = 0;
  // Each worker crawls in browser contexts of its own (#867), whose HTTP cache serves its
  // later pages what its first one fetched (fileHeaders). Service workers are blocked: the app
  // registers one in every production build, so a fresh context per route installed it on
  // every page, fetching all of its precache again each time. Sharing a context leaves the
  // captures unchanged: the app writes storage only when a visitor acts, so no route leaves
  // state behind for the next.
  const worker = async () => {
    const contexts = await openContexts(browser, phones);
    const crawlOnce = (route, selector) => crawlRouteOnce(contexts, route, selector);
    while (idx < routes.length) {
      const route = routes[idx++];
      const r = await crawlRoute(route, crawlOnce);
      done++;
      if (!r.ok) {
        failed++;
        console.warn(`[prerender] FAIL ${route}: ${r.error}`);
      }
      if (done % 100 === 0) console.log(`[prerender] ${done}/${routes.length} (${failed} failed)`);
    }
    await Promise.all(Object.values(contexts).map((context) => context?.close()));
  };
  await Promise.all(Array.from({length: CONCURRENCY}, worker));

  await browser.close();
  server.close();
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`[prerender] done in ${seconds} s: ${done - failed} written, ${failed} failed`);
  // Guard the build: a broad failure means the crawl is capturing empty shells, not content.
  if (failed > Math.ceil(routes.length * 0.02)) {
    console.error('[prerender] failure rate too high — aborting');
    process.exit(1);
  }
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
