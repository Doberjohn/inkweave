import {createRequire} from 'module';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {mkdirSync, writeFileSync, statSync, readFileSync, existsSync} from 'fs';
import {spawn, execFileSync} from 'child_process';

/**
 * Marketing-banner exporter. Given a card id, renders every carousel page of its synergy
 * breakdown (via the /banner/:cardId route) and writes shareable images to
 * reports/banners/<id>/:
 *   - <slug>-page-N.png         full-res 3600x3720 lossless  (Reddit)
 *   - <slug>-page-N-fb2048.jpg  2048px wide, 4:4:4 JPEG      (Facebook)
 *
 * Reuses a dev server already on :5173, otherwise starts a throwaway Vite and stops it after.
 * Usage: pnpm banner <cardId>        e.g. pnpm banner 2983
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repoRoot, 'apps/web/package.json'));
const {chromium} = require('playwright');
const sharp = require('sharp');

// Mirror BannerPage.tsx: at most MAX_GROUPS synergies shown, ROWS_PER_PAGE rows per page.
const MAX_GROUPS = 6;
const ROWS_PER_PAGE = 3;
const PORT = 5173;
const DSF = 3; // deviceScaleFactor -> 1200x1240 stage renders at 3600x3720
const FB_WIDTH = 2048;

/**
 * How many carousel pages to render for a card with `groupCount` synergy groups.
 * Must match BannerPage's slicing (MAX_GROUPS shown, ROWS_PER_PAGE per page) so the export
 * renders exactly the pages the route produces — never a blank or duplicated page.
 */
function pageCountForGroups(groupCount) {
  const shown = Math.min(groupCount, MAX_GROUPS);
  return Math.max(1, Math.ceil(shown / ROWS_PER_PAGE));
}

const cardId = process.argv[2];
if (!cardId) {
  console.error('Usage: pnpm banner <cardId>   (e.g. pnpm banner 2983)');
  process.exit(1);
}

const synergyFile = join(repoRoot, 'apps/web/public/data/synergies', `${cardId}.json`);
if (!existsSync(synergyFile)) {
  console.error(`No precomputed synergies for card ${cardId} at ${synergyFile}.`);
  console.error('Run `pnpm precompute-synergies` first, and check the card id.');
  process.exit(1);
}
const groupCount = JSON.parse(readFileSync(synergyFile, 'utf8')).groups.length;
const pages = pageCountForGroups(groupCount);

// Friendly file slug from the card's full name.
const allCards = JSON.parse(readFileSync(join(repoRoot, 'apps/web/public/data/allCards.json'), 'utf8'));
const cardArr = Array.isArray(allCards) ? allCards : allCards.cards ?? [];
const fullName = cardArr.find((c) => String(c.id) === String(cardId))?.fullName ?? `card-${cardId}`;
const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const outDir = join(repoRoot, 'reports/banners', String(cardId));
mkdirSync(outDir, {recursive: true});

const url = (p) => `http://localhost:${PORT}/banner/${cardId}?page=${p}`;
const up = async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/`)).ok;
  } catch {
    return false;
  }
};

let server = null;
async function ensureServer() {
  if (await up()) return false; // reuse a running dev server; don't stop it
  console.log('Starting a throwaway Vite dev server on :' + PORT + ' …');
  server = spawn('pnpm', ['--filter', 'inkweave-web', 'exec', 'vite', '--strictPort', '--port', String(PORT)], {
    cwd: repoRoot,
    shell: true,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    if (await up()) return true;
    await new Promise((r) => globalThis.setTimeout(r, 1000));
  }
  throw new Error('Vite did not come up on :' + PORT + ' within 60s.');
}
function stopServer() {
  if (!server) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {stdio: 'ignore'});
    else server.kill('SIGTERM');
  } catch {
    /* best effort */
  }
}

async function run() {
  const ownServer = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1320, height: 1320}, deviceScaleFactor: DSF});
  const written = [];
  try {
    for (let p = 1; p <= pages; p++) {
      await page.goto(url(p), {waitUntil: 'domcontentloaded', timeout: 45000});
      await page.waitForSelector('.banner-stage', {timeout: 45000});
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) => (img.complete ? null : new Promise((res) => (img.onload = img.onerror = res)))),
        );
        for (const el of document.querySelectorAll('body *')) {
          const s = getComputedStyle(el);
          if (s.position === 'fixed' && !el.closest('.banner-stage')) el.style.setProperty('display', 'none', 'important');
        }
      });
      await page.waitForTimeout(500);
      const png = await page.locator('.banner-stage').screenshot({type: 'png'});
      const pngPath = join(outDir, `${slug}-page-${p}.png`);
      writeFileSync(pngPath, png);
      const fbPath = join(outDir, `${slug}-page-${p}-fb2048.jpg`);
      await sharp(png).resize({width: FB_WIDTH}).jpeg({quality: 90, chromaSubsampling: '4:4:4'}).toFile(fbPath);
      written.push(pngPath, fbPath);
      console.log(`page ${p}/${pages} done`);
    }
  } finally {
    await browser.close();
    if (ownServer) stopServer();
  }

  console.log(`\n${fullName} — ${pages} page(s), ${groupCount} synergy groups`);
  for (const f of written) console.log(`  ${Math.round(statSync(f).size / 1024)} KB\t${f}`);
  console.log('\nReddit: the .png files   |   Facebook: the -fb2048.jpg files');
}

run().catch((e) => {
  stopServer();
  console.error(e.message);
  process.exit(1);
});
