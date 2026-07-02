#!/usr/bin/env node
/**
 * Convert raw preview card images to AVIF variants.
 *
 * Reads files from apps/web/public/card-images-raw/ named by card id
 * (e.g., 1215204.jpg). For each file, generates two AVIFs into
 * apps/web/public/card-images-preview/:
 *   {id}.avif      — 337x470 (grid / detail)
 *   {id}-sm.avif   — 191x266 (browse grid tiles)
 *
 * Idempotent — skips cards whose AVIFs already exist unless --force.
 *
 * With --prune-raw, each source raw is deleted once its AVIFs are on disk, so the
 * CI conversion workflow leaves no tracked raw behind (see issue #420).
 *
 * Usage:
 *   pnpm convert-preview-images              # Convert all missing
 *   pnpm convert-preview-images --force      # Re-convert everything
 *   pnpm convert-preview-images --prune-raw  # Convert, then delete each consumed raw
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'apps/web/public/card-images-raw');
const OUT_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');
const FORCE = process.argv.includes('--force');
const PRUNE_RAW = process.argv.includes('--prune-raw');

const SIZES = [
  {suffix: '', width: 337, height: 470},
  {suffix: '-sm', width: 191, height: 266},
];
const QUALITY = 50;
const ACCEPTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function convert(id, srcPath) {
  // Location cards print landscape (wider than tall); the slots and grid are
  // portrait, so rotate landscape sources 270° (counter-clockwise) before the
  // portrait resize. Otherwise `fit: cover` crops them to a sideways centre
  // strip. Character/item/action sources are already portrait and pass through
  // untouched. The rotation is baked into the AVIF (not applied at display time)
  // and the production build copies these AVIFs byte-for-byte, so it carries to
  // prod without any further handling.
  const meta = await sharp(srcPath).metadata();
  const isLandscape = (meta.width ?? 0) > (meta.height ?? 0);

  for (const s of SIZES) {
    const outPath = path.join(OUT_DIR, `${id}${s.suffix}.avif`);
    const pipeline = sharp(srcPath);
    if (isLandscape) pipeline.rotate(270);
    await pipeline
      .resize(s.width, s.height, {fit: 'cover'})
      .avif({quality: QUALITY})
      .toFile(outPath);
  }
}

function allVariantsExist(id) {
  return SIZES.every((s) => fs.existsSync(path.join(OUT_DIR, `${id}${s.suffix}.avif`)));
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.log(`  No raw directory at ${RAW_DIR}. Nothing to do.`);
    return;
  }
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const files = fs.readdirSync(RAW_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ACCEPTED_EXT.has(ext);
  });

  if (files.length === 0) {
    console.log(`  No image files in ${RAW_DIR}. Nothing to do.`);
    return;
  }

  console.log(
    `\n  Converting ${files.length} raw image(s)${FORCE ? ' [force]' : ''}`,
  );

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let pruned = 0;
  const startTime = Date.now();

  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    if (!/^\d+$/.test(stem)) {
      console.error(`  x ${file}: filename stem must be numeric card id (got "${stem}")`);
      failed++;
      continue;
    }
    const id = stem;
    const rawPath = path.join(RAW_DIR, file);

    // Whether this card's AVIFs are on disk after this iteration — either they
    // already existed (skip) or we just wrote them (convert). Only a raw whose
    // AVIFs are ready is safe to prune; a failed conversion keeps its raw.
    let avifsReady = false;
    if (!FORCE && allVariantsExist(id)) {
      skipped++;
      avifsReady = true;
    } else {
      try {
        await convert(id, rawPath);
        converted++;
        avifsReady = true;
      } catch (err) {
        console.error(`  x ${file}: ${err.message}`);
        failed++;
      }
    }

    if (PRUNE_RAW && avifsReady) {
      try {
        fs.unlinkSync(rawPath);
        pruned++;
      } catch (err) {
        // ENOENT just means the raw is already gone (idempotent re-run); any
        // other error is worth surfacing, but a prune failure must never abort
        // the batch — the AVIFs are already written, which is what matters.
        if (err.code !== 'ENOENT') {
          console.error(`  ! ${file}: could not prune raw: ${err.message}`);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${converted} converted, ${skipped} skipped (exists), ${failed} failed` +
      (PRUNE_RAW ? `, ${pruned} raw pruned` : '') +
      '\n',
  );

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
