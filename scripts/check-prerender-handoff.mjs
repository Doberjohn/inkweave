#!/usr/bin/env node
/**
 * The handoff from a prerendered page to the app, checked in Chromium on a crawled build (#915).
 * A check script rather than a *.test.mjs, so `pnpm test:scripts` needs no build: CI's
 * perf-gates.yml builds, crawls a sample and runs it when the crawl, index.html, main.tsx, the
 * Vite config, vercel.json, this check or the dependencies change.
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
 *      it no frame shows a captured node before the app's own page. The same holds for
 *      /browse%2F, served Browse's capture here while React Router shows the not-found page.
 *   2. A route with its own capture paints it once the inline script approves it, and never
 *      before (the app's code held).
 *   3. Browse's capture shows the sort option the app shows.
 *   4. With the inline script gone from the page (a script that failed), the app still renders
 *      and shows.
 *   5. Without JavaScript, a captured page shows as captured (index.html's <noscript> rule): on a
 *      phone too, as its desktop capture.
 *   6. A route with its own capture shows the capture for the screen (the app's code held): on a
 *      phone the phone capture, swapped in before any frame shows #root, with nothing wider than
 *      the screen; on a desktop the desktop capture as captured. At the app's breakpoint, 767 px
 *      wide gets the phone capture and 768 px the desktop one.
 *   7. A route with its own capture fetches every image the capture it shows loads at once, and
 *      no image only the other capture shows (the app's code held). A phone's preload scanner
 *      reads the desktop capture before the inline script swaps the phone one in.
 *
 * Usage: `pnpm build:web`, `PRERENDER_SAMPLE=1 node scripts/prerender.mjs`, then
 *        `pnpm check:prerender-handoff [--dir apps/web/dist]`
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {readCaptures, readImages, readPrerenderRoute} from './check-rendered-html.mjs';
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
/** How long a page with the app's code held may take to report its first contentful paint. */
const PAINT_TIMEOUT_MS = 5000;
/** Pages checked at once, each in a browser context of its own. */
const CONCURRENCY = 4;
/** index.html's inline script, which the fourth check takes out of the page. */
const INLINE_SCRIPT = /<script>\s*\(function \(\) \{[\s\S]*?data-prerender-route[\s\S]*?<\/script>/;
/**
 * index.html's style that hides a marked #root until it is approved, as the build writes it: its
 * phone rule too, which doesn't lay the root out at all.
 */
const HIDING_STYLE =
  /<style>\s*#root\[data-prerender-route\]:not\(\[data-ready\]\)\s*\{[\s\S]*?<\/style>/;
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
        shown: style.display !== 'none' && style.visibility === 'visible' && style.opacity === '1',
        approved: root.hasAttribute('data-ready'),
        captured: children.some((node) => !fromReact(node)),
        app: children.some(fromReact),
        layout: root.getAttribute('data-layout'),
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/**
 * What a page shows once it has settled: its frames, whether anything painted, #root, whether
 * the phone capture's template is still in the page, and how wide the page is.
 */
function readPage() {
  const root = document.getElementById('root');
  const preloads = document.querySelectorAll('link[rel~="preload"][as="image"]');
  return {
    frames: window.__handoff.frames,
    painted: performance.getEntriesByName('first-contentful-paint').length > 0,
    marked: root.hasAttribute('data-prerender-route'),
    sortValues: [...root.querySelectorAll('select')].map((select) => select.value),
    markup: root.innerHTML,
    phoneTemplate: document.getElementById('prerender-phone') !== null,
    pageWidth: document.documentElement.scrollWidth,
    // Not innerWidth: a phone browser widens its layout viewport to fit a page wider than the
    // screen, so innerWidth grows with the page, while the root keeps the screen's width.
    screenWidth: document.documentElement.clientWidth,
    // The image preloads that apply to this screen, by their media.
    preloads: [...preloads]
      .filter((link) => !link.media || window.matchMedia(link.media).matches)
      .map((link) => new URL(link.href).pathname),
    // The images #root's styles draw, such as the ink placeholder's symbol on a card tile whose
    // art hadn't loaded when the page was captured: they belong to the capture it shows.
    backgrounds: [...root.querySelectorAll('*')].flatMap((element) =>
      [null, '::before', '::after'].flatMap((pseudo) =>
        [...getComputedStyle(element, pseudo).backgroundImage.matchAll(/url\("([^"]+)"\)/g)].map(
          (match) => new URL(match[1]).pathname,
        ),
      ),
    ),
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

/**
 * Wait for the page to report its first contentful paint, which a page can do well after it
 * shows its capture: Playstyles 300 to 600 ms after, past SETTLE_FRAMES' 330 ms or so. A page
 * that never paints is its check's to report, so the wait gives up quietly.
 */
async function waitForPaint(page) {
  const painted = () => performance.getEntriesByName('first-contentful-paint').length > 0;
  await page.waitForFunction(painted, null, {timeout: PAINT_TIMEOUT_MS}).catch(() => {});
}

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
 * Wait, once a page has loaded, for what its check reads: with the app's code held,
 * SETTLE_FRAMES for a late paint and then, when `paints`, the page's first contentful paint;
 * with it running, the app's own page and then `waitFor` in it, if given.
 */
async function settle(page, {app, waitFor, paints}) {
  if (!app) {
    await page.evaluate(waitFrames, SETTLE_FRAMES);
    if (paints) await waitForPaint(page);
    return;
  }
  await waitForApp(page);
  if (waitFor) await page.waitForSelector(waitFor, {state: 'attached', timeout: APP_TIMEOUT_MS});
}

/**
 * Open `path` on `device` in a fresh context (at `viewport`, if given) and return what it
 * served, fetched and showed. `app` false holds the app's code, so only the captured page and
 * index.html's own script act, and `paints` then waits for its first contentful paint too (for
 * a check that expects one); true waits for the app's own page to show, and then for `waitFor`
 * in it, if given.
 */
async function visit(
  browser,
  base,
  {device, viewport, path, app, strip = false, waitFor, paints = false},
) {
  const screen = viewport ? {...DEVICES[device], viewport} : DEVICES[device];
  const context = await browser.newContext({...screen, serviceWorkers: 'block'});
  try {
    const page = await context.newPage();
    const images = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'image') images.push(new URL(request.url()).pathname);
    });
    await page.addInitScript(sampleFrames);
    if (!app) await page.route('**/assets/*.js', (route) => route.abort());
    if (strip) await page.route(`${base}${path}`, withoutInlineScript);
    const response = await page.goto(`${base}${path}`, {waitUntil: 'load'});
    const served = await response.text();
    await settle(page, {app, waitFor, paints});
    const seen = await page.evaluate(readPage);
    return {served, servedRoute: readPrerenderRoute(served), images, ...seen};
  } finally {
    await context.close();
  }
}

/**
 * The route `path` names, as index.html's inline script reads it: decoded a segment at a time,
 * an encoded slash kept inside its segment, and trailing slashes dropped.
 */
function routeOf(path) {
  const segments = path.split('?')[0].split('/');
  const decoded = segments.map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'));
  return decoded.join('/').replace(/\/+$/, '') || '/';
}

/** Check 1, the app's code held: the capture served here, another route's, never paints. */
function neverPaintsCapture(path) {
  return (seen) => {
    if (seen.servedRoute === undefined || seen.servedRoute === routeOf(path))
      return `served a capture marked "${seen.servedRoute}", not another route's`;
    if (seen.painted)
      return 'painted content (first-contentful-paint), with only the capture to paint';
    if (seen.frames.some((frame) => frame.captured && frame.shown))
      return 'a frame showed the captured page';
    if (seen.marked) return '#root kept its mark';
    return null;
  };
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
      const {display, visibility, opacity} = getComputedStyle(root);
      return {display, visibility, opacity, children: root.children.length};
    });
    const laidOut = style.display !== 'none' && style.children > 0;
    const shown = laidOut && style.visibility === 'visible' && style.opacity === '1';
    return shown ? null : `#root is ${JSON.stringify(style)}`;
  } finally {
    await context.close();
  }
}

