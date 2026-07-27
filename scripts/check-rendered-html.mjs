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
 * Checks, against a sample of card pages plus the /browse hub:
 *   1. dist/card/<id>/<slug>/index.html exists
 *   2. it contains the card's fullName as visible content (not just an SPA shell)
 *   3. its <link rel="canonical"> is self-referential (the slug URL), not the homepage
 *   4. dist/browse/index.html links at least one /card/ URL
 *   5. no sampled page contains the crawl server's origin (#525) — Vite's __vitePreload
 *      resolves modulepreload hrefs against the page origin, so an uncleaned capture bakes
 *      http://localhost:PORT into 7-14 hints per page; vercel.json's `default-src 'self'`
 *      CSP then blocks every one of them in production. prerender.mjs's
 *      cleanPrerenderedHtml() strips it; this asserts the strip actually ran.
 *
 * Usage: node scripts/check-rendered-html.mjs [targetDir]   (default: apps/web/dist)
 * Bypass: SKIP_RENDER_GUARD=1  (emergency escape hatch)
 */
import {readFileSync, existsSync} from 'node:fs';
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
 * Collect every reason `targetDir` fails the guard. Pure apart from reading the
 * filesystem — returns the full offender list rather than throwing on the first,
 * so one build-and-deploy cycle surfaces every problem (the check-sourcemaps.mjs
 * convention).
 *
 * @param {string} targetDir - build output root to inspect
 * @param {Array<{id: number, fullName: string}>} samples - card pages to verify
 * @param {(card: object) => string} cardPath - the engine's slug-path builder
 * @returns {Array<{file: string, reason: string}>} empty when the build is sound
 */
export function findOffenders(targetDir, samples, cardPath) {
  const offenders = [];

  // Distinguish "wrong path" from "bad crawl" before anything else. Without this,
  // a mistyped targetDir reports every sampled page as missing and blocks the
  // deploy for a reason that has nothing to do with the prerender — the most
  // expensive kind of false positive for a gate that runs on every release.
  if (!existsSync(targetDir)) {
    return [
      {file: targetDir, reason: 'target directory does not exist (wrong path, not a failed crawl)'},
    ];
  }

  for (const card of samples) {
    const route = cardPath(card);
    const file = join(targetDir, route, 'index.html');

    if (!existsSync(file)) {
      offenders.push({file, reason: 'prerendered card page missing (crawl did not run?)'});
      continue;
    }

    const html = readFileSync(file, 'utf8');

    // The card's own name is the cheapest proof that real content rendered: an SPA
    // shell contains the app skeleton and nothing card-specific.
    if (!html.includes(card.fullName)) {
      offenders.push({
        file,
        reason: `does not contain its card name "${card.fullName}" (empty shell?)`,
      });
    }

    // #486's central acceptance criterion: every route self-references. A homepage
    // canonical here means the SPA fallback was served instead of a prerendered file.
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
    const expected = `${SITE_ORIGIN}${route}`;
    if (canonical !== expected) {
      offenders.push({
        file,
        reason: `canonical is "${canonical ?? '(none)'}", expected "${expected}"`,
      });
    }

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
    if (html.includes('localhost')) {
      offenders.push({
        file,
        reason: "contains 'localhost' — the crawl server's origin leaked into shipped HTML",
      });
    }
  }

  // /browse is the corpus hub; if it links no cards, the crawl produced a shell
  // there even if the sampled card pages happened to render.
  const browseFile = join(targetDir, 'browse', 'index.html');
  if (!existsSync(browseFile)) {
    offenders.push({file: browseFile, reason: 'prerendered /browse missing'});
  } else if (!readFileSync(browseFile, 'utf8').includes('href="/card/')) {
    offenders.push({file: browseFile, reason: 'links no /card/ URLs (empty shell?)'});
  }

  return offenders;
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

  const offenders = findOffenders(targetDir, samples, cardPath);

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

  console.log(
    `✓ Prerendered HTML verified in "${targetDir}" (${samples.length} card page(s) + /browse).`,
  );
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('✖ Render guard crashed:', err?.message ?? err);
    process.exit(1);
  });
}
