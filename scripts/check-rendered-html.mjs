#!/usr/bin/env node
/**
 * Prerender render guard (issue #524, originally specified in #486).
 *
 * Verifies that a build output directory actually contains prerendered content,
 * not just an SPA shell. `build:vercel` deliberately wraps the crawl in
 * `|| echo '...shipping SPA-only (safe fallback, no regression)'` so that
 * Vercel-native preview builds — which cannot `playwright install --with-deps` —
 * degrade instead of failing. The cost of that tolerance is that a *production*
 * crawl failure also produces a green deploy, silently serving `<div id="root">`
 * to every non-JS crawler.
 *
 * This guard closes that hole at the deploy boundary only: `.github/workflows/
 * deploy.yml` runs it between `vercel build` and `vercel deploy --prebuilt`, so
 * production cannot ship a hollow crawl while previews stay tolerant. Do NOT add
 * it to `build:vercel` — that would break preview deploys, which is the exact
 * failure the `|| echo` exists to prevent.
 *
 * Checks, against a sample of card pages plus the /browse hub (and, for checks 6, 7, 9 and 10, the
 * homepage; check 11 reads the playstyle pages). Checks 2, 4 and 8 read the desktop capture apart
 * from the phone capture (#915):
 *   1. dist/card/<id>/<slug>/index.html exists
 *   2. it contains the card's fullName as visible content (not just an SPA shell)
 *   3. its <link rel="canonical"> is self-referential (the slug URL), not the homepage
 *   4. dist/browse/index.html links at least one /card/ URL, and so does its phone capture when
 *      it has one (#931)
 *   5. no sampled page contains the crawl server's origin (#525) — Vite's __vitePreload
 *      resolves modulepreload hrefs against the page origin, so an uncleaned capture bakes
 *      http://localhost:PORT into 7-14 hints per page; vercel.json's `default-src 'self'`
 *      CSP then blocks every one of them in production. prerender.mjs's
 *      cleanPrerenderedHtml() strips it; this asserts the strip actually ran.
 *   6. no sampled card page, and neither / nor /browse, preloads an image it never
 *      renders (#627): see findOrphanImagePreloads.
 *   7. no sampled card page, and neither / nor /browse, modulepreloads a lazy SDK chunk,
 *      Sentry's (#640) or PostHog's (#827): see findLazySdkPreloads.
 *   8. every sampled card page links all six ink hubs, which only its footer does (#530).
 *      The footer waits for the page's synergies (#532): see countInkHubLinks.
 *   9. every sampled card page, / and /browse marks its #root with its own route (#915): see
 *      readPrerenderRoute.
 *  10. every sampled card page, / and /browse carries a phone capture of its own, and no eager
 *      image a phone would fetch for the desktop capture alone (#915): see
 *      findPhoneCaptureProblems. Skipped when the crawl skipped phones (PRERENDER_PHONE=0).
 *  11. every playstyle page the crawl wrote carries its guide's heading and paragraphs as text,
 *      from the build's data/playstyleGuides.json, in its desktop capture and in its phone
 *      capture, and the crawl wrote at least one (#995): see findPlaystyleGuideOffenders.
 *
 * Usage: node scripts/check-rendered-html.mjs [targetDir]   (default: apps/web/dist)
 * Bypass: SKIP_RENDER_GUARD=1  (emergency escape hatch)
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAPTURE_MEDIA} from './lib/captureMedia.mjs';
import {SITE_ORIGIN} from './lib/siteOrigin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Re-exported because this module's test imports it from here (#554 moved the
// declaration into scripts/lib/siteOrigin.mjs; the import site stays).
export {SITE_ORIGIN};

/**
 * Load the BUILT engine dist. A root script can't resolve the workspace package
 * name, so import the dist by file URL (matches prerender.mjs + generate-sitemap.mjs).
 * Using the engine's own `cardPath` is what keeps this guard from drifting away
 * from the slug source of truth the sitemap and prerender already share.
 */
function loadEngine() {
  const enginePath = join(ROOT, 'packages', 'synergy-engine', 'dist', 'index.js');
  return import(new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href);
}

