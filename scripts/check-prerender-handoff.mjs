#!/usr/bin/env node
/**
 * The handoff from a prerendered page to the app, checked in Chromium on a crawled build (#915).
 * A check script rather than a *.test.mjs, so `pnpm test:scripts` needs no build: CI's
 * perf-gates.yml builds, crawls a sample and runs it when the crawl, index.html, main.tsx, the
 * Vite config, vercel.json or this check change.
 *
 * The build is served as vercel.json serves it (serve-dist.mjs), each page in two parts: the
 * second, from the inline script after #root on, comes STALL_MS later, as on a slow network.
 * The browser paints what it has parsed by then, so a captured page that index.html's style
 * failed to hide would paint during the pause.
 *
 * Checks, each at 1440x900 and on a 390x844 phone:
 *   0. The control: with index.html's hiding style taken out of the page, a route without a
 *      capture of its own does paint the home page's, so the pause still lets the browser paint
 *      a captured page and the checks below can see one that shows.
 *   1. A route without a capture of its own (a compare link, an in-depth vote link, /account,
 *      /auth/callback, a card page by its id alone, an unknown page) is served the home page's
 *      capture and never paints it: with the app's code held nothing paints at all, and with
 *      it no frame shows a captured node before the app's own page.
 *   2. A route with its own capture paints it once the inline script approves it, and never
 *      before (the app's code held).
 *   3. Browse's capture shows the sort option the app shows.
 *   4. With the inline script gone from the page (a script that failed), the app still renders
 *      and shows.
 *   5. Without JavaScript, a captured page shows as captured (index.html's <noscript> rule).
 *
 * Usage: `pnpm build:web`, `PRERENDER_SAMPLE=1 node scripts/prerender.mjs`, then
 *        `pnpm check:prerender-handoff [--dir apps/web/dist]`
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {readPrerenderRoute} from './check-rendered-html.mjs';
import {createDistServer} from './serve-dist.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Playwright is apps/web's, as for prerender.mjs: a root script can't see it otherwise.
const require = createRequire(resolve(ROOT, 'apps', 'web', 'package.json'));
const {chromium} = require('@playwright/test');

const DEVICES = {
  desktop: {viewport: {width: 1440, height: 900}},
  phone: {
    viewport: {width: 390, height: 844},
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};
/** How long a page's second part waits, as a slow network would make it. */
const STALL_MS = 400;
/** Frames to watch once a page has loaded with the app's code held, for a late paint. */
const SETTLE_FRAMES = 20;
/** How long the app's own page may take to show. */
const APP_TIMEOUT_MS = 15000;
/** Pages checked at once, each in a browser context of its own. */
const CONCURRENCY = 4;
/** index.html's inline script, which the fourth check takes out of the page. */
const INLINE_SCRIPT = /<script>\s*\(function \(\) \{[\s\S]*?data-prerender-route[\s\S]*?<\/script>/;
/** index.html's style that hides a marked #root until it is approved, as the build writes it. */
const HIDING_STYLE =
  /<style>\s*#root\[data-prerender-route\]:not\(\[data-ready\]\)\s*\{[^}]*\}\s*<\/style>/;
/** A query that takes HIDING_STYLE out of the page (the control check). */
const UNHIDDEN_QUERY = 'unhidden';
/**
 * A query that puts a node setting its own `visibility: visible` into a page's capture, which
 * a hidden #root's visibility alone would let paint (RevealHero's countdown sets one).
 */
const VISIBLE_NODE_QUERY = 'visible-node';
const VISIBLE_NODE = '<p style="visibility: visible">A captured node that shows itself</p>';

/**
 * Where a page's first part ends: at the inline script after #root, so all of #root has arrived
 * and the script that approves or empties it has not. A page without one arrives whole.
 */
function stallPoint(html) {
  const root = html.indexOf('<div id="root"');
  const script = root === -1 ? -1 : html.indexOf('<script>', root);
  return script === -1 ? html.length : script;
}

/**
 * A page as served: with VISIBLE_NODE first in its #root when `url` asks for it, and without
 * HIDING_STYLE when `url` asks for that.
 */
function pageFor(html, url) {
  const query = new URL(url, 'http://localhost').searchParams;
  let page = html;
  if (query.has(VISIBLE_NODE_QUERY)) {
    page = page.replace(/<div id="root"[^>]*>/, (root) => root + VISIBLE_NODE);
  }
  return query.has(UNHIDDEN_QUERY) ? page.replace(HIDING_STYLE, '') : page;
}

/** Sends a page in two parts, the second STALL_MS after the first (see stallPoint). */
function sendInTwoParts(res, body, url) {
  const html = pageFor(body.toString('utf8'), url);
  const cut = stallPoint(html);
  res.write(html.slice(0, cut));
  setTimeout(() => res.end(html.slice(cut)), STALL_MS);
}

/** Serves `dist` through serve-dist.mjs, each page in two parts. */
function startServer(dist) {
  const server = createDistServer(dist, {sendPage: sendInTwoParts});
  return new Promise((done) => server.listen(0, () => done(server)));
}

/**
 * Runs in each page before any of its own scripts: samples #root at every frame, into
 * `window.__handoff.frames`. A captured node is one React didn't make, since React keys every
 * node it creates with `__reactFiber$…` and the parser's nodes carry no such key.
 */
function sampleFrames() {
  const frames = [];
  window.__handoff = {frames};
  const fromReact = (node) => Object.keys(node).some((key) => key.startsWith('__reactFiber$'));
  const sample = () => {
    const root = document.getElementById('root');
    if (root) {
      const style = getComputedStyle(root);
      const children = [...root.children];
      frames.push({
        shown: style.visibility === 'visible' && style.opacity === '1',
        approved: root.hasAttribute('data-ready'),
        captured: children.some((node) => !fromReact(node)),
        app: children.some(fromReact),
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/** What a page shows once it has settled: its frames, whether anything painted, and #root. */
function readPage() {
  const root = document.getElementById('root');
  return {
    frames: window.__handoff.frames,
    painted: performance.getEntriesByName('first-contentful-paint').length > 0,
    marked: root.hasAttribute('data-prerender-route'),
    sortValues: [...root.querySelectorAll('select')].map((select) => select.value),
  };
}

/** Wait `count` frames in the page. */
function waitFrames(count) {
  return new Promise((done) => {
    let left = count;
    const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

/** In the page: has a frame shown the app's own page? */
const showsApp = () => window.__handoff.frames.some((frame) => frame.app && frame.shown);

/** Wait for a frame that shows the app's own page, or fail with the last frame seen. */
async function waitForApp(page) {
  try {
    await page.waitForFunction(showsApp, null, {timeout: APP_TIMEOUT_MS});
  } catch {
    const last = await page.evaluate(() => window.__handoff.frames.at(-1));
    throw new Error(
      `the app's page never showed within ${APP_TIMEOUT_MS / 1000} s, its last frame ${JSON.stringify(last)}`,
    );
  }
}

/** Takes index.html's inline script out of the page a route answers with (check 4). */
async function withoutInlineScript(route) {
  const response = await route.fetch();
  await route.fulfill({response, body: (await response.text()).replace(INLINE_SCRIPT, '')});
}

/**
 * Open `path` on `device` in a fresh context and return what it served and showed. `app` false
 * holds the app's code, so only the captured page and index.html's own script act; true waits
 * for the app's own page to show, and then for `waitFor` in it, if given.
 */
async function visit(browser, base, {device, path, app, strip = false, waitFor}) {
  const context = await browser.newContext({...DEVICES[device], serviceWorkers: 'block'});
  try {
    const page = await context.newPage();
    await page.addInitScript(sampleFrames);
    if (!app) await page.route('**/assets/*.js', (route) => route.abort());
    if (strip) await page.route(`${base}${path}`, withoutInlineScript);
    const response = await page.goto(`${base}${path}`, {waitUntil: 'load'});
    const servedRoute = readPrerenderRoute(await response.text());
    if (app) {
      await waitForApp(page);
      if (waitFor)
        await page.waitForSelector(waitFor, {state: 'attached', timeout: APP_TIMEOUT_MS});
    } else {
      await page.evaluate(waitFrames, SETTLE_FRAMES);
    }
    return {servedRoute, ...(await page.evaluate(readPage))};
  } finally {
    await context.close();
  }
}

/** The route `path` names, as index.html's inline script reads it. */
const routeOf = (path) => decodeURIComponent(path.split('?')[0]).replace(/\/+$/, '') || '/';

/** Check 1, the app's code held: the home page's capture, served here, never paints. */
function neverPaintsHome(seen) {
  if (seen.servedRoute !== '/')
    return `served a capture marked "${seen.servedRoute}", not the home page's`;
  if (seen.painted)
    return 'painted content (first-contentful-paint), with only the capture to paint';
  if (seen.frames.some((frame) => frame.captured && frame.shown))
    return 'a frame showed the captured page';
  if (seen.marked) return '#root kept its mark';
  return null;
}

/** Check 1, the app's code running: no frame shows the capture, and the app's own page shows. */
function appTakesOver(seen) {
  const shownCapture = seen.frames.findIndex((frame) => frame.captured && frame.shown);
  return shownCapture === -1
    ? null
    : `frame ${shownCapture} showed the captured page before the app's`;
}

/** A frame that shows #root before index.html's inline script approved it. */
const showsUnapproved = (frame) => frame.shown && !frame.approved;

/** A frame that shows the captured page, approved. */
const showsApprovedCapture = (frame) => Boolean(frame?.approved && frame.shown && frame.captured);

/** Check 2: the route's own capture paints, and only once the inline script approved it. */
function paintsOwnCapture(path) {
  return (seen) => {
    if (seen.servedRoute !== routeOf(path)) return `served a capture marked "${seen.servedRoute}"`;
    const last = seen.frames.at(-1);
    if (!last?.captured) return 'emptied its own capture, as if on another route';
    if (seen.frames.some(showsUnapproved)) return 'showed the capture before approving it';
    if (!showsApprovedCapture(last)) return `ended ${JSON.stringify(last)}, not approved and shown`;
    return seen.painted ? null : 'never painted';
  };
}

/** Check 4: with the inline script gone, the app still renders and shows, its mark removed. */
function appShowsWithoutScript(seen) {
  return seen.marked ? '#root kept its mark, which hides the app' : null;
}

/** Check 5: without JavaScript, the captured page shows. */
async function showsWithoutJavaScript(browser, base, {device, path}) {
  const context = await browser.newContext({...DEVICES[device], javaScriptEnabled: false});
  try {
    const page = await context.newPage();
    await page.goto(`${base}${path}`, {waitUntil: 'load'});
    const style = await page.locator('#root').evaluate((root) => {
      const {visibility, opacity} = getComputedStyle(root);
      return {visibility, opacity, children: root.children.length};
    });
    const shown = style.visibility === 'visible' && style.opacity === '1' && style.children > 0;
    return shown ? null : `#root is ${JSON.stringify(style)}`;
  } finally {
    await context.close();
  }
}

/** The routes the checks visit, read from the crawl: its first card page and playstyle. */
function routesOf(dist) {
  const [cardId] = readdirSync(join(dist, 'card')).sort();
  const [slug] = readdirSync(join(dist, 'card', cardId));
  const [playstyle] = readdirSync(join(dist, 'playstyles')).filter((name) => name !== 'index.html');
  const {groups} = JSON.parse(
    readFileSync(join(dist, 'data', 'synergies', `${cardId}.json`), 'utf8'),
  );
  const partner = groups[0].synergies[0].cardId;
  return {
    withoutCapture: [
      `/compare/${cardId}/${partner}`,
      `/compare/${cardId}/${partner}/${groups[0].groupKey}`,
      `/vote/${cardId}/${partner}`,
      '/account',
      '/auth/callback',
      `/card/${cardId}`,
      '/no-such-page',
    ],
    // '/browse/' and '/%62rowse' are /browse too: the inline script drops the slash and decodes.
    withCapture: [
      '/',
      '/browse',
      '/browse/',
      '/%62rowse',
      '/playstyles',
      `/playstyles/${playstyle}`,
      `/card/${cardId}/${slug}`,
      '/about',
    ],
  };
}

/**
 * Check 0 on `device`: without index.html's hiding style, the home page's capture paints on a
 * route without its own, as it did before #915, so the pause still gives the browser a frame.
 */
function controlCheck(device, path) {
  return {
    name: `0. ${path} (${device}, app held) paints the home page once the hiding style is gone`,
    run: async (browser, base) => {
      const unhidden = {device, path: `${path}?${UNHIDDEN_QUERY}`, app: false};
      if ((await visit(browser, base, unhidden)).painted) return null;
      return 'nothing painted: the pause no longer lets a captured page paint, so check 1 would pass one that shows';
    },
  };
}

/** Check 1 on `device`: each route without a capture, with the app's code held and running. */
function withoutCaptureChecks(device, routes) {
  const held = [...routes, `${routes[0]}?${VISIBLE_NODE_QUERY}`].map((path) => ({
    name: `1. ${path} (${device}, app held) never paints the home page`,
    run: async (browser, base) =>
      neverPaintsHome(await visit(browser, base, {device, path, app: false})),
  }));
  const running = routes.map((path) => ({
    name: `1. ${path} (${device}) shows the app's page, never the home page's capture`,
    run: async (browser, base) =>
      appTakesOver(await visit(browser, base, {device, path, app: true})),
  }));
  return [...held, ...running];
}

/** Check 2 on `device`: each route with its own capture, the app's code held. */
function withCaptureChecks(device, routes) {
  return routes.map((path) => ({
    name: `2. ${path} (${device}, app held) paints its own capture once approved`,
    run: async (browser, base) =>
      paintsOwnCapture(path)(await visit(browser, base, {device, path, app: false})),
  }));
}

/** Check 3 on `device`: Browse's captured sort option against the one the app shows. */
function sortOptionCheck(device) {
  return {
    name: `3. /browse (${device}) captures the sort option the app shows`,
    run: async (browser, base) => {
      const captured = (await visit(browser, base, {device, path: '/browse', app: false}))
        .sortValues;
      const browse = {device, path: '/browse', app: true, waitFor: '#root select'};
      const shown = (await visit(browser, base, browse)).sortValues;
      const same = captured.length > 0 && JSON.stringify(captured) === JSON.stringify(shown);
      return same
        ? null
        : `captured ${JSON.stringify(captured)}, the app shows ${JSON.stringify(shown)}`;
    },
  };
}

/** Checks 4 and 5 on `device`: a page whose inline script failed, and a browser without JavaScript. */
function fallbackChecks(device, routes) {
  const stripped = routes.map((path) => ({
    name: `4. ${path} (${device}) without the inline script still shows the app`,
    run: async (browser, base) =>
      appShowsWithoutScript(await visit(browser, base, {device, path, app: true, strip: true})),
  }));
  const noScript = {
    name: `5. /browse (${device}) without JavaScript shows its capture`,
    run: (browser, base) => showsWithoutJavaScript(browser, base, {device, path: '/browse'}),
  };
  return [...stripped, noScript];
}

/** Every check to run, as {name, run(browser, base) => failure or null}. */
function planChecks(dist) {
  const {withoutCapture, withCapture} = routesOf(dist);
  return Object.keys(DEVICES).flatMap((device) => [
    controlCheck(device, withoutCapture[0]),
    ...withoutCaptureChecks(device, withoutCapture),
    ...withCaptureChecks(device, withCapture),
    sortOptionCheck(device),
    ...fallbackChecks(device, ['/browse', withoutCapture[0]]),
  ]);
}

/** Run `checks` CONCURRENCY at a time; a check that throws fails with its error. */
async function runChecks(checks, browser, base) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < checks.length) {
      const check = checks[next++];
      const failure = await check.run(browser, base).catch((error) => error.message.split('\n')[0]);
      results.push({name: check.name, failure});
    }
  };
  await Promise.all(Array.from({length: CONCURRENCY}, worker));
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

const HOW_TO_BUILD = 'pnpm build:web, then PRERENDER_SAMPLE=1 node scripts/prerender.mjs';

/** Why the build whose home page is `home` can't be checked, or null when it can. */
function buildProblem(home) {
  if (!existsSync(home)) return `${home} not found: build and crawl first (${HOW_TO_BUILD})`;
  const html = readFileSync(home, 'utf8');
  if (readPrerenderRoute(html) === undefined) {
    return `${home} carries no route mark: crawl the build first (${HOW_TO_BUILD}), or the crawl stopped marking its pages (#915)`;
  }
  return HIDING_STYLE.test(html) ? null : `${home} lacks index.html's hiding style (#915)`;
}

async function main() {
  const {values} = parseArgs({options: {dir: {type: 'string', default: 'apps/web/dist'}}});
  const dist = resolve(ROOT, values.dir);
  const problem = buildProblem(join(dist, 'index.html'));
  if (problem) {
    console.error(`✖ ${problem}`);
    process.exit(1);
  }
  const server = await startServer(dist);
  const browser = await chromium.launch();
  const results = await runChecks(
    planChecks(dist),
    browser,
    `http://localhost:${server.address().port}`,
  );
  await browser.close();
  server.close();

  for (const {name, failure} of results)
    console.log(failure ? `✖ ${name}: ${failure}` : `✓ ${name}`);
  const failed = results.filter((result) => result.failure).length;
  console.log(`\n${results.length - failed} of ${results.length} handoff checks passed.`);
  if (failed > 0) process.exit(1);
}

// Run only when invoked directly (never when imported).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('✖ Handoff check crashed:', error);
    process.exit(1);
  });
}
