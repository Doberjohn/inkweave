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
 * Checks, against a sample of card pages plus the /browse hub (and, for checks 6 and 7, the homepage):
 *   1. dist/card/<id>/<slug>/index.html exists
 *   2. it contains the card's fullName as visible content (not just an SPA shell)
 *   3. its <link rel="canonical"> is self-referential (the slug URL), not the homepage
 *   4. dist/browse/index.html links at least one /card/ URL
 *   5. no sampled page contains the crawl server's origin (#525) — Vite's __vitePreload
 *      resolves modulepreload hrefs against the page origin, so an uncleaned capture bakes
 *      http://localhost:PORT into 7-14 hints per page; vercel.json's `default-src 'self'`
 *      CSP then blocks every one of them in production. prerender.mjs's
 *      cleanPrerenderedHtml() strips it; this asserts the strip actually ran.
 *   6. no sampled card page, and neither / nor /browse, preloads an image it never
 *      renders (#627): see findOrphanImagePreloads.
 *   7. no sampled card page, and neither / nor /browse, modulepreloads a Sentry chunk
 *      (#640): see findSentryPreloads.
 *   8. every sampled card page links all six ink hubs, which only its footer does (#530).
 *      The footer waits for the page's synergies (#532): see countInkHubLinks.
 *
 * Usage: node scripts/check-rendered-html.mjs [targetDir]   (default: apps/web/dist)
 * Bypass: SKIP_RENDER_GUARD=1  (emergency escape hatch)
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Apex host — must match <Seo>'s SITE_ORIGIN and generate-sitemap.mjs (#488). */
export const SITE_ORIGIN = 'https://inkweave.ink';

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
 * @param {string} html - one captured page
 * @returns {string[]} hrefs of image preloads with no matching `<img src>`
 */
export function findOrphanImagePreloads(html) {
  const rendered = new Set([...html.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map((m) => m[1]));
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => hasRel(tag, 'preload') && attr(tag, 'as') === 'image')
    .map((tag) => attr(tag, 'href'))
    .filter((href) => href && !rendered.has(href));
}

/** The offender reason shared by every page the orphan-preload check covers. */
const orphanPreloadReason = (hrefs) =>
  `preloads ${hrefs.join(', ')} but renders no <img> with that src (runtime <head> tag baked into the capture)`;

/** The Sentry SDK's own name string, present in the chunk that carries the SDK. */
const SENTRY_SIGNATURE = 'sentry.javascript';

/**
 * The built chunks that carry the Sentry SDK (#640), found by the SDK's name string rather than
 * a file name: chunk names follow whichever module Rolldown groups first.
 *
 * @param {string} targetDir - build output root
 * @returns {Set<string>} file names under assets/
 */
export function findSentryChunks(targetDir) {
  const assets = join(targetDir, 'assets');
  if (!existsSync(assets)) return new Set();
  const chunks = readdirSync(assets).filter((name) => name.endsWith('.js'));
  return new Set(chunks.filter((name) => readFileSync(join(assets, name), 'utf8').includes(SENTRY_SIGNATURE)));
}

/**
 * Sentry chunks a page modulepreloads (#640). Sentry loads after `load`, and our crawl never
 * loads it (prerender.mjs sets `__INKWEAVE_PRERENDER__`), so no captured page may carry its
 * modulepreload: baked into the HTML, it fetches the SDK in the critical window on every visit.
 * The same capture-bakes-runtime-state class of bug as #525, #535 and #627.
 *
 * @param {string} html - one captured page
 * @param {Set<string>} sentryChunks - from findSentryChunks
 * @returns {string[]} hrefs of modulepreloads that point at a Sentry chunk
 */
export function findSentryPreloads(html, sentryChunks) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => hasRel(tag, 'modulepreload'))
    .map((tag) => attr(tag, 'href'))
    .filter((href) => href && sentryChunks.has(href.split('/').pop()));
}

/** The offender reason shared by every page the Sentry-preload check covers. */
const sentryPreloadReason = (hrefs) =>
  `modulepreloads the Sentry SDK (${hrefs.join(', ')}), which must load only after \`load\` (#640)`;

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
 * @param {Set<string>} sentryChunks - from findSentryChunks
 * @returns {Array<{file: string, reason: string}>} empty when the page is sound
 */
function findCardPageOffenders(targetDir, card, route, sentryChunks) {
  const file = join(targetDir, route, 'index.html');
  if (!existsSync(file)) {
    return [{file, reason: 'prerendered card page missing (crawl did not run?)'}];
  }

  const html = readFileSync(file, 'utf8');
  const canonical = readCanonical(html);
  const expectedCanonical = `${SITE_ORIGIN}${route}`;
  const orphanPreloads = findOrphanImagePreloads(html);
  const sentryPreloads = findSentryPreloads(html, sentryChunks);
  const inkHubs = countInkHubLinks(html);

  // Each entry is one assertion: [failed?, why]. A table rather than a chain of ifs
  // so a new check is one row, not another branch in an already-dense function.
  return [
    // The card's own name is the cheapest proof that real content rendered: an SPA
    // shell contains the app skeleton and nothing card-specific.
    [
      !html.includes(card.fullName),
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
    // Sentry's modulepreload baked into the capture (#640): the SDK fetched in the critical
    // window on every visit, when it should load only after `load`.
    [sentryPreloads.length > 0, sentryPreloadReason(sentryPreloads)],
    // The footer's ink-hub links put every card page one click from a hub (#530). The card
    // page renders its footer only once its synergies have loaded (#532), so a capture taken
    // before that would ship without them. prerender.mjs waits for the footer on card pages;
    // this proves the wait worked.
    [
      inkHubs < INK_HUB_COUNT,
      `links ${inkHubs} of the ${INK_HUB_COUNT} ink hubs (footer not rendered when captured? #532)`,
    ],
  ]
    .filter(([failed]) => failed)
    .map(([, reason]) => ({file, reason}));
}

/** /browse is the corpus hub; a shell there is a failed crawl even if cards rendered. */
function findBrowseHubOffenders(targetDir) {
  const file = join(targetDir, 'browse', 'index.html');
  if (!existsSync(file)) return [{file, reason: 'prerendered /browse missing'}];
  if (!readFileSync(file, 'utf8').includes('href="/card/')) {
    return [{file, reason: 'links no /card/ URLs (empty shell?)'}];
  }
  return [];
}

/**
 * The orphan-preload (#627) and Sentry-preload (#640) checks on the two entry pages the card
 * sample does not cover: `/`, the page PSI measures, and `/browse`. A missing file is
 * skipped: findBrowseHubOffenders already reports a missing /browse, and the build always
 * writes a root index.html (the Vite shell).
 */
function findEntryPageOffenders(targetDir, sentryChunks) {
  return ['index.html', join('browse', 'index.html')].flatMap((rel) => {
    const file = join(targetDir, rel);
    if (!existsSync(file)) return [];
    const html = readFileSync(file, 'utf8');
    const orphans = findOrphanImagePreloads(html);
    const sentry = findSentryPreloads(html, sentryChunks);
    return [
      ...(orphans.length > 0 ? [{file, reason: orphanPreloadReason(orphans)}] : []),
      ...(sentry.length > 0 ? [{file, reason: sentryPreloadReason(sentry)}] : []),
    ];
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
 * @param {Set<string>} [sentryChunks] - the build's Sentry chunks (default: read from targetDir)
 * @returns {Array<{file: string, reason: string}>} empty when the build is sound
 */
export function findOffenders(targetDir, samples, cardPath, sentryChunks = findSentryChunks(targetDir)) {
  // Distinguish "wrong path" from "bad crawl" before anything else. Without this,
  // a mistyped targetDir reports every sampled page as missing and blocks the
  // deploy for a reason that has nothing to do with the prerender — the most
  // expensive kind of false positive for a gate that runs on every release.
  if (!existsSync(targetDir)) {
    return [
      {file: targetDir, reason: 'target directory does not exist (wrong path, not a failed crawl)'},
    ];
  }

  return [
    ...samples.flatMap((card) => findCardPageOffenders(targetDir, card, cardPath(card), sentryChunks)),
    ...findBrowseHubOffenders(targetDir),
    ...findEntryPageOffenders(targetDir, sentryChunks),
  ];
}

async function main() {
  const targetDir = process.argv[2] ?? 'apps/web/dist';

  if (process.env.SKIP_RENDER_GUARD === '1') {
    console.log(`⚠ Render guard skipped (SKIP_RENDER_GUARD=1) for "${targetDir}".`);
    return;
  }

  const {cardPath} = await loadEngine();
  const {cards} = JSON.parse(
    readFileSync(join(ROOT, 'apps/web/public/data/allCards.json'), 'utf8'),
  );

  const samples = selectSampleCards(cards);
  if (!Array.isArray(samples) || samples.length === 0) {
    console.error('✖ Render guard misconfigured: selectSampleCards returned no cards.');
    process.exit(1);
  }

  const sentryChunks = findSentryChunks(targetDir);
  const offenders = findOffenders(targetDir, samples, cardPath, sentryChunks);

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

  // The Sentry chunk count makes a vacuous check 7 visible: 0 means it had nothing to look for.
  console.log(
    `✓ Prerendered HTML verified in "${targetDir}" (${samples.length} card page(s), /browse and /; ` +
      `${sentryChunks.size} Sentry chunk(s) checked).`,
  );
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('✖ Render guard crashed:', err?.message ?? err);
    process.exit(1);
  });
}