/**
 * Read the canonical href out of prerendered HTML, whatever order the attributes
 * come in: find the tag by its `rel`, then read its `href` separately.
 *
 * Attribute order is NOT a contract here. This guard reads markup React hoisted
 * from `<Seo>`, and React emits attributes in JSX prop order, so adding one prop
 * ahead of `rel` reorders the output. That is exactly what happened: #535 stamped
 * `data-seo` on every tag `<Seo>` owns, React emitted
 * `<link data-seo="" rel="canonical" href="...">`, and a reader anchored on
 * `<link rel="canonical"` stopped matching. The canonical was present and correct,
 * but this guard reported "(none)" and blocked every production deploy from
 * 2026-07-28 until it was found on 2026-09-23. Keep both orders covered by tests.
 */
export function readCanonical(html) {
  const tag = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/i)?.[0];
  return tag?.match(/\bhref="([^"]*)"/i)?.[1];
}

/** One attribute of a tag, whatever order its attributes come in (see readCanonical). */
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1];

/**
 * Whether a tag's rel lists `token`. rel is a set of space-separated, case-insensitive tokens,
 * so `rel="modulepreload "` is still a modulepreload to the browser.
 */
const hasRel = (tag, token) => (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes(token);

/**
 * Image preloads the page never renders (#627). The crawl captures the live DOM, so a
 * `<link rel="preload" as="image">` injected at runtime is baked into the static HTML,
 * where the parser fetches it ahead of everything else on every visit. The stale
 * thumbnail preloads #627 removed cost 44 KB of the mobile critical window on every
 * page; #525 and #535 were the same capture-bakes-runtime-state class of bug.
 *
 * An image preload is legitimate only if the page renders that image, so this checks
 * exactly that rather than banning image preloads outright: a future deliberate one
 * still passes. Font and script preloads are out of scope (index.html preloads fonts
 * on purpose). Attributes are read independently of their order, for the reason
 * readCanonical documents.
 *
 * On a page with a phone capture (#915), each screen preloads for the capture it shows: a
 * preload for the phone's screens (CAPTURE_MEDIA.phone) counts only if the phone capture renders
 * its image, and any other only if the page around the phone capture does.
 *
 * @param {string} html - one captured page
 * @returns {string[]} hrefs of image preloads with no matching `<img src>`
 */
export function findOrphanImagePreloads(html) {
  const srcsIn = (markup) =>
    new Set([...markup.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map((m) => m[1]));
  const desktop = srcsIn(withoutPhoneCapture(html));
  const phone = srcsIn(readCaptures(html)?.phone ?? html);
  return readImagePreloads(html)
    .filter(({href, media}) => href && !(media === CAPTURE_MEDIA.phone ? phone : desktop).has(href))
    .map(({href}) => href);
}

/**
 * The image preloads in a captured page, each with the screens it is for (`media`, #915), read
 * whatever order their attributes come in (see readCanonical).
 *
 * @param {string} html - one captured page
 * @returns {Array<{href: string | undefined, media: string | undefined}>}
 */
export function readImagePreloads(html) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => hasRel(tag, 'preload') && attr(tag, 'as') === 'image')
    .map((tag) => ({href: attr(tag, 'href'), media: attr(tag, 'media')}));
}

/** The offender reason shared by every page the orphan-preload check covers. */
const orphanPreloadReason = (hrefs) =>
  `preloads ${hrefs.join(', ')} but renders no <img> with that src (runtime <head> tag baked into the capture)`;

/**
 * The SDKs that load only after `load`, each with a string only its own code carries: Sentry's
 * name (#640) and PostHog's log prefix (#827).
 */
const LAZY_SDK_SIGNATURES = {Sentry: 'sentry.javascript', PostHog: '[PostHog.js]'};

/** The file name a modulepreload href points at, which is how chunks are keyed. */
const fileName = (href) => href.split('/').pop();

/**
 * The built chunks that carry a lazy SDK, found by the SDK's own string rather than a file name:
 * chunk names follow whichever module Rolldown groups first.
 *
 * @param {string} targetDir - build output root
 * @returns {Map<string, string>} file name under assets/ -> the SDK it carries
 */
export function findLazySdkChunks(targetDir) {
  const assets = join(targetDir, 'assets');
  if (!existsSync(assets)) return new Map();
  const sdkIn = (source) =>
    Object.keys(LAZY_SDK_SIGNATURES).find((sdk) => source.includes(LAZY_SDK_SIGNATURES[sdk]));
  return new Map(
    readdirSync(assets)
      .filter((name) => name.endsWith('.js'))
      .map((name) => [name, sdkIn(readFileSync(join(assets, name), 'utf8'))])
      .filter(([, sdk]) => sdk),
  );
}

