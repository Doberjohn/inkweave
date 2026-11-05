/**
 * Draws every card's link preview image (#1133) into apps/web/dist/og/card/, for
 * scripts/prerender.mjs to write into each card page's og:image and twitter:image.
 *
 * Runs in build:vercel after `pnpm build:web` and before the crawl, in the Chromium the crawl
 * installs: it reads the build's own card data, synergy files, fonts and card art, so every image
 * matches the deploy it ships in. Each image is scripts/og/card-template.html filled with
 * cardOgData (scripts/lib/cardOgImage.mjs) and saved as a JPEG named by a hash of its bytes.
 *
 * A card it can't draw keeps the site banner, and check 12 of scripts/check-rendered-html.mjs
 * then fails the deploy naming it. build:vercel runs the crawl whether this succeeds or not, and
 * this writes what it drew even when a drawing page fails to open, so one failure costs only its
 * own cards. The record is apps/web/node_modules/.cache/og-cards.json, `{[id]: {file, alt}}`,
 * which the crawl reads. That stays out of dist, so the deploy doesn't serve it.
 *
 * SKIP_PRERENDER=1 skips it with the crawl: staging is never indexed or shared (#741).
 */
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  OG_CARD_DIR,
  OG_IMAGE_SIZE,
  OG_MANIFEST,
  cardOgData,
  ogFileName,
  ogImageAlt,
} from './lib/cardOgImage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/web/dist');
const TEMPLATE = join(ROOT, 'scripts/og/card-template.html');
const require = createRequire(join(ROOT, 'apps/web/package.json'));
const {chromium} = require('@playwright/test');

// A made-up origin the pages load from: the template at its root, every other path from dist,
// so the template names fonts and art by the paths the site serves them on.
const ORIGIN = 'https://og-render.invalid';
const PAGES = 4;
const ATTEMPTS = 3;
const JPEG_QUALITY = 80;

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** The card's synergy file, or null: precompute writes none for a card without synergies. */
async function readSynergyFile(id) {
  const file = join(DIST, 'data', 'synergies', `${id}.json`);
  return existsSync(file) ? readJson(file) : null;
}

/** Answers the page's requests from the template and dist. */
async function serveFromDist(route) {
  const {pathname} = new URL(route.request().url());
  if (pathname === '/') return route.fulfill({path: TEMPLATE, contentType: 'text/html'});
  const file = join(DIST, decodeURIComponent(pathname));
  if (file.startsWith(DIST) && existsSync(file)) return route.fulfill({path: file});
  return route.fulfill({status: 404});
}

async function openPage(browser) {
  const page = await browser.newPage({viewport: OG_IMAGE_SIZE});
  await page.route(`${ORIGIN}/**`, serveFromDist);
  await page.goto(`${ORIGIN}/`);
  return page;
}

/** One card's JPEG, tried ATTEMPTS times: an image that fails to decode rejects fillCard. */
async function drawCard(page, data) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const {fits} = await page.evaluate((card) => window.fillCard(card), data);
      const jpeg = await page.screenshot({type: 'jpeg', quality: JPEG_QUALITY});
      return {jpeg, fits};
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const firstLine = (error) => String(error?.message ?? error).split('\n')[0];

/** Draws one card and saves its image, recording it in `result`. */
async function drawJob(page, {card, data}, result) {
  try {
    const {jpeg, fits} = await drawCard(page, data);
    const file = ogFileName(card.id, jpeg);
    await writeFile(join(DIST, OG_CARD_DIR, file), jpeg);
    result.manifest[card.id] = {file, alt: ogImageAlt(card, data)};
    result.bytes += jpeg.length;
    if (!fits) result.tight.push(card.fullName);
  } catch (error) {
    result.failed.push(`${card.fullName} (${firstLine(error)})`);
  }
}

/**
 * Draws `jobs` on PAGES pages at once. A page that fails to open leaves its share to the others,
 * and nothing ends the run early, so every card a page could draw is kept.
 */
async function drawAll(browser, jobs, result) {
  let next = 0;
  const worker = async () => {
    const page = await openPage(browser).catch((error) => {
      console.warn(`[og] a drawing page failed to open: ${firstLine(error)}`);
    });
    if (!page) return;
    while (next < jobs.length) await drawJob(page, jobs[next++], result);
    await page.close();
  };
  await Promise.all(Array.from({length: PAGES}, worker));
}

/** What each card's image shows; a card without art has nothing to draw. */
async function planJobs(cards) {
  const cardsById = new Map(cards.map((card) => [String(card.id), card]));
  const drawable = cards.filter((card) => card.imageHash);
  return Promise.all(
    drawable.map(async (card) => ({
      card,
      data: cardOgData(card, await readSynergyFile(card.id), cardsById),
    })),
  );
}

function report({manifest, bytes, failed, tight}, cards, seconds) {
  const count = Object.keys(manifest).length;
  const mib = (bytes / 1024 / 1024).toFixed(1);
  console.log(`[og] ${count} of ${cards.length} card images, ${mib} MiB, in ${seconds} s`);
  const noArt = cards.filter((card) => !card.imageHash).map((card) => card.fullName);
  if (noArt.length > 0) console.warn(`[og] no card art, so no image: ${noArt.join('; ')}`);
  if (tight.length > 0)
    console.warn(`[og] text squeezed past the smallest size: ${tight.join('; ')}`);
  if (failed.length > 0)
    console.warn(`[og] FAILED, these pages keep the site banner: ${failed.join('; ')}`);
}

async function main() {
  if (process.env.SKIP_PRERENDER === '1') {
    console.log('[og] skipped with the crawl (SKIP_PRERENDER=1)');
    return;
  }
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[og] apps/web/dist not found: run `pnpm build:web` first');
    process.exit(1);
  }
  const started = Date.now();
  // An earlier build's record names files this build doesn't have: never let the crawl read it.
  await rm(join(ROOT, OG_MANIFEST), {force: true});
  const {cards} = await readJson(join(DIST, 'data', 'allCards.json'));
  const jobs = await planJobs(cards);
  await rm(join(DIST, OG_CARD_DIR), {recursive: true, force: true});
  await mkdir(join(DIST, OG_CARD_DIR), {recursive: true});

  const result = {manifest: {}, bytes: 0, failed: [], tight: []};
  // Partial raster repaints only the part of a tile that changed, which antialiases the logo's
  // masks differently from run to run, so a card that didn't change would get a new hash.
  const browser = await chromium.launch({args: ['--disable-partial-raster']});
  try {
    await drawAll(browser, jobs, result);
  } finally {
    await mkdir(dirname(join(ROOT, OG_MANIFEST)), {recursive: true});
    await writeFile(join(ROOT, OG_MANIFEST), JSON.stringify(result.manifest));
    await browser.close();
  }
  report(result, cards, Math.round((Date.now() - started) / 1000));
}

// Run only when invoked directly (never when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
