/**
 * Draws the link preview images: every card's (#1133) into apps/web/dist/og/card/, and the home
 * page's, each playstyle page's and, in reveal season, /reveals' (#1135) into
 * apps/web/dist/og/page/, for scripts/prerender.mjs to write into each page's og:image and
 * twitter:image. Every page without an image of its own gets the home image.
 *
 * Runs in build:vercel after `pnpm build:web` and before the crawl, in the Chromium the crawl
 * installs: it reads the build's own card data, synergy files, fonts and card art, so every image
 * matches the deploy it ships in. A card's image is scripts/og/card-template.html filled with
 * cardOgData (scripts/lib/cardOgImage.mjs), a page's is scripts/og/page-template.html filled from
 * scripts/lib/pageOgImage.mjs, and each is saved as a JPEG named by a hash of its bytes.
 *
 * An image it can't draw is left out: its page keeps the site banner (a page other than a card
 * gets the home image, unless that one failed too), and check 12 or 13 of
 * scripts/check-rendered-html.mjs then fails the deploy naming it. build:vercel runs the crawl
 * whether this succeeds or not, and this writes what it drew even when a drawing page fails to
 * open, so one failure costs only its own images. The records are
 * apps/web/node_modules/.cache/og-cards.json, `{[id]: {file, alt}}`, and og-pages.json beside it,
 * `{[route]: {file, alt}}`, which the crawl reads. They stay out of dist, so the deploy doesn't
 * serve them.
 *
 * SKIP_PRERENDER=1 skips it with the crawl: staging is never indexed or shared (#741).
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
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
import {
  OG_PAGE_DIR,
  OG_PAGE_MANIFEST,
  PLAYSTYLE_UI_FILE,
  REVEAL_SET_FILE,
  homeOgData,
  pageOgKey,
  parsePlaystyleUi,
  parseRevealSet,
  playstyleOgData,
  revealSeasonSet,
  revealsOgData,
} from './lib/pageOgImage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/web/dist');
const CARD_TEMPLATE = join(ROOT, 'scripts/og/card-template.html');
const PAGE_TEMPLATE = join(ROOT, 'scripts/og/page-template.html');
const CATALOG = join(ROOT, 'packages/synergy-engine/dist/catalog.json');
const require = createRequire(join(ROOT, 'apps/web/package.json'));
const {chromium} = require('@playwright/test');

// A made-up origin the pages load from: a template at its root, every other path from dist, so
// the templates name fonts and art by the paths the site serves them on.
const ORIGIN = 'https://og-render.invalid';
const PAGES = 4;
const ATTEMPTS = 3;
const JPEG_QUALITY = 80;

// Read one at a time: about 1,200 synergy files read at once can run out of file descriptors.
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** The card's synergy file, or null: precompute writes none for a card without synergies. */
function readSynergyFile(id) {
  const file = join(DIST, 'data', 'synergies', `${id}.json`);
  return existsSync(file) ? readJson(file) : null;
}

/** Answers a page's requests from `template` and dist. */
async function serveFromDist(route, template) {
  const {pathname} = new URL(route.request().url());
  if (pathname === '/') return route.fulfill({path: template, contentType: 'text/html'});
  const file = join(DIST, decodeURIComponent(pathname));
  if (file.startsWith(DIST) && existsSync(file)) return route.fulfill({path: file});
  return route.fulfill({status: 404});
}

async function openPage(browser, template) {
  const page = await browser.newPage({viewport: OG_IMAGE_SIZE});
  await page.route(`${ORIGIN}/**`, (route) => serveFromDist(route, template));
  await page.goto(`${ORIGIN}/`);
  return page;
}

/**
 * One JPEG of `page` after `window[fill](arg)`, tried ATTEMPTS times: an image that fails to
 * decode rejects the fill.
 */
async function drawImage(page, fill, arg) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const {fits} = await page.evaluate(([name, value]) => window[name](value), [fill, arg]);
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
    const {jpeg, fits} = await drawImage(page, 'fillCard', data);
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
    const page = await openPage(browser, CARD_TEMPLATE).catch((error) => {
      console.warn(`[og] a drawing page failed to open: ${firstLine(error)}`);
    });
    if (!page) return;
    while (next < jobs.length) await drawJob(page, jobs[next++], result);
    await page.close();
  };
  await Promise.all(Array.from({length: PAGES}, worker));
}

/** Draws one page's image and saves it, recording it in `result`. */
async function drawPageJob(page, {route, kind, alt, data}, result) {
  try {
    const {jpeg, fits} = await drawImage(page, 'fillPage', {kind, data});
    const file = ogFileName(pageOgKey(route), jpeg);
    await writeFile(join(DIST, OG_PAGE_DIR, file), jpeg);
    result.pages[route] = {file, alt};
    result.pageBytes += jpeg.length;
    if (!fits) result.tight.push(route);
  } catch (error) {
    result.failed.push(`${route} (${firstLine(error)})`);
  }
}

/** Draws every page's image on one page of its own. */
async function drawPages(browser, jobs, result) {
  const page = await openPage(browser, PAGE_TEMPLATE).catch((error) => {
    result.failed.push(`every page image (${firstLine(error)})`);
  });
  if (!page) return;
  for (const job of jobs) await drawPageJob(page, job, result);
  await page.close();
}