/**
 * Lazy SDK chunks a page modulepreloads (#640, #827). Sentry and PostHog load after `load`, and
 * our crawl loads neither (prerender.mjs sets `__INKWEAVE_PRERENDER__`), so no captured page may
 * carry their modulepreloads: baked into the HTML, one fetches its SDK in the critical window on
 * every visit. The same capture-bakes-runtime-state class of bug as #525, #535 and #627.
 *
 * @param {string} html - one captured page
 * @param {Map<string, string>} sdkChunks - from findLazySdkChunks
 * @returns {Array<{sdk: string, href: string}>} the modulepreloads that point at a lazy SDK chunk
 */
export function findLazySdkPreloads(html, sdkChunks) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => hasRel(tag, 'modulepreload'))
    .map((tag) => attr(tag, 'href'))
    .filter((href) => href && sdkChunks.has(fileName(href)))
    .map((href) => ({sdk: sdkChunks.get(fileName(href)), href}));
}

/** The offender reason shared by every page the lazy-SDK check covers. */
const lazySdkPreloadReason = (preloads) =>
  `modulepreloads ${preloads.map(({sdk, href}) => `the ${sdk} SDK (${href})`).join(' and ')}, ` +
  'which must load only after `load` (#640, #827)';

/** "Sentry 1, PostHog 0": how many chunks of each lazy SDK a build carries. */
const countBySdk = (sdkChunks) =>
  Object.keys(LAZY_SDK_SIGNATURES)
    .map((sdk) => `${sdk} ${[...sdkChunks.values()].filter((found) => found === sdk).length}`)
    .join(', ');

/** The six ink hubs the site footer links from every page (#530): Lorcana's six inks. */
const INK_HUB_SLUGS = ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel'];
export const INK_HUB_COUNT = INK_HUB_SLUGS.length;

/**
 * How many of the six ink hubs a page links, each counted once. On a card page only the footer
 * links them, so a card page short of six shipped without its footer. A misspelled hub link
 * doesn't count, so a broken link can't stand in for a real hub.
 *
 * @param {string} html - one captured page
 * @returns {number} the hubs out of INK_HUB_SLUGS the page links
 */
export function countInkHubLinks(html) {
  return INK_HUB_SLUGS.filter((slug) => html.includes(`href="/ink/${slug}"`)).length;
}

/**
 * The route a captured page's #root is marked with (#915), or undefined. index.html's inline
 * script shows a captured page only on the route its mark names and empties it anywhere else,
 * and vercel.json serves the home page's capture for every route without a file of its own: so
 * a home page without its mark paints on every such route, and a page marked with another
 * route is emptied on its own. Attributes are read independently of their order, for the
 * reason readCanonical documents.
 *
 * @param {string} html - one captured page
 * @returns {string | undefined} the route its #root names
 */
export function readPrerenderRoute(html) {
  const root = html.match(/<div\b[^>]*\sid="root"[^>]*>/i)?.[0];
  return root && attr(root, 'data-prerender-route');
}

/** The offender reason shared by every page the route-mark check covers. */
const routeMarkReason = (mark, route) =>
  `#root is marked ${mark === undefined ? 'with no route' : `"${mark}"`}, expected "${route}" (#915)`;

/**
 * The phone capture prerender.mjs puts right after #root (#915), its markup captured. Template
 * content is inert, so no crawler indexes it and no browser fetches what it names.
 */
const PHONE_CAPTURE = /<template\b[^>]*\sid="prerender-phone"[^>]*>([\s\S]*?)<\/template>/i;

/** A captured page as crawlers read it: the desktop capture, without the phone capture. */
const withoutPhoneCapture = (html) => html.replace(PHONE_CAPTURE, '');

/** #root's markup in a captured page, up to `end`, where the phone capture starts. */
function rootMarkupBefore(html, end) {
  const open = html.match(/<div\b[^>]*\sid="root"[^>]*>/i);
  if (!open) return '';
  return html.slice(open.index + open[0].length, end).replace(/<\/div>\s*$/, '');
}

