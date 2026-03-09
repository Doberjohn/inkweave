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
const IMAGE_WIDTH = 337;
const IMAGE_HEIGHT = 470;
const MAX_RETRIES = 2;
const FORCE = process.argv.includes('--force');

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
  const filename = `${task.id}.avif`;
  const cachePath = path.join(CACHE_DIR, filename);
  const outPath = path.join(OUTPUT_DIR, filename);

  // Check cache (skip if already converted)
  if (!FORCE && fs.existsSync(cachePath)) {
    if (!fs.existsSync(outPath)) {
      fs.copyFileSync(cachePath, outPath);
    }
    return 'cached';
  }

  // Download JPEG from Ravensburger
  const buffer = await downloadWithRetry(task.url);

  // Resize to 337×470 and convert to AVIF
  await sharp(buffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {fit: 'cover'})
    .avif({quality: IMAGE_QUALITY})
    .toFile(cachePath);

  // Copy to output
  fs.copyFileSync(cachePath, outPath);
  return 'downloaded';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  fs.mkdirSync(CACHE_DIR, {recursive: true});

  // Migrate old cache naming ({id}-thumb.avif / {id}-full.avif → {id}.avif)
  // so existing Vercel cache produces hits instead of re-downloading everything.
  for (const file of fs.readdirSync(CACHE_DIR)) {
    const match = file.match(/^(\d+)-(thumb|full)\.avif$/);
    if (match) {
      const newName = `${match[1]}.avif`;
      const newPath = path.join(CACHE_DIR, newName);
      if (!fs.existsSync(newPath)) {
        fs.renameSync(path.join(CACHE_DIR, file), newPath);
      }
    }
  }

  // Clean output dir to remove stale files from previous naming schemes
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