/** The capture a page shows on `layout`'s screens, read from the page as served (#915). */
function captureFor(layout, served) {
  const captures = readCaptures(served);
  return layout === 'phone' ? captures?.phone : captures?.desktop;
}

/** Check 6: the capture for `layout`'s screens shows, swapped in before any frame shows #root. */
function showsCaptureFor(layout) {
  const mark = layout === 'phone' ? 'phone' : null;
  return (seen) => {
    const capture = captureFor(layout, seen.served);
    if (capture === undefined) return 'was served without a phone capture';
    const wrong = seen.frames.find((frame) => frame.shown && frame.layout !== mark);
    if (wrong) return `a frame showed #root laid out as ${JSON.stringify(wrong.layout)}`;
    if (seen.phoneTemplate) return "the phone capture's template is still in the page";
    if (seen.markup !== capture) return `#root doesn't show its ${layout} capture`;
    if (seen.pageWidth > seen.screenWidth) {
      return `the page is ${seen.pageWidth} px wide on a ${seen.screenWidth} px screen`;
    }
    return null;
  };
}

/**
 * Check 7: the page fetched each image the capture it shows loads at once, its preloads for
 * this screen included, and nothing that capture doesn't show, in its images or its styles.
 */
function fetchesImagesOf(layout) {
  return (seen) => {
    const images = readImages(captureFor(layout, seen.served) ?? '');
    const shows = new Set([...images.map(({src}) => src), ...seen.backgrounds]);
    const stray = [...new Set(seen.images)].filter((src) => !shows.has(src));
    if (stray.length > 0) return `fetched ${stray.join(', ')}, not in its ${layout} capture`;
    const loadsAtOnce = [...images.filter(({lazy}) => !lazy).map(({src}) => src), ...seen.preloads];
    const missed = [...new Set(loadsAtOnce)].filter((src) => !seen.images.includes(src));
    return missed.length > 0 ? `never fetched ${missed.join(', ')}` : null;
  };
}