/**
 * A captured page's two captures (#915): #root's markup, and the phone capture's after it.
 *
 * @param {string} html - one captured page
 * @returns {{desktop: string, phone: string} | undefined} undefined without a phone capture
 */
export function readCaptures(html) {
  const capture = html.match(PHONE_CAPTURE);
  return capture ? {desktop: rootMarkupBefore(html, capture.index), phone: capture[1]} : undefined;
}

/**
 * Each image `markup` renders, data: URIs aside, and whether it waits to load (`loading`).
 *
 * @param {string} markup - a capture's markup
 * @returns {Array<{src: string, lazy: boolean}>}
 */
export function readImages(markup) {
  return (markup.match(/<img\b[^>]*>/gi) ?? [])
    .map((tag) => ({src: attr(tag, 'src'), lazy: attr(tag, 'loading')?.toLowerCase() === 'lazy'}))
    .filter(({src}) => src && !src.startsWith('data:'));
}

/**
 * The images a phone fetches for nothing on a captured page (#915): eager ones in #root that the
 * phone capture doesn't show. A phone's preload scanner reads the desktop markup before
 * index.html's inline script swaps the phone capture in, and fetches every eager image it finds;
 * prerender.mjs's deferDesktopOnlyImages makes these lazy, and index.html never lays an
 * unapproved #root out on a phone, so a lazy one never loads there.
 *
 * @param {string} desktop - #root's markup
 * @param {string} phone - the phone capture's markup
 * @returns {string[]} their srcs, each once
 */
export function findDesktopOnlyEagerImages(desktop, phone) {
  const phoneSrcs = new Set(readImages(phone).map(({src}) => src));
  const eager = readImages(desktop).filter(({src, lazy}) => !lazy && !phoneSrcs.has(src));
  return [...new Set(eager.map(({src}) => src))];
}

/**
 * Why a captured page's phone capture fails check 10 (#915), if it does. On a phone,
 * index.html's inline script swaps the capture's `<template id="prerender-phone">` into #root,
 * so a page without one shows a phone the desktop layout, an empty one shows it a blank page, and
 * one that repeats #root's markup was captured at desktop width.
 *
 * @param {string} html - one captured page
 * @returns {string[]} the reasons, none when the phone capture is sound
 */
export function findPhoneCaptureProblems(html) {
  const captures = readCaptures(html);
  if (!captures) return ['has no phone capture, so a phone gets the desktop layout (#915)'];
  const {desktop, phone} = captures;
  if (!phone.trim()) return ['its phone capture is empty, so a phone shows a blank page (#915)'];
  if (phone === desktop) return ['its phone capture is the desktop markup again (#915)'];
  const wasted = findDesktopOnlyEagerImages(desktop, phone);
  if (wasted.length === 0) return [];
  return [
    `a phone fetches ${wasted.join(', ')} for nothing: eager in #root, and the phone capture ` +
      "doesn't show them (#915)",
  ];
}

/** Check 10's offenders on one page, or none when the crawl skipped phones (PRERENDER_PHONE=0). */
const phoneCaptureOffenders = (file, html, phones) =>
  phones ? findPhoneCaptureProblems(html).map((reason) => ({file, reason})) : [];

/** The build's copy of the guides the playstyle pages fetch (#995), under the build root. */
const GUIDES_FILE = join('data', 'playstyleGuides.json');

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

/**
 * Text as the crawl's browser writes it into a capture. Serializing a text node escapes only
 * `&`, `<`, `>` and the no-break space, never a quote or an apostrophe, so text is looked for
 * escaped the same way.
 *
 * @param {string} text
 * @returns {string}
 */
export function asCapturedText(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(NO_BREAK_SPACE, '&nbsp;');
}

/**
 * What one capture of a playstyle page lacks of its guide (#995): the heading that names the
 * playstyle, then each paragraph by its place. Each must be an element's whole text, as the
 * guide renders it, so a sentence of it elsewhere on the page doesn't count.
 *
 * @param {string} markup - one capture's markup
 * @param {string} name - the playstyle's name
 * @param {{paragraphs: string[]}} guide - the playstyle's entry in the guides
 * @returns {string[]} what it lacks, as `heading "How to play Exert"` or `paragraph 2`
 */
