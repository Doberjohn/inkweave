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
 * smoke check.
 */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, dirname, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

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
      '/about',
      '/privacy',
      '/terms',
      '/disclaimer',
    ],
    playstyleRoutes: getAllPlaystyles().map((p) => `/playstyles/${p.id}`),
    cardRoutes: cardData.cards.map((c) => cardPath(c)),
  };
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
          res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
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
 * Exported for scripts/prerender.test.mjs. The origin rewrite MUST remove every
 * occurrence — a single-replace regression would leave 6-13 per page and be invisible
 * in a spot check of the built output.
 */
export function cleanPrerenderedHtml(html, shellTitle, origin) {
  return html.replace(`<title>${shellTitle}</title>`, '').replaceAll(origin, '');
}

async function crawlRoute(browser, route) {
  let page;
  try {
    page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}${route}`, {waitUntil: 'networkidle', timeout: 30000});
    // A route is "rendered" once its <Seo> has replaced the shell <title>, i.e. the real content
    // (not the loading skeleton) is on the page. If that never happens within the timeout, the
    // capture is just the empty shell — return ok:false so the failure-rate guard in main() can
    // catch a broken crawl. Otherwise a timing-out crawl would write content-less shells for
    // every route and still report success, shipping a hollow "prerender".
    const rendered = await page
      .waitForFunction((shell) => document.title && document.title !== shell, SHELL_TITLE, {
        timeout: 15000,
      })
      .then(() => true)
      .catch(() => false);
    const html = cleanPrerenderedHtml(
      await page.content(),
      SHELL_TITLE,
      `http://localhost:${PORT}`,
    );
    const outDir = route === '/' ? DIST : join(DIST, route);
    await mkdir(outDir, {recursive: true});
    await writeFile(join(outDir, 'index.html'), html, 'utf8');
    if (!rendered) return {route, ok: false, error: 'title never left the shell (empty render)'};
    return {route, ok: true};
  } catch (e) {
    return {route, ok: false, error: e && e.message ? e.message : String(e)};
  } finally {
    if (page) await page.close();
  }
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[prerender] apps/web/dist not found — run `pnpm build:web` first');
    process.exit(1);
  }
  const {staticRoutes, playstyleRoutes, cardRoutes} = await enumerateRoutes();
  const only = process.env.PRERENDER_URL;
  const sample = Number(process.env.PRERENDER_SAMPLE || 0);
  const routes = only
    ? [only]
    : sample
      ? [...staticRoutes, ...playstyleRoutes.slice(0, 3), ...cardRoutes.slice(0, 5)]
      : [...staticRoutes, ...playstyleRoutes, ...cardRoutes];

  console.log(
    `[prerender] ${routes.length} routes @ concurrency ${CONCURRENCY}${sample ? ' (SAMPLE)' : ''}`,
  );
  // Cache the clean shell BEFORE any crawl overwrites dist/index.html (the home route).
  const shellHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  const server = await startServer(shellHtml);
  const browser = await chromium.launch();

  let idx = 0;
  let done = 0;
  let failed = 0;
  const worker = async () => {
    while (idx < routes.length) {
      const route = routes[idx++];
      const r = await crawlRoute(browser, route);
      done++;
      if (!r.ok) {
        failed++;
        console.warn(`[prerender] FAIL ${route}: ${r.error}`);
      }
      if (done % 100 === 0) console.log(`[prerender] ${done}/${routes.length} (${failed} failed)`);
    }
  };
  await Promise.all(Array.from({length: CONCURRENCY}, worker));

  await browser.close();
  server.close();
  console.log(`[prerender] done: ${done - failed} written, ${failed} failed`);
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
