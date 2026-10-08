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
 * build:vercel passes --force (#750). card-images-raw/ is git-ignored, so a deploy
 * checkout holds a raw only when admin has just committed it, and that raw is newer
 * than any AVIF already there. Skipping it shipped the old art: the conversion
 * workflow's own commit is [skip ci] and starts no deploy.
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

/**
 * Convert one raw file to its AVIF variants, or skip if they already exist.
 * Returns 'converted' | 'skipped' | 'failed'. A non-numeric stem or a sharp
 * error is a failure — its raw is kept as the retry source.
 */
async function ensureAvifs(file) {
  const stem = path.basename(file, path.extname(file));
  if (!/^\d+$/.test(stem)) {
    console.error(`  x ${file}: filename stem must be numeric card id (got "${stem}")`);
    return 'failed';
  }
  if (!FORCE && allVariantsExist(stem)) return 'skipped';
  try {
    await convert(stem, path.join(RAW_DIR, file));
    return 'converted';
  } catch (err) {
    console.error(`  x ${file}: ${err.message}`);
    return 'failed';
  }
}

/**
 * With --prune-raw, delete a consumed raw once its AVIFs are on disk; returns
 * true only if the raw was removed. A failed conversion keeps its raw, and a
 * filesystem error is logged (except ENOENT) but never aborts the batch: the
 * AVIFs are already written, which is what matters.
 */
function pruneRaw(file, status) {
  if (!PRUNE_RAW || status === 'failed') return false;
  try {
    fs.unlinkSync(path.join(RAW_DIR, file));
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`  ! ${file}: could not prune raw: ${err.message}`);
    }
    return false;
  }
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

  const tally = {converted: 0, skipped: 0, failed: 0};
  let pruned = 0;
  const startTime = Date.now();

  for (const file of files) {
    const status = await ensureAvifs(file);
    tally[status]++;
    if (pruneRaw(file, status)) pruned++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${tally.converted} converted, ${tally.skipped} skipped (exists), ${tally.failed} failed` +
      (PRUNE_RAW ? `, ${pruned} raw pruned` : '') +
      '\n',
  );

  if (tally.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