export function findMissingGuideText(markup, name, guide) {
  const heading = `How to play ${name}`;
  return [
    [heading, `heading "${heading}"`],
    ...guide.paragraphs.map((text, i) => [text, `paragraph ${i + 1}`]),
  ]
    .filter(([text]) => !markup.includes(`>${asCapturedText(text)}<`))
    .map(([, part]) => part);
}

/**
 * The captures a playstyle page's guide must be in (#995): the desktop one, which crawlers
 * read, and the phone one, which index.html swaps in on a phone, unless the crawl skipped
 * phones. A phone capture the page lacks is undefined.
 */
function guideCaptures(html, phones) {
  const captures = readCaptures(html);
  const desktop = captures?.desktop ?? withoutPhoneCapture(html);
  return phones ? {desktop, phone: captures?.phone} : {desktop};
}

/** Why one capture of a playstyle page fails check 11 (#995), if it does. */
function guideCaptureProblems(capture, markup, {name, guide}) {
  if (markup === undefined) return ['has no phone capture to carry its guide (#915, #995)'];
  const missing = findMissingGuideText(markup, name, guide);
  if (missing.length === 0) return [];
  return [`its ${capture} capture lacks its guide's ${missing.join(', ')} (#995)`];
}

/** Check 11's offenders on one playstyle page the crawl wrote (#995). */
function findGuidePageOffenders(page, phones) {
  const {file, guide} = page;
  if (!guide) return [{file, reason: 'has no guide in data/playstyleGuides.json to show (#995)'}];
  const captures = guideCaptures(readFileSync(file, 'utf8'), phones);
  return Object.entries(captures)
    .flatMap(([capture, markup]) => guideCaptureProblems(capture, markup, page))
    .map((reason) => ({file, reason}));
}

/**
 * The playstyle pages the crawl wrote, of `playstyles`, each with its file. A sample crawl
 * (PRERENDER_SAMPLE=1) writes only the first few.
 *
 * @param {string} targetDir - build output root
 * @param {Array<{id: string, name: string}>} playstyles - every playstyle, from the engine
 * @returns {Array<{id: string, name: string, file: string}>}
 */
export function findPlaystylePages(targetDir, playstyles) {
  return playstyles
    .map(({id, name}) => ({id, name, file: join(targetDir, 'playstyles', id, 'index.html')}))
    .filter(({file}) => existsSync(file));
}

/**
 * Check 11 (#995): every playstyle page the crawl wrote carries its guide as text, in each
 * capture `guideCaptures` names, so a crawler without JavaScript reads the guide the page shows
 * under its cards. The page waits for the guides before it draws its cards (#930's pattern), so
 * a capture without one means the hold or the guides file broke. A build with no playstyle page
 * fails too, as the check would then pass having read nothing.
 *
 * @param {string} targetDir - build output root
 * @param {Array<{id: string, name: string}>} playstyles - every playstyle, from the engine; none
 *   skips the check
 * @param {{phones: boolean}} checks - whether the crawl captured phones
 * @returns {Array<{file: string, reason: string}>} empty when every page carries its guide
 */
export function findPlaystyleGuideOffenders(targetDir, playstyles, {phones}) {
  if (playstyles.length === 0) return [];
  const guidesFile = join(targetDir, GUIDES_FILE);
  if (!existsSync(guidesFile)) {
    const reason = 'missing from the build, so no playstyle page has its guide (#995)';
    return [{file: guidesFile, reason}];
  }
  const pages = findPlaystylePages(targetDir, playstyles);
  if (pages.length === 0) {
    const reason = 'holds no playstyle page, so no guide was checked (crawl skipped them? #995)';
    return [{file: join(targetDir, 'playstyles'), reason}];
  }
  const guides = JSON.parse(readFileSync(guidesFile, 'utf8'));
  return pages.flatMap((page) => findGuidePageOffenders({...page, guide: guides[page.id]}, phones));
}

/**
 * Choose which card pages this guard verifies.
 *
 * The prerender already aborts on a >2% route failure rate, so this guard is not
 * a second failure-rate check — it exists to catch the cases that produce a
 * *successful-looking* build with no content: the crawl never ran at all, or it
 * ran and wrote shells. It runs on every production deploy, so it must be fast
 * and must never fail for a reason unrelated to the crawl.
 *
 * @param {Array<{id: number, fullName: string}>} cards - every Core card, in allCards.json order
 * @returns {Array<{id: number, fullName: string}>} the cards whose pages will be checked
 */