/**
 * The routes the checks visit, read from the crawl: its first card page with a synergy file
 * (precompute writes none for a card without synergies, and the compare links need a partner)
 * and its first playstyle. Exported for scripts/check-prerender-handoff.test.mjs.
 */
export function routesOf(dist) {
  const synergyFile = (id) => join(dist, 'data', 'synergies', `${id}.json`);
  const cardId = readdirSync(join(dist, 'card'))
    .sort()
    .find((id) => existsSync(synergyFile(id)));
  if (!cardId) throw new Error(`no card page in ${dist} has a synergy file to link a compare page`);
  const [slug] = readdirSync(join(dist, 'card', cardId));
  const [playstyle] = readdirSync(join(dist, 'playstyles')).filter((name) => name !== 'index.html');
  const {groups} = JSON.parse(readFileSync(synergyFile(cardId), 'utf8'));
  const partner = groups[0].synergies[0].cardId;
  return {
    // '/browse%2F' is the not-found page to React Router, which keeps an encoded slash inside
    // its segment, while this server decodes it and serves Browse's capture.
    withoutCapture: [
      `/compare/${cardId}/${partner}`,
      `/compare/${cardId}/${partner}/${groups[0].groupKey}`,
      `/vote/${cardId}/${partner}`,
      '/account',
      '/auth/callback',
      `/card/${cardId}`,
      '/no-such-page',
      '/browse%2F',
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
    // Each page with a capture of its own once, for the phone capture's checks (#915).
    eachCapture: [
      '/',
      '/browse',
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
      const unhidden = {device, path: `${path}?${UNHIDDEN_QUERY}`, app: false, paints: true};
      if ((await visit(browser, base, unhidden)).painted) return null;
      return 'nothing painted: the pause no longer lets a captured page paint, so check 1 would pass one that shows';
    },
  };
}

/** Check 1 on `device`: each route without a capture, with the app's code held and running. */
function withoutCaptureChecks(device, routes) {
  const held = [...routes, `${routes[0]}?${VISIBLE_NODE_QUERY}`].map((path) => ({
    name: `1. ${path} (${device}, app held) never paints another route's capture`,
    run: async (browser, base) =>
      neverPaintsCapture(path)(await visit(browser, base, {device, path, app: false})),
  }));
  const running = routes.map((path) => ({
    name: `1. ${path} (${device}) shows the app's page, never another route's capture`,
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
      paintsOwnCapture(path)(await visit(browser, base, {device, path, app: false, paints: true})),
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

/** Checks 6 and 7 on `device`: each page's capture for its screen, and the images it fetches. */
function screenChecks(device, routes) {
  return routes.flatMap((path) => [
    {
      name: `6. ${path} (${device}, app held) shows its ${device} capture`,
      run: async (browser, base) =>
        showsCaptureFor(device)(await visit(browser, base, {device, path, app: false})),
    },
    {
      name: `7. ${path} (${device}, app held) fetches its ${device} capture's images, and only those`,
      run: async (browser, base) =>
        fetchesImagesOf(device)(await visit(browser, base, {device, path, app: false})),
    },
  ]);
}

/**
 * Check 6 at the app's breakpoint (useResponsive: a phone below 768 px), on a desktop browser:
 * 767 px wide gets the phone capture, 768 px the desktop one.
 */
function breakpointChecks(path) {
  return [
    [767, 'phone'],
    [768, 'desktop'],
  ].map(([width, layout]) => ({
    name: `6. ${path} (${width} px wide, app held) shows its ${layout} capture`,
    run: async (browser, base) => {
      const viewport = {width, height: 900};
      const seen = await visit(browser, base, {device: 'desktop', viewport, path, app: false});
      return showsCaptureFor(layout)(seen);
    },
  }));
}

/** Every check to run, as {name, run(browser, base) => failure or null}. */
function planChecks(dist) {
  const {withoutCapture, withCapture, eachCapture} = routesOf(dist);
  const perDevice = Object.keys(DEVICES).flatMap((device) => [
    controlCheck(device, withoutCapture[0]),
    ...withoutCaptureChecks(device, withoutCapture),
    ...withCaptureChecks(device, withCapture),
    sortOptionCheck(device),
    ...fallbackChecks(device, ['/browse', withoutCapture[0]]),
    ...screenChecks(device, eachCapture),
  ]);
  return [...perDevice, ...breakpointChecks('/browse')];
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
  if (!readCaptures(html)) {
    return `${home} carries no phone capture: crawl with phones (PRERENDER_PHONE unset), or the crawl stopped capturing them (#915)`;
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
