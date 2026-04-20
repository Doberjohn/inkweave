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
 * Usage:
 *   pnpm convert-preview-images           # Convert all missing
 *   pnpm convert-preview-images --force   # Re-convert everything
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'apps/web/public/card-images-raw');
const OUT_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');
const PREVIEW_JSON = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const FORCE = process.argv.includes('--force');

const SIZES = [
  {suffix: '', width: 337, height: 470},
  {suffix: '-sm', width: 191, height: 266},
];
const QUALITY = 50;
const ACCEPTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Location cards are stored as 337x470 portrait AVIFs with content pre-rotated
// 90deg, because the app unconditionally CSS-rotates them 90deg at render time.
// Source JPGs for Set 12 Locations are landscape (natural reading orientation),
// so we rotate 90deg before resize to match the stored convention.
function loadLocationIds() {
  if (!fs.existsSync(PREVIEW_JSON)) return new Set();
  const data = JSON.parse(fs.readFileSync(PREVIEW_JSON, 'utf8'));
  return new Set(
    (data.cards || []).filter((c) => c.type === 'Location').map((c) => String(c.id)),
  );
}

async function convert(id, srcPath, isLocation) {
  for (const s of SIZES) {
    const outPath = path.join(OUT_DIR, `${id}${s.suffix}.avif`);
    let pipeline = sharp(srcPath);
    // Rotate 90deg CCW so the stored file is "sideways" — CSS rotate(90deg) CW
    // at render time then displays the card upright. Matches convention used
    // by existing Location AVIFs from the Ravensburger pipeline.
    if (isLocation) pipeline = pipeline.rotate(-90);
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

  const locationIds = loadLocationIds();

  console.log(
    `\n  Converting ${files.length} raw image(s)${FORCE ? ' [force]' : ''}` +
      ` (${locationIds.size} Location-type cards will be pre-rotated)`,
  );

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    if (!/^\d+$/.test(stem)) {
      console.error(`  x ${file}: filename stem must be numeric card id (got "${stem}")`);
      failed++;
      continue;
    }
    const id = stem;

    if (!FORCE && allVariantsExist(id)) {
      skipped++;
      continue;
    }

    try {
      await convert(id, path.join(RAW_DIR, file), locationIds.has(id));
      converted++;
    } catch (err) {
      console.error(`  x ${file}: ${err.message}`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${converted} converted, ${skipped} skipped (exists), ${failed} failed\n`,
  );

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