export function selectSampleCards(cards) {
  // Evenly spaced through allCards.json order, never a hardcoded id: ids are
  // renumbered on Core set-graduation (scripts/graduate-canonical-set.mjs), so a
  // fixed id is one rotation away from breaking a guard that blocks deploys.
  //
  // A spread rather than a single card because the crawl runs at concurrency 8 and
  // its realistic failure mode is partial — a run of routes failing while the rest
  // succeed. Sampling only cards[0] would walk straight past that.
  //
  // Deliberately content-agnostic: 155 of 1,024 Core cards have zero synergies and
  // their pages are still legitimately prerendered, so nothing here may depend on
  // what a page contains — only on the crawl having produced it.
  const SAMPLE_SIZE = 5;
  const step = Math.max(1, Math.floor(cards.length / SAMPLE_SIZE));

  const picked = [];
  for (let i = 0; i < cards.length && picked.length < SAMPLE_SIZE; i += step) {
    picked.push(cards[i]);
  }

  // Always include the tail. A crawl killed partway through leaves the end of the
  // route list unwritten, and that is precisely the region a forward walk misses.
  const last = cards.at(-1);
  if (last && !picked.includes(last)) picked.push(last);

  return picked;
}

/**
 * Every reason one sampled card page fails the guard. Split out of findOffenders so
 * each function states one question: this one asks "is THIS page sound?", the caller
 * asks "is the BUILD sound?". Adding a fifth per-page assertion (#525) pushed the
 * combined form to a cyclomatic complexity of 10, and further checks are expected.
 *
 * @param {string} targetDir - build output root to inspect
 * @param {{id: number, fullName: string}} card - the sampled card
 * @param {string} route - the card's slug path, from the engine's cardPath
 * @param {{sdkChunks: Map<string, string>, phones: boolean}} checks - see findOffenders
 * @returns {Array<{file: string, reason: string}>} empty when the page is sound
 */
function findCardPageOffenders(targetDir, card, route, {sdkChunks, phones}) {
  const file = join(targetDir, route, 'index.html');
  if (!existsSync(file)) {
    return [{file, reason: 'prerendered card page missing (crawl did not run?)'}];
  }

  const html = readFileSync(file, 'utf8');
  const desktopHtml = withoutPhoneCapture(html);
  const canonical = readCanonical(html);
  const expectedCanonical = `${SITE_ORIGIN}${route}`;
  const orphanPreloads = findOrphanImagePreloads(html);
  const sdkPreloads = findLazySdkPreloads(html, sdkChunks);
  const inkHubs = countInkHubLinks(desktopHtml);
  const mark = readPrerenderRoute(html);

  // Each entry is one assertion: [failed?, why]. A table rather than a chain of ifs
  // so a new check is one row, not another branch in an already-dense function.
  return [
    // The card's own name is the cheapest proof that real content rendered: an SPA
    // shell contains the app skeleton and nothing card-specific.
    [
      !desktopHtml.includes(card.fullName),
      `does not contain its card name "${card.fullName}" (empty shell?)`,
    ],
    // #486's central acceptance criterion: every route self-references. A homepage
    // canonical here means the SPA fallback was served instead of a prerendered file.
    [
      canonical !== expectedCanonical,
      `canonical is "${canonical ?? '(none)'}", expected "${expectedCanonical}"`,
    ],
    // The crawl server's origin must never survive into shipped HTML (#525). Vite's
    // __vitePreload resolves modulepreload hrefs against the page origin, so an
    // uncleaned capture bakes http://localhost:PORT into 7-14 hints per page — plain
    // HTTP on an HTTPS page, blocked outright by vercel.json's `default-src 'self'`.
    //
    // Deliberately BROADER than prerender.mjs's cleanPrerenderedHtml, which rewrites only
    // the exact `http://localhost:PORT` string: this also trips on escaped (`http:\/\/`)
    // and protocol-relative forms the rewrite would silently miss. Do NOT narrow it to
    // match the cleaner. A false positive costs one investigation; a miss ships
    // CSP-blocked preloads to every visitor until someone reads a page source by hand.
    [
      html.includes('localhost'),
      "contains 'localhost' — the crawl server's origin leaked into shipped HTML",
    ],
    // A runtime image preload baked into the capture (#627): fetched first on every
    // visit, for an image this page never shows.
    [orphanPreloads.length > 0, orphanPreloadReason(orphanPreloads)],
    // A lazy SDK's modulepreload baked into the capture (#640, #827): the SDK fetched in the
    // critical window on every visit, when it should load only after `load`.
    [sdkPreloads.length > 0, lazySdkPreloadReason(sdkPreloads)],
    // The footer's ink-hub links put every card page one click from a hub (#530). The card
    // page renders its footer only once its synergies have loaded (#532), so a capture taken
    // before that would ship without them. prerender.mjs waits for the footer on card pages;
    // this proves the wait worked.
    [
      inkHubs < INK_HUB_COUNT,
      `links ${inkHubs} of the ${INK_HUB_COUNT} ink hubs (footer not rendered when captured? #532)`,
    ],
    // index.html's inline script empties a captured page whose mark names another route, so a
    // page without its own route would never paint its capture (#915).
    [mark !== route, routeMarkReason(mark, route)],
  ]
    .filter(([failed]) => failed)
    .map(([, reason]) => ({file, reason}))
    .concat(phoneCaptureOffenders(file, html, phones));
}

