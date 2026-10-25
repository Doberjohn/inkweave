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
 *   3. Browse's capture shows its cards on each screen (#931), and the sort option the app shows.
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
 *   8. With the data a page waits for held back DATA_HOLD_MS (the home page's featured cards, the
 *      card list, a playstyle's card ids and their mechanic ids, the synergy file of the vote
 *      page's first pair), the page asks for all of its data before the app renders (a card page
 *      its synergy file too, a playstyle's page the card list and its other playstyle file, the
 *      vote page the card list and the pairs index) and for none it defers (the home page's card
 *      list, #641; the gallery's mechanic ids, #930), its capture stays on screen until the
 *      data arrives, then the app's page replaces it whole, within a frame of letting go: no frame
 *      shows a loading state (`[aria-busy="true"]`, the route's fallback included) or an empty
 *      #root, the app's first frame shows every image the capture showed on screen, at full
 *      opacity, and no later frame leaves out or fades its card art. Each page runs again with
 *      view transitions taken away, as in Firefox before 144 and Safari before 18, which the
 *      app's first render must pass alone: there the images go unchecked, since Chromium draws a
 *      new `<img>` blank for a frame without a transition to hold the page. The vote page's
 *      capture is its loading view, since the crawl draws no pair and each visit draws its own:
 *      there the capture must show that view, and no frame of the app's page a loading state.
 *   9. With the card list held past the hold's cap, Browse lets go at the cap, counted from the
 *      start of the visit, and the app shows its loading state.
 *  10. During the hold, a click or a key press shows the app's page at once, a click on one of
 *      the capture's links loads that link's page, and a scroll keeps the hold, and the app's page
 *      keeps the visitor's place.
 *  Checks 8 to 10 are left out when HOLD_CAP_MS is 0, which turns the hold off.
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
/** How long checks 8 holds back the data a page waits for (see the header). */
const DATA_HOLD_MS = 2000;
/** How soon after its data arrives a held page's app must show (check 8). */
const DATA_SLACK_MS = 1000;
/** How long checks 10 hold back the home page's featured cards, so the hold outlasts the press. */
const PRESS_HOLD_MS = 6000;
/** How soon after a press during the hold the app's page must show (check 10). */
const PRESS_SLACK_MS = 500;
/** How soon after the hold's cap the app's page must show (check 9). */
const CAP_SLACK_MS = 1500;
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
  window.__handoff = {frames, pressedAt: null};
  // Room for every request a page makes, so the held data's entry is there to read.
  performance.setResourceTimingBufferSize(1000);
  for (const type of ['click', 'keydown']) {
    window.addEventListener(type, () => (window.__handoff.pressedAt ??= performance.now()), {
      capture: true,
    });
  }
  const fromReact = (node) => Object.keys(node).some((key) => key.startsWith('__reactFiber$'));
  const loaded = (img) => img.complete && img.naturalWidth > 0;
  const onScreen = (img) => {
    const box = img.getBoundingClientRect();
    const across = box.right > 0 && box.left < window.innerWidth;
    return box.width > 0 && across && box.bottom > 0 && box.top < window.innerHeight;
  };
  const cardArt = (src) => new URL(src).pathname.startsWith('/card-images/');
  // The images the captured page showed on screen, as of its last frame. The app's first frame
  // must show all of them, at full opacity, and every later frame all of their card art:
  // anything less blinks. Other images may change later: the hero logo swaps to an animated copy.
  let shownImages = [];
  let appFrames = 0;
  // A frame of the captured page notes the images it shows on screen; a frame of the app's page
  // counts those it leaves out or shows faded.
  const unshownIn = (root, app) => {
    const images = [...root.querySelectorAll('img')];
    if (!app) {
      shownImages = images
        .filter((img) => loaded(img) && onScreen(img))
        .map((img) => img.currentSrc);
      return 0;
    }
    const due = appFrames++ > 0 ? shownImages.filter(cardArt) : shownImages;
    const showing = new Set(
      images
        .filter((img) => loaded(img) && getComputedStyle(img).opacity === '1')
        .map((img) => img.currentSrc),
    );
    return due.filter((src) => !showing.has(src)).length;
  };
  const sample = () => {
    const root = document.getElementById('root');
    if (root) {
      const style = getComputedStyle(root);
      const children = [...root.children];
      const busy = root.querySelector('[aria-busy="true"]');
      const app = children.some(fromReact);
      frames.push({
        // When the frame was sampled, not its rAF timestamp: input handled in the frame, before
        // its callbacks run, comes after that timestamp.
        time: performance.now(),
        shown: style.display !== 'none' && style.visibility === 'visible' && style.opacity === '1',
        approved: root.hasAttribute('data-ready'),
        // main.tsx takes the mark off as it lets go of a held page.
        marked: root.hasAttribute('data-prerender-route'),
        captured: children.some((node) => !fromReact(node)),
        app,
        layout: root.getAttribute('data-layout'),
        // The captured page's on-screen images that the app's page leaves out or shows faded.
        unshown: unshownIn(root, app),
        busy: busy && (busy.getAttribute('aria-label') ?? busy.tagName.toLowerCase()),
        empty: children.length === 0,
        scrollY: window.scrollY,
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/**
 * Runs in a page before any of its own scripts: takes view transitions away, as in a browser
 * without them (Firefox before 144, Safari before 18), so main.tsx renders the app straight over
 * the captured page.
 */
function withoutViewTransitions() {
  delete window.Document.prototype.startViewTransition;
}

/**
 * What a page shows once it has settled: its frames, whether anything painted, #root, whether
 * the phone capture's template is still in the page, and how wide the page is. For the hold
 * checks, also when the visitor first pressed, when the last of the held files (those whose
 * path `match` matches, from heldPattern) arrived, and when the page first asked for each file
 * `wants` and `avoids` name.
 */
function readPage({match, wants = [], avoids = []}) {
  const root = document.getElementById('root');
  const preloads = document.querySelectorAll('link[rel~="preload"][as="image"]');
  const resources = performance.getEntriesByType('resource');
  const requestsFor = (name) =>
    resources.filter((entry) => new URL(entry.name).pathname.endsWith(`/${name}`));
  const firstRequest = (name) => {
    const starts = requestsFor(name).map((entry) => entry.startTime);
    return {file: name, at: starts.length > 0 ? Math.min(...starts) : null};
  };
  const held = match
    ? resources.filter((entry) => new RegExp(match).test(new URL(entry.name).pathname))
    : [];
  return {
    frames: window.__handoff.frames,
    path: window.location.pathname,
    pressedAt: window.__handoff.pressedAt,
    heldArrivedAt: held.length > 0 ? Math.max(...held.map((entry) => entry.responseEnd)) : null,
    wanted: wants.map(firstRequest),
    avoided: avoids.map(firstRequest),
    transitions: 'startViewTransition' in document,
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

/** A route handler that answers 404, for a file the deploy lacks (check 8). */
async function answerMissing(route) {
  await route.fulfill({status: 404, body: 'Not found'}).catch(() => {});
}

/** A route handler that answers `ms` late, as a slow network would (checks 8 to 10). */
function holdBack(ms) {
  return async (route) => {
    await new Promise((done) => setTimeout(done, ms));
    // The check may have closed the page by then.
    await route.continue().catch(() => {});
  };
}

/**
 * Wait, once a page has loaded, for what its check reads: with the app's code held,
 * SETTLE_FRAMES for a late paint; with it running, the app's own page, then `waitFor` in it, if
 * given, and SETTLE_FRAMES more. `paints` then waits for the page's first contentful paint too,
 * which can come after `load` and those frames.
 */
async function settle(page, {app, waitFor, paints}) {
  if (app) {
    await waitForApp(page);
    if (waitFor) await page.waitForSelector(waitFor, {state: 'attached', timeout: APP_TIMEOUT_MS});
  }
  await page.evaluate(waitFrames, SETTLE_FRAMES);
  if (paints) await waitForPaint(page);
}

/**
 * Open `path` on `device` in a fresh context (at `viewport`, if given) and return what it
 * served, fetched and showed. `app` false holds the app's code, so only the captured page and
 * index.html's own script act; true waits for the app's own page to show, and then for
 * `waitFor` in it, if given. `paints` waits for its first contentful paint as well (for a check
 * that expects one). `hold` sends the file it names (`file`, or each its `match` names) `ms`
 * late, and with `arrive` watches the page until one has arrived, so a page that didn't wait for
 * it shows what it did meanwhile; its `wants` and `avoids` name files whose first request the
 * visit reports, and its `missing` a file answered 404 at once, as a deploy without it would.
 * `transitions` false takes view transitions away, as in a browser without them. `act` acts on
 * the page once it has loaded, as a visitor would.
 */
async function visit(browser, base, options) {
  const {device, viewport, path, app, waitFor, paints, hold, act} = options;
  const screen = viewport ? {...DEVICES[device], viewport} : DEVICES[device];
  const context = await browser.newContext({...screen, serviceWorkers: 'block'});
  try {
    const page = await context.newPage();
    const requests = recordRequests(page);
    await prepare(page, base, options);
    const arrived = arrival(page, hold);
    const response = await page.goto(`${base}${path}`, {waitUntil: 'load'});
    const served = await response.text();
    await act?.(page);
    await arrived;
    await settle(page, {app, waitFor, paints});
    const seen = await page.evaluate(readPage, hold ? {...hold, match: heldPattern(hold)} : {});
    return {served, servedRoute: readPrerenderRoute(served), ...requests, ...seen};
  } finally {
    await context.close();
  }
}

/** The images and pages `page` requests from now on, by path. */
function recordRequests(page) {
  const requests = {images: [], documents: []};
  page.on('request', (request) => {
    const {pathname} = new URL(request.url());
    if (request.resourceType() === 'image') requests.images.push(pathname);
    if (request.isNavigationRequest()) requests.documents.push(pathname);
  });
  return requests;
}

/** Sets a visit's page up before it loads: samples its frames, and holds back what `visit` asks. */
async function prepare(page, base, {path, app, strip, hold, transitions = true}) {
  await page.addInitScript(sampleFrames);
  if (!transitions) await page.addInitScript(withoutViewTransitions);
  if (!app) await page.route('**/assets/*.js', (route) => route.abort());
  if (strip) await page.route(`${base}${path}`, withoutInlineScript);
  if (hold) await page.route(heldBy(hold), holdBack(hold.ms));
  if (hold?.missing) await page.route(heldBy({file: hold.missing}), answerMissing);
}

/** `text` as a RegExp's source that matches it as written. */
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The paths of the files `hold` holds back, as a RegExp's source: its `match`, for a file the
 * page names at random (the vote page's first pair), or else its `file`.
 */
const heldPattern = ({file, match}) => match ?? `/${literally(file)}$`;

/** Does a URL name one of the files `hold` holds back? */
function heldBy(hold) {
  const pattern = new RegExp(heldPattern(hold));
  return (url) => pattern.test(new URL(url).pathname);
}

/** Settles once a file `hold` holds back has arrived, if it asks to be watched (`arrive`). */
function arrival(page, hold) {
  if (!hold?.arrive) return null;
  const held = heldBy(hold);
  return page
    .waitForResponse((answer) => held(answer.url()), {
      timeout: hold.ms + APP_TIMEOUT_MS,
    })
    .catch(() => null);
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

/** A time in a page, from the start of its visit. */
const ms = (time) => `${Math.round(time)} ms`;

/** The first frame that shows the app's own page. */
const firstAppFrame = (seen) => seen.frames.find((frame) => frame.app && frame.shown);

/**
 * Check 8: the capture stays until the data arrives, then the app's page replaces it whole,
 * within a frame of letting go: no frame shows a loading state or an empty #root. A capture that
 * is its page's loading view (`loadingCapture`) must show that view instead.
 */
function handsOverWhole(seen, {loadingCapture = false} = {}) {
  if (seen.heldArrivedAt === null) return 'never fetched the data it was held for';
  const asked = asksBeforeRendering(seen);
  if (asked) return asked;
  const shown = seen.frames.filter((frame) => frame.shown);
  const loading = loadingStateIn(shown, loadingCapture);
  if (loading) return loading;
  if (shown.some((frame) => frame.empty)) return 'a frame showed #root empty';
  return showsAppOnArrival(seen);
}

/**
 * Check 8: a loading state in the frames shown, where only a capture that is its page's loading
 * view (`loadingCapture`, the vote page's) may show one, and must.
 */
function loadingStateIn(shown, loadingCapture) {
  if (!loadingCapture) return loadingFrameIn(shown);
  const capturedLoading = shown.some((frame) => frame.captured && frame.busy);
  if (!capturedLoading) return "the capture showed a page of its own, not the page's loading view";
  return loadingFrameIn(shown.filter((frame) => frame.app));
}

/** Check 8: the first of `frames` to show a loading state, as a failure. */
function loadingFrameIn(frames) {
  const loading = frames.find((frame) => frame.busy);
  return loading ? `a frame showed a loading state ("${loading.busy}")` : null;
}

/**
 * Check 8: main.tsx's route readiness asked for every file the page waits for (`wanted`) before
 * the app rendered, and for none the page defers (`avoided`). The hold lets go only once the
 * held file has arrived, so a request after that came from the app's page, and one before it
 * from the hold.
 */
function asksBeforeRendering(seen) {
  const late = seen.wanted.find(({at}) => at === null || at > seen.heldArrivedAt);
  if (late?.at === null) return `never asked for ${late.file}`;
  if (late) {
    return `asked for ${late.file} at ${ms(late.at)}, after the held data arrived at ${ms(seen.heldArrivedAt)}: the app's page asked, not the hold`;
  }
  const early = seen.avoided.find(({at}) => at !== null && at < seen.heldArrivedAt);
  return early
    ? `asked for ${early.file} at ${ms(early.at)}, before the app rendered, though the page defers it`
    : null;
}

/**
 * Check 8, past its loading states: the app's page shows once the data arrives, with the
 * capture's images, and within a frame of letting go. Without view transitions Chromium draws a
 * new `<img>` blank for a frame, even art on screen, so there the images go unchecked.
 */
function showsAppOnArrival(seen) {
  const app = firstAppFrame(seen);
  if (app.time < seen.heldArrivedAt) {
    return `the app's page showed at ${ms(app.time)}, before its data arrived at ${ms(seen.heldArrivedAt)}`;
  }
  if (app.time > seen.heldArrivedAt + DATA_SLACK_MS) {
    return `the app's page showed ${ms(app.time - seen.heldArrivedAt)} after its data arrived`;
  }
  const blink = seen.transitions && seen.frames.find((frame) => frame.unshown > 0);
  if (blink) {
    return `a frame left out or faded ${blink.unshown} of the images the capture showed`;
  }
  // Let go but not yet rendered: main.tsx took the mark off, and React hasn't committed.
  const waiting = seen.frames.filter((frame) => !frame.marked && !frame.app).length;
  return waiting > 1 ? `the app's page showed ${waiting} frames after the hold let go` : null;
}

/** Check 9: with the data held past the cap, the app's page shows at the cap, loading. */
function letsGoAtCap(cap) {
  return (seen) => {
    const app = firstAppFrame(seen);
    if (app.time < cap)
      return `the app's page showed at ${ms(app.time)}, before the ${ms(cap)} cap`;
    if (app.time > cap + CAP_SLACK_MS) {
      return `the app's page showed at ${ms(app.time)}, ${ms(app.time - cap)} after the cap`;
    }
    return app.busy ? null : "the app's first frame showed no loading state, its data still held";
  };
}

/** Check 10: a click or a key press during the hold shows the app's page at once. */
function showsAppOnPress(seen) {
  if (seen.pressedAt === null) return 'the press never reached the page';
  const app = firstAppFrame(seen);
  if (app.time < seen.pressedAt) {
    return `the app's page showed at ${ms(app.time)}, before the press at ${ms(seen.pressedAt)}: the hold was over`;
  }
  const after = app.time - seen.pressedAt;
  return after > PRESS_SLACK_MS ? `the app's page showed ${ms(after)} after the press` : null;
}

/** Check 10: a click on one of the capture's links loads that link's page. */
function loadsLinkedPage(href) {
  return (seen) => {
    if (!seen.documents.includes(href)) return `never loaded ${href} as a page of its own`;
    return seen.path === href ? null : `ended on ${seen.path}, not ${href}`;
  };
}

/**
 * Check 10: a scroll during the hold keeps it, so the handoff is as check 8's, and the app's page
 * keeps the visitor's place.
 */
function keepsHoldThroughScroll(seen) {
  const app = firstAppFrame(seen);
  const held = seen.frames.filter((frame) => frame.time < app.time);
  if (!held.some((frame) => frame.scrollY > 0)) return 'the page never scrolled during the hold';
  const top = seen.frames.find((frame) => frame.app && frame.scrollY === 0);
  if (top)
    return `the app's page went back to the top at ${ms(top.time)}, losing the visitor's place`;
  return handsOverWhole(seen);
}

/**
 * Swipes up from the middle of a phone's screen, over a card link on the home page, as touch
 * events do: a page scrolls, and nothing is clicked.
 */
async function swipe(page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', {type, touchPoints: y === null ? [] : [{x: 200, y}]});
  await touch('touchStart', 600);
  for (let step = 1; step <= 10; step++) await touch('touchMove', 600 - step * 40);
  await touch('touchEnd', null);
}

/** Taps on a phone, clicks elsewhere. */
const press = (device, locator) => (device === 'phone' ? locator.tap() : locator.click());

/**
 * What a visitor does during the hold in check 10, on `device`: click the page's heading, press
 * Tab, follow its first card link, or scroll it (a swipe on a phone, the mouse wheel elsewhere).
 */
const ACTIONS = {
  click: (device) => (page) => press(device, page.locator('#root h1').first()),
  key: () => (page) => page.keyboard.press('Tab'),
  link: (device, href) => async (page) => {
    const link = page.locator(`#root a[href="${href}"]:visible`).first();
    await Promise.all([page.waitForURL(`**${href}`), press(device, link)]);
  },
  scroll: (device) => (page) => (device === 'phone' ? swipe(page) : page.mouse.wheel(0, 600)),
};

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
      '/vote',
    ],
    // Each page held for the data it waits for (check 8), with the other files it asks for
    // before the app renders (`wants`) and those it leaves to the app (`avoids`): the home page
    // doesn't wait for the card list (#641) unless its featured file can't be used (`missing`),
    // when it shows the featured cards from that list, and a playstyle's page waits for its card
    // ids and their mechanic ids too (#930), which the gallery leaves to the app.
    // The vote page's first pair is drawn at random, so the synergy files it asks for are held
    // by pattern (`match`), and its capture is its loading view (`loadingCapture`): the crawl
    // draws no pair.
    held: [
      {path: '/', file: 'featuredCards.json', avoids: ['allCards.json']},
      {path: '/', missing: 'featuredCards.json', file: 'allCards.json'},
      {path: '/browse', file: 'allCards.json'},
      {
        path: `/card/${cardId}/${slug}`,
        file: 'allCards.json',
        wants: [`synergies/${cardId}.json`],
      },
      {path: '/playstyles', file: '_playstyles.json', avoids: ['_playstyleMechanics.json']},
      {
        path: `/playstyles/${playstyle}`,
        file: '_playstyles.json',
        wants: ['allCards.json', '_playstyleMechanics.json'],
      },
      {
        path: `/playstyles/${playstyle}`,
        file: '_playstyleMechanics.json',
        wants: ['allCards.json', '_playstyles.json'],
      },
      {
        path: '/vote',
        file: 'synergies/<card>.json',
        match: '/synergies/\\d+\\.json$',
        wants: ['allCards.json', '_pairs_index.json'],
        loadingCapture: true,
      },
    ],
    homeLink: homeCardLink(dist),
  };
}

/** The home page's first card link, which check 10 follows during the hold. */
function homeCardLink(dist) {
  const home = join(dist, 'index.html');
  const link = /<a\b[^>]*\bhref="(\/card\/[^"]+)"/.exec(readFileSync(home, 'utf8'));
  if (!link) throw new Error(`${home} has no card link for check 10 to follow during the hold`);
  return link[1];
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

/**
 * Check 3 on `device`: Browse's capture for this screen shows cards, and the sort option the app
 * shows. The crawl reads a phone page after marking it, which takes it out of a phone's layout,
 * so a grid that measured itself then would have drawn no rows (#931).
 */
function browseCaptureCheck(device) {
  return {
    name: `3. /browse (${device}) captures its cards and the sort option the app shows`,
    run: async (browser, base) => {
      const held = await visit(browser, base, {device, path: '/browse', app: false});
      if (!held.markup.includes('href="/card/')) return `its ${device} capture shows no card`;
      const captured = held.sortValues;
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

/**
 * Check 8's runs of each page: in Chromium as it is, and with view transitions taken away, as
 * in Firefox before 144 and Safari before 18.
 */
const HANDOFFS = [
  {transitions: true, label: ''},
  {transitions: false, label: ', no view transitions'},
];

/** Check 8's name for the file a page is held for, after the one it finds missing, if any. */
const heldFiles = (file, missing) => (missing ? `${missing} missing, ${file}` : file);

/** Checks 8 to 10 on `device` (#915): the hold, its cap, and what a visitor does during it. */
function holdChecks(device, {held, homeLink}, cap) {
  const whole = held.flatMap(({path, file, match, wants, avoids, missing, loadingCapture}) =>
    HANDOFFS.map(({transitions, label}) => ({
      name: `8. ${path} (${device}${label}), ${heldFiles(file, missing)} held ${DATA_HOLD_MS} ms, hands over whole`,
      run: async (browser, base) =>
        handsOverWhole(
          await visit(browser, base, {
            device,
            path,
            app: true,
            transitions,
            hold: {file, match, ms: DATA_HOLD_MS, arrive: true, wants, avoids, missing},
          }),
          {loadingCapture},
        ),
    })),
  );
  const capped = {
    name: `9. /browse (${device}), allCards.json held past the cap, lets go at the cap`,
    run: async (browser, base) => {
      const hold = {file: 'allCards.json', ms: cap + CAP_SLACK_MS + 2000};
      return letsGoAtCap(cap)(
        await visit(browser, base, {device, path: '/browse', app: true, hold}),
      );
    },
  };
  const during = (action, check, watch) => async (browser, base) => {
    const hold = {file: 'featuredCards.json', ms: PRESS_HOLD_MS, ...watch};
    return check(await visit(browser, base, {device, path: '/', app: true, hold, act: action}));
  };
  const pressed = [
    {name: 'a click', run: during(ACTIONS.click(device), showsAppOnPress)},
    {name: 'a key press', run: during(ACTIONS.key(), showsAppOnPress)},
    {
      name: 'a click on a card link',
      run: during(ACTIONS.link(device, homeLink), loadsLinkedPage(homeLink)),
    },
    // The hold outlasts a scroll, so this visit watches until the held data arrives, as check 8's.
    {
      name: 'a scroll',
      run: during(ACTIONS.scroll(device), keepsHoldThroughScroll, {arrive: true}),
    },
  ].map(({name, run}) => ({name: `10. / (${device}), ${name} during the hold`, run}));
  return [...whole, capped, ...pressed];
}

/**
 * main.tsx's longest hold, HOLD_CAP_MS in apps/web/src/shared/lib/prerenderHold.ts; 0 turns the
 * hold off.
 */
function readHoldCap() {
  const source = readFileSync(resolve(ROOT, 'apps/web/src/shared/lib/prerenderHold.ts'), 'utf8');
  const cap = /export const HOLD_CAP_MS = (\d+);/.exec(source);
  if (!cap) throw new Error('HOLD_CAP_MS not found in prerenderHold.ts');
  return Number(cap[1]);
}

/** Every check to run, as {name, run(browser, base) => failure or null}. */
function planChecks(dist, cap) {
  const routes = routesOf(dist);
  const {withoutCapture, withCapture, eachCapture} = routes;
  const perDevice = Object.keys(DEVICES).flatMap((device) => [
    controlCheck(device, withoutCapture[0]),
    ...withoutCaptureChecks(device, withoutCapture),
    ...withCaptureChecks(device, withCapture),
    browseCaptureCheck(device),
    ...fallbackChecks(device, ['/browse', withoutCapture[0]]),
    ...screenChecks(device, eachCapture),
    ...(cap > 0 ? holdChecks(device, routes, cap) : []),
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
  const cap = readHoldCap();
  if (cap === 0)
    console.log('HOLD_CAP_MS is 0, which turns the hold off: checks 8 to 10 left out.');
  const server = await startServer(dist);
  const browser = await chromium.launch();
  const results = await runChecks(
    planChecks(dist, cap),
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
