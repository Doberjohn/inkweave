#!/usr/bin/env node
/**
 * Cloudflare interactive-challenge variant of the preview image downloader.
 *
 * lorcanaplayer.com now serves Cloudflare's INTERACTIVE managed challenge
 * ("Just a moment…"), which does not auto-solve under automation — bundled
 * Chromium and even a real Edge get held on the challenge with a 403 and no
 * cf_clearance cookie. So this drives a REAL Edge browser with a PERSISTENT
 * profile, pauses for a human to click the challenge once, then downloads every
 * image by fetching it from inside the cleared page (so each request carries the
 * cf_clearance cookie + same-origin referer). The profile persists on disk, so
 * later runs reuse the clearance and skip the manual step.
 *
 * Same output + naming as before: card-images-raw/{id}.{ext}
 *
 * Run from a checkout WITH dependencies installed:
 *   node scripts/download-preview-images.mjs
 *   node scripts/download-preview-images.mjs 13005 13136   # subset of ids
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// @playwright/test is an apps/web devDependency, not a root one. This script
// lives at the repo root, so resolve Playwright from apps/web explicitly —
// otherwise a root-level `node scripts/…` invocation can't find it
// (ERR_MODULE_NOT_FOUND walking up from scripts/ -> root/node_modules).
const requireFromWeb = createRequire(path.join(ROOT, 'apps/web/package.json'));
const {chromium} = await import(pathToFileURL(requireFromWeb.resolve('@playwright/test')).href);
const PREVIEW_JSON = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const OUT_DIR = path.join(ROOT, 'apps/web/public/card-images-raw');
const PROFILE_DIR = path.join(os.tmpdir(), 'inkweave-lorcanaplayer-profile');
const HOME = 'https://lorcanaplayer.com/';

const extOf = (url) => (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Decide whether Cloudflare's challenge has been cleared and it's safe to start
 * downloading. Called repeatedly (every 2s) while the human solves the "Just a
 * moment…" challenge in the open Edge window.
 *
 * @param {import('@playwright/test').BrowserContext} ctx - cookies live here:
 *        `await ctx.cookies()` -> array of {name, value, ...}. Cloudflare sets a
 *        cookie named 'cf_clearance' once the challenge passes.
 * @param {import('@playwright/test').Page} page - the homepage tab.
 *        `await page.title()` is "Just a moment…" while still challenged.
 * @returns {Promise<boolean>} true once it's safe to begin downloading.
 */
async function isChallengeSolved(ctx, page) {
  const cookies = await ctx.cookies();
  const hasClearance = cookies.some((c) => c.name === 'cf_clearance' && c.value);
  if (!hasClearance) return false; // no clearance cookie yet → still challenged
  const title = await page.title();
  return !/just a moment/i.test(title); // cleared once the interstitial is gone
}

async function waitForClearance(ctx, page) {
  const DEADLINE = Date.now() + 180000; // 3 minutes for the human to click
  console.log('\n  >>> An Edge window is open on lorcanaplayer.com.');
  console.log('  >>> If you see "Just a moment…" or a checkbox, solve it now.');
  console.log('  >>> Waiting for the challenge to clear (up to 3 min)…\n');
  while (Date.now() < DEADLINE) {
    try {
      if (await isChallengeSolved(ctx, page)) return true;
    } catch { /* page may be mid-navigation during the challenge */ }
    await sleep(2000);
  }
  return false;
}

async function fetchImage(page, url) {
  // Fetch inside the page so the request uses the browser's real network stack
  // (TLS fingerprint Cloudflare expects) and carries cf_clearance + referer.
  const result = await page.evaluate(async (u) => {
    const res = await fetch(u, {credentials: 'include'});
    if (!res.ok) return {error: `HTTP ${res.status}`};
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return {error: `not an image (${ct || 'unknown'})`};
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return {b64: btoa(bin)};
  }, url);
  if (result.error) throw new Error(result.error);
  return Buffer.from(result.b64, 'base64');
}

// Download every card's image into OUT_DIR, skipping ones already on disk.
// Extracted from main() so each stays simple (CodeScene CC gate).
async function downloadCards(page, cards) {
  let ok = 0, skipped = 0, failed = 0;
  for (const card of cards) {
    const url = card.images?.full;
    if (!url) { console.warn(`  - ${card.id}: no images.full`); failed++; continue; }
    const out = path.join(OUT_DIR, `${card.id}.${extOf(url)}`);
    if (fs.existsSync(out)) { skipped++; continue; }
    try {
      const buf = await fetchImage(page, url);
      fs.writeFileSync(out, buf);
      ok++;
      console.log(`  + ${card.id} ${card.fullName} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`  x ${card.id} ${card.fullName}: ${err.message}`);
      failed++;
    }
    await sleep(300);
  }
  return {ok, skipped, failed};
}

async function main() {
  const onlyIds = new Set(process.argv.slice(2));
  const all = JSON.parse(fs.readFileSync(PREVIEW_JSON, 'utf8')).cards;
  const cards = all.filter((c) => onlyIds.size === 0 || onlyIds.has(String(c.id)));
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: {width: 1280, height: 800},
    // Strip the automation fingerprints Cloudflare's Turnstile uses to re-loop
    // the challenge: the AutomationControlled blink feature, plus the default
    // --enable-automation switch (which flips navigator.webdriver to true).
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  // Belt-and-suspenders: hide navigator.webdriver before any page script runs.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(HOME, {waitUntil: 'domcontentloaded', timeout: 60000});

  if (!(await waitForClearance(ctx, page))) {
    console.error('  Challenge not cleared in time — aborting.');
    await ctx.close();
    process.exit(1);
  }
  console.log('  Cloudflare cleared. Starting downloads…');
  console.log(`\n  Downloading ${cards.length} image(s) -> ${path.relative(ROOT, OUT_DIR)}/\n`);

  const {ok, skipped, failed} = await downloadCards(page, cards);

  await ctx.close();
  console.log(`\n  Done: ${ok} downloaded, ${skipped} skipped, ${failed} failed`);
  if (ok > 0) console.log(`  Next: pnpm convert-preview-images\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