/**
 * /browse is the corpus hub; a shell there is a failed crawl even if cards rendered. Its phone
 * capture links cards too: index.html swaps it in on a phone, and one read while the grid drew no
 * rows shows a phone none (#931). Check 10 reports a phone capture that is missing or empty.
 */
function findBrowseHubOffenders(targetDir) {
  const file = join(targetDir, 'browse', 'index.html');
  if (!existsSync(file)) return [{file, reason: 'prerendered /browse missing'}];
  const html = readFileSync(file, 'utf8');
  if (!withoutPhoneCapture(html).includes('href="/card/')) {
    return [{file, reason: 'links no /card/ URLs (empty shell?)'}];
  }
  const phone = readCaptures(html)?.phone.trim();
  if (phone && !phone.includes('href="/card/')) {
    return [
      {file, reason: 'its phone capture links no /card/ URLs, so a phone shows no cards (#931)'},
    ];
  }
  return [];
}

/** The two entry pages the card sample does not cover, each with the route it is served on. */
const ENTRY_PAGES = [
  {rel: 'index.html', route: '/'},
  {rel: join('browse', 'index.html'), route: '/browse'},
];

/**
 * The orphan-preload (#627), lazy-SDK-preload (#640, #827), route-mark and phone-capture (#915)
 * checks on the two entry pages the card sample does not cover: `/`, the page PSI measures and
 * the capture vercel.json serves for every route without its own, and `/browse`. A missing file
 * is skipped: findBrowseHubOffenders already reports a missing /browse, and the build always
 * writes a root index.html (the Vite shell).
 */
function findEntryPageOffenders(targetDir, {sdkChunks, phones}) {
  return ENTRY_PAGES.flatMap(({rel, route}) => {
    const file = join(targetDir, rel);
    if (!existsSync(file)) return [];
    const html = readFileSync(file, 'utf8');
    const orphans = findOrphanImagePreloads(html);
    const sdks = findLazySdkPreloads(html, sdkChunks);
    const mark = readPrerenderRoute(html);
    return [
      [orphans.length > 0, orphanPreloadReason(orphans)],
      [sdks.length > 0, lazySdkPreloadReason(sdks)],
      [mark !== route, routeMarkReason(mark, route)],
    ]
      .filter(([failed]) => failed)
      .map(([, reason]) => ({file, reason}))
      .concat(phoneCaptureOffenders(file, html, phones));
  });
}