/** Each playstyle page's image, skipping one PLAYSTYLE_UI has no entry for. */
function playstyleJobs(cardsById, result) {
  const ui = parsePlaystyleUi(readFileSync(join(ROOT, PLAYSTYLE_UI_FILE), 'utf8'));
  const members = readJson(join(DIST, 'data', 'synergies', '_playstyles.json'));
  return readJson(CATALOG).playstyles.map((playstyle) => {
    const job = ui[playstyle.id]
      ? playstyleOgData({playstyle, memberIds: members[playstyle.id] ?? [], ui: ui[playstyle.id], cardsById})
      : null;
    if (!job) result.failed.push(`/playstyles/${playstyle.id} (no card to draw, or no PLAYSTYLE_UI entry)`);
    return job;
  });
}

/**
 * /reveals' image, in season only: the season's set's revealed cards, the app's and the preview
 * file's, in the order they were added. The crawl captures /reveals only in season too.
 */
function revealsJobs(cards, preview) {
  if (!preview || revealSeasonSet(preview) === null) return [];
  const {code, total} = parseRevealSet(readFileSync(join(ROOT, REVEAL_SET_FILE), 'utf8'));
  const ids = new Set(cards.map((card) => String(card.id)));
  const added = (preview.cards ?? []).filter((card) => !ids.has(String(card.id)));
  const revealed = [...cards, ...added].filter((card) => card.setCode === code);
  const name = preview.sets?.[code]?.name ?? `Set ${code}`;
  return [revealsOgData(revealed, {code, name, total})];
}

const readIfBuilt = (file) => (existsSync(file) ? readJson(file) : null);

/** Each job a part of the page images; one that throws costs only its own images. */
function planPart(label, plan, result) {
  try {
    return plan();
  } catch (error) {
    result.failed.push(`${label} (${firstLine(error)})`);
    return [];
  }
}

/** Every page image this build draws: home, each playstyle and, in season, reveals. */
function planPages(cards, cardsById, result) {
  const data = (file) => join(DIST, 'data', file);
  const parts = [
    ['/', () => [homeOgData(readJson(data('featuredCards.json')).cards.map(({id}) => id), cardsById)]],
    ['the playstyle pages', () => playstyleJobs(cardsById, result)],
    ['/reveals', () => revealsJobs(cards, readIfBuilt(data('previewCards.json')))],
  ];
  return parts.flatMap(([label, plan]) => planPart(label, plan, result)).filter(Boolean);
}

/** What each card's image shows; a card without art has nothing to draw. */
function planJobs(cards, cardsById) {
  return cards
    .filter((card) => card.imageHash)
    .map((card) => ({card, data: cardOgData(card, readSynergyFile(card.id), cardsById)}));
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(1);

function report({manifest, bytes, pages, pageBytes, failed, tight}, cards, seconds) {
  const count = Object.keys(manifest).length;
  console.log(`[og] ${count} of ${cards.length} card images, ${mib(bytes)} MiB, in ${seconds} s`);
  const routes = Object.keys(pages);
  console.log(`[og] ${routes.length} page images, ${mib(pageBytes)} MiB: ${routes.join(' ')}`);
  const noArt = cards.filter((card) => !card.imageHash).map((card) => card.fullName);
  if (noArt.length > 0) console.warn(`[og] no card art, so no image: ${noArt.join('; ')}`);
  if (tight.length > 0)
    console.warn(`[og] text squeezed past the smallest size: ${tight.join('; ')}`);
  if (failed.length > 0)
    console.warn(`[og] FAILED, so the deploy's check fails on these pages: ${failed.join('; ')}`);
}

async function writeRecords({manifest, pages}) {
  await mkdir(dirname(join(ROOT, OG_MANIFEST)), {recursive: true});
  await writeFile(join(ROOT, OG_MANIFEST), JSON.stringify(manifest));
  await writeFile(join(ROOT, OG_PAGE_MANIFEST), JSON.stringify(pages));
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
  // An earlier build's records name files this build doesn't have: never let the crawl read them.
  await Promise.all([OG_MANIFEST, OG_PAGE_MANIFEST].map((file) => rm(join(ROOT, file), {force: true})));
  const result = {manifest: {}, bytes: 0, pages: {}, pageBytes: 0, failed: [], tight: []};
  const {cards} = readJson(join(DIST, 'data', 'allCards.json'));
  const cardsById = new Map(cards.map((card) => [String(card.id), card]));
  const jobs = planJobs(cards, cardsById);
  const pageJobs = planPages(cards, cardsById, result);
  for (const dir of [OG_CARD_DIR, OG_PAGE_DIR]) {
    await rm(join(DIST, dir), {recursive: true, force: true});
    await mkdir(join(DIST, dir), {recursive: true});
  }

  // Partial raster repaints only the part of a tile that changed, which antialiases the logo's
  // masks differently from run to run, so an image that didn't change would get a new hash.
  const browser = await chromium.launch({args: ['--disable-partial-raster']});
  try {
    await Promise.all([drawPages(browser, pageJobs, result), drawAll(browser, jobs, result)]);
  } finally {
    await writeRecords(result);
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
