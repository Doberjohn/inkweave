#!/usr/bin/env node
/**
 * Downloads all card images from Ravensburger and converts to AVIF.
 *
 * Uses node_modules/.cache/card-images/ for persistence across Vercel builds
 * (pnpm cache preserves node_modules between deploys).
 *
 * Usage:
 *   pnpm download-images          # Download all missing images
 *   pnpm download-images --force  # Re-download everything
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const CACHE_DIR = path.join(ROOT, 'node_modules/.cache/card-images');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/card-images');

const CONCURRENCY = 20;
const IMAGE_QUALITY = 50;
const MAX_RETRIES = 2;
const FORCE = process.argv.includes('--force');

// Bump this to invalidate the entire cache and force re-download.
const CACHE_VERSION = '3';

// Output sizes: full (popover/detail) and small (grid tiles)
const SIZES = [
  {suffix: '', width: 337, height: 470},
  {suffix: '-sm', width: 191, height: 266},
];

async function downloadWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === retries) throw err;
      // Brief backoff before retry
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function processTask(task) {
  const firstFile = `${task.id}.avif`;
  const firstCachePath = path.join(CACHE_DIR, firstFile);

  // Check cache — if the primary file exists, all sizes were generated together
  if (!FORCE && fs.existsSync(firstCachePath)) {
    for (const size of SIZES) {
      const filename = `${task.id}${size.suffix}.avif`;
      const cachePath = path.join(CACHE_DIR, filename);
      const outPath = path.join(OUTPUT_DIR, filename);
      if (fs.existsSync(cachePath) && !fs.existsSync(outPath)) {
        fs.copyFileSync(cachePath, outPath);
      }
    }
    return 'cached';
  }

  // Download JPEG from Ravensburger
  const buffer = await downloadWithRetry(task.url);

  // Generate all sizes
  for (const size of SIZES) {
    const filename = `${task.id}${size.suffix}.avif`;
    const cachePath = path.join(CACHE_DIR, filename);
    const outPath = path.join(OUTPUT_DIR, filename);
    await sharp(buffer)
      .resize(size.width, size.height, {fit: 'cover'})
      .avif({quality: IMAGE_QUALITY})
      .toFile(cachePath);
    fs.copyFileSync(cachePath, outPath);
  }
  return 'downloaded';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Invalidate cache when CACHE_VERSION changes (e.g., switching image source or quality)
  const versionFile = path.join(CACHE_DIR, '.version');
  const currentVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8') : '';
  if (currentVersion !== CACHE_VERSION) {
    console.log(
      `  Cache version changed (${currentVersion || 'none'} → ${CACHE_VERSION}), clearing cache...`,
    );
    fs.rmSync(CACHE_DIR, {recursive: true, force: true});
  }
  fs.mkdirSync(CACHE_DIR, {recursive: true});
  fs.writeFileSync(versionFile, CACHE_VERSION);

  // Clean output dir
  fs.rmSync(OUTPUT_DIR, {recursive: true, force: true});
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});

  // Build task list — one image per card (use full-size source for best quality when resizing)
  const tasks = [];
  for (const card of data.cards) {
    const url = card.images?.full ?? card.images?.thumbnail;
    if (url) {
      tasks.push({id: card.id, url});
    }
  }

  console.log(
    `\n  ${tasks.length} images (${data.cards.length} cards)${FORCE ? ' [force re-download]' : ''}`,
  );

  let cached = 0;
  let downloaded = 0;
  let failed = 0;
  const startTime = Date.now();

  // Process in batches with concurrency limit
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((task) => processTask(task)));

    for (const [idx, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        if (result.value === 'cached') cached++;
        else downloaded++;
      } else {
        failed++;
        console.error(`  x ${batch[idx].id}: ${result.reason.message}`);
      }
    }

    const total = cached + downloaded + failed;
    if (total % 200 === 0 || i + CONCURRENCY >= tasks.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ${total}/${tasks.length} (${cached} cached, ${downloaded} new, ${failed} failed) [${elapsed}s]`,
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${downloaded} downloaded, ${cached} from cache, ${failed} failed\n`,
  );

  if (failed > 0) {
    console.error(`  Warning: ${failed} images failed to download. Cards will show fallback UI.\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