/**
 * Collect every reason `targetDir` fails the guard. Pure apart from reading the
 * filesystem — returns the full offender list rather than throwing on the first,
 * so one build-and-deploy cycle surfaces every problem (the check-sourcemaps.mjs
 * convention).
 *
 * @param {string} targetDir - build output root to inspect
 * @param {Array<{id: number, fullName: string}>} samples - card pages to verify
 * @param {(card: object) => string} cardPath - the engine's slug-path builder
 * @param {object} [checks]
 * @param {Map<string, string>} [checks.sdkChunks] - the build's lazy SDK chunks (default: read
 *   from targetDir)
 * @param {boolean} [checks.phones] - whether the crawl captured phones, so check 10 runs, and
 *   check 11 reads the phone captures (default: true; main reads PRERENDER_PHONE)
 * @param {Array<{id: string, name: string}>} [checks.playstyles] - every playstyle, whose pages
 *   check 11 reads (default: none, which skips it; main reads the engine's)
 * @returns {Array<{file: string, reason: string}>} empty when the build is sound
 */
export function findOffenders(
  targetDir,
  samples,
  cardPath,
  {sdkChunks = findLazySdkChunks(targetDir), phones = true, playstyles = []} = {},
) {
  // Distinguish "wrong path" from "bad crawl" before anything else. Without this,
  // a mistyped targetDir reports every sampled page as missing and blocks the
  // deploy for a reason that has nothing to do with the prerender — the most
  // expensive kind of false positive for a gate that runs on every release.
  if (!existsSync(targetDir)) {
    return [
      {file: targetDir, reason: 'target directory does not exist (wrong path, not a failed crawl)'},
    ];
  }

  const checks = {sdkChunks, phones};
  return [
    ...samples.flatMap((card) => findCardPageOffenders(targetDir, card, cardPath(card), checks)),
    ...findBrowseHubOffenders(targetDir),
    ...findEntryPageOffenders(targetDir, checks),
    ...findPlaystyleGuideOffenders(targetDir, playstyles, checks),
  ];
}

async function main() {
  const targetDir = process.argv[2] ?? 'apps/web/dist';

  if (process.env.SKIP_RENDER_GUARD === '1') {
    console.log(`⚠ Render guard skipped (SKIP_RENDER_GUARD=1) for "${targetDir}".`);
    return;
  }

  const {cardPath, getAllPlaystyles} = await loadEngine();
  const {cards} = JSON.parse(
    readFileSync(join(ROOT, 'apps/web/public/data/allCards.json'), 'utf8'),
  );

  const samples = selectSampleCards(cards);
  if (!Array.isArray(samples) || samples.length === 0) {
    console.error('✖ Render guard misconfigured: selectSampleCards returned no cards.');
    process.exit(1);
  }
  // The routes the crawl writes a playstyle page for (prerender.mjs), as check 11 reads them.
  const playstyles = getAllPlaystyles().map(({id, name}) => ({id, name}));
  if (playstyles.length === 0) {
    console.error('✖ Render guard misconfigured: the engine lists no playstyles.');
    process.exit(1);
  }

  const sdkChunks = findLazySdkChunks(targetDir);
  // PRERENDER_PHONE=0 skips the crawl's phone captures (#915), so it skips check 10 with them,
  // and check 11 reads only the desktop captures.
  const phones = process.env.PRERENDER_PHONE !== '0';
  const offenders = findOffenders(targetDir, samples, cardPath, {sdkChunks, phones, playstyles});

  if (offenders.length > 0) {
    console.error(`✖ Render guard failed in "${targetDir}":`);
    for (const {file, reason} of offenders) console.error(`  ${file}\n    -> ${reason}`);
    console.error(
      '\nThe prerender crawl did not produce indexable HTML. Deploying this build would ' +
        'serve an empty SPA shell to every non-JS crawler. Check the `[prerender]` lines in ' +
        'the build log — build:vercel swallows crawl failures by design so previews can ' +
        'degrade, which is why this guard exists at the deploy boundary.',
    );
    process.exit(1);
  }

  // The chunk counts make a vacuous check 7 visible: 0 means it had nothing to look for. PostHog
  // counts 0 until Vercel Production has its key (#827).
  const guides = findPlaystylePages(targetDir, playstyles).length;
  console.log(
    `✓ Prerendered HTML verified in "${targetDir}" (${samples.length} card page(s), /browse and /; ` +
      `lazy SDK chunks checked: ${countBySdk(sdkChunks)}; ` +
      `phone captures ${phones ? 'checked' : 'skipped, PRERENDER_PHONE=0'}; ` +
      `playstyle guides checked on ${guides} of ${playstyles.length} playstyle page(s)).`,
  );
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('✖ Render guard crashed:', err?.message ?? err);
    process.exit(1);
  });
}
