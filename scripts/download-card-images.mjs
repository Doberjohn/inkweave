#!/usr/bin/env node
/**
 * Downloads all card images from Ravensburger and converts to AVIF.
 *
 * Output URLs are content-addressed: each AVIF lands at
 * `apps/web/public/card-images/{id}.{hash}.avif` (full) and
 * `apps/web/public/card-images/{id}.{hash}-sm.avif` (small). The hash is a
 * sha256 prefix of the AVIF bytes, so any change to the bytes produces a new
 * URL — making the `Cache-Control: public, max-age=31536000, immutable`
 * header at vercel.json:14-23 truthful. See issue #323 for the design.
 *
 * Hashes are recorded in a manifest during the build, then injected into
 * `apps/web/public/data/allCards.json` and `previewCards.json` as
 * `imageHash` + `imageHashSm` fields. The web loader reads those at runtime.
 *
 * Cache: `node_modules/.cache/card-images/` keeps unhashed filenames. It is a
 * build-speed cache that skips re-conversion across deploys: Vercel's build
 * servers keep node_modules between builds, and the production deploy in
 * .github/workflows/deploy.yml restores it with actions/cache. Hashing happens
 * at the cache → output boundary.
 *
 * Usage:
 *   pnpm download-images          # Download all missing images
 *   pnpm download-images --force  # Re-download everything
 */
import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const CACHE_DIR = path.join(ROOT, 'node_modules/.cache/card-images');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/card-images');
const PREVIEW_AVIFS_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');

const CONCURRENCY = 20;
const IMAGE_QUALITY = 50;
const MAX_RETRIES = 2;
const FORCE = process.argv.includes('--force');

// Bump this to invalidate the entire cache and force re-download.
// Note: the cache holds unhashed AVIF bytes; output filename hashing happens
// at the cache→output boundary so the cache stays valid across hash-policy changes.
const CACHE_VERSION = '3';

// Image-coverage guard: fail the build if any set is missing image hashes for too
// many of its cards. A few individually-rotted Ravensburger URLs are tolerated
// (non-fatal above → fallback UI), but a whole set with no images (e.g. a freshly
// graduated set whose downloads all failed) must NOT ship: without imageHash,
// resolveImageUrl returns undefined and every card in that set renders blank in
// the production (VITE_LOCAL_IMAGES) build. See apps/web/src/features/cards/loader.ts
// and issue #323.
const SET_COVERAGE_FLOOR = 0.75; // a set below this hashed fraction fails the build
const SET_MIN_CARDS_TO_CHECK = 12; // ignore tiny sets where a couple misses skew the ratio

// Output sizes: full (popover/detail) and small (grid tiles).
// `key` is the manifest property surfaced in card data as `imageHash` (full)
// and `imageHashSm` (small).
const SIZES = [
  {suffix: '', width: 337, height: 470, key: 'full'},
  {suffix: '-sm', width: 191, height: 266, key: 'sm'},
];

/**
 * Derive a content-addressed hash suffix for an AVIF buffer.
 *
 * Constraints (from issue #323):
 * - sha256 (specified by issue — collision-resistant, widely available)
 * - prefix length >= 12 hex chars (issue minimum); we use 16 (64 bits) to match
 *   the Vite contenthash convention and give a ~1-in-3.4-trillion collision
 *   margin across the current ~3,300-file corpus
 * - hex-encoded, lowercase, no separators (URL-safe, filesystem-safe)
 *
 * Bytes change → hash changes → URL changes → browsers fetch fresh bytes.
 *
 * @param {Buffer} bytes - the raw AVIF buffer
 * @returns {string} hash suffix to embed in `{id}.{hash}.avif`
 */
function deriveHash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/**
 * Compose the hashed output filename for a given size variant.
 * Full: `{id}.{hash}.avif`
 * Small: `{id}.{hash}-sm.avif` (the `-sm` segment is preserved for downstream
 * `smallImageUrl()` callers in the web loader)
 */
function hashedFilename(cardId, hash, suffix) {
  return suffix === '-sm' ? `${cardId}.${hash}-sm.avif` : `${cardId}.${hash}.avif`;
}

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

/**
 * Hash bytes, write to OUTPUT_DIR with the hashed filename, record in manifest.
 * Used by both the download path (post-Sharp conversion) and the preview-AVIF
 * copy path so both produce content-addressed output uniformly.
 */
function emitHashed(bytes, cardId, suffix, manifest) {
  const hash = deriveHash(bytes);
  fs.writeFileSync(path.join(OUTPUT_DIR, hashedFilename(cardId, hash, suffix)), bytes);
  const key = SIZES.find((s) => s.suffix === suffix).key;
  if (!manifest[cardId]) manifest[cardId] = {};
  manifest[cardId][key] = hash;
  return hash;
}

/** Returns true when both full + small preview AVIFs exist for this card. */
function hasPreviewAvifs(id) {
  if (!fs.existsSync(PREVIEW_AVIFS_DIR)) return false;
  return SIZES.every((s) =>
    fs.existsSync(path.join(PREVIEW_AVIFS_DIR, `${id}${s.suffix}.avif`)),
  );
}

/** Read pre-generated preview AVIFs, hash each variant, emit hashed output. */
function copyPreviewAvifs(cardId, manifest) {
  for (const size of SIZES) {
    const file = `${cardId}${size.suffix}.avif`;
    const bytes = fs.readFileSync(path.join(PREVIEW_AVIFS_DIR, file));
    emitHashed(bytes, cardId, size.suffix, manifest);
  }
}

async function processTask(task, manifest) {
  // Cache check — only trust if ALL size variants exist (prevents partial-write poisoning)
  const allCached =
    !FORCE &&
    SIZES.every((size) => fs.existsSync(path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`)));

  if (!allCached) {
    // Download JPEG from Ravensburger, convert to AVIF, store unhashed in cache
    const buffer = await downloadWithRetry(task.url);
    for (const size of SIZES) {
      const cachePath = path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`);
      try {
        await sharp(buffer)
          .resize(size.width, size.height, {fit: 'cover'})
          .avif({quality: IMAGE_QUALITY})
          .toFile(cachePath);
      } catch (err) {
        throw new Error(`Failed to generate ${task.id}${size.suffix}.avif: ${err.message}`);
      }
    }
  }

  // Hash + write hashed filename to OUTPUT_DIR for every size
  for (const size of SIZES) {
    const cachePath = path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`);
    const bytes = fs.readFileSync(cachePath);
    emitHashed(bytes, task.id, size.suffix, manifest);
  }

  return allCached ? 'cached' : 'downloaded';
}

/**
 * Mutate a card data file (allCards.json or previewCards.json) in-place so its
 * `imageHash` / `imageHashSm` fields describe exactly the images THIS build emitted.
 *
 * Clearing is as important as setting. OUTPUT_DIR is wiped at the start of every run
 * and the manifest starts empty, so a hash left over from a previous build names a
 * file that no longer exists: the app then renders an <img> pointing at a dead URL,
 * on a path served with `immutable`. Dropping the field instead routes the card to
 * the same fallback UI a never-hashed card gets, which is the honest degradation.
 *
 * Found live on 2026-09-23: seven cards whose art had 404'd upstream were shipping
 * broken images this way, while the one card that had never been hashed rendered its
 * fallback correctly.
 */
export function injectManifest(filePath, manifest) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updated = 0;
  for (const card of data.cards) {
    const hashes = manifest[card.id];
    if (hashes) {
      card.imageHash = hashes.full;
      card.imageHashSm = hashes.sm;
      updated++;
    } else {
      delete card.imageHash;
      delete card.imageHashSm;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  return updated;
}

/**
 * Fail the build if any adequately-sized set is missing image hashes for more than
 * (1 - SET_COVERAGE_FLOOR) of its cards. Guards against a graduated or new set
 * silently shipping blank: without imageHash, resolveImageUrl returns undefined and
 * every card in that set renders empty in the production build. Scattered rot across
 * a set stays green (matches the non-fatal per-image warning above).
 */
function assertImageCoverage(dataFile, manifest) {
  const {cards} = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const bySet = new Map();
  for (const card of cards) {
    const set = String(card.setCode ?? 'unknown');
    const stat = bySet.get(set) ?? {total: 0, hashed: 0};
    stat.total++;
    if (manifest[card.id]) stat.hashed++;
    bySet.set(set, stat);
  }
  const broken = [...bySet].filter(
    ([, {total, hashed}]) => total >= SET_MIN_CARDS_TO_CHECK && hashed / total < SET_COVERAGE_FLOOR,
  );
  if (broken.length === 0) return;
  console.error('\n  x Image-coverage guard FAILED — these sets would render blank in production:');
  for (const [set, {total, hashed}] of broken) {
    console.error(`      set ${set}: only ${hashed}/${total} cards have an image hash`);
  }
  console.error(
    '  Cards without imageHash render blank in the VITE_LOCAL_IMAGES build. Re-source the\n' +
      '  dead image URLs (or re-run the download) before deploying.\n',
  );
  process.exit(1);
}

/** Invalidate cache when CACHE_VERSION changes; ensure CACHE_DIR exists. */
function prepareCacheDir() {
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
}

/** Merge primary cards with previewCards.json (preview entries lose to allCards on id collision). */
function loadAllCards(primaryData) {
  const allCards = [...primaryData.cards];
  if (!fs.existsSync(PREVIEW_DATA_FILE)) return allCards;
  const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf8'));
  const mainIds = new Set(primaryData.cards.map((c) => c.id));
  for (const card of previewData.cards) {
    if (!mainIds.has(card.id)) allCards.push(card);
  }
  return allCards;
}

/**
 * Split cards into two streams: those with pre-existing preview AVIFs (copied
 * + hashed eagerly here), and those that need a Ravensburger download (returned
 * as a task list for the concurrent batch loop).
 */
function partitionCards(allCards, manifest) {
  const tasks = [];
  let previewCopied = 0;
  for (const card of allCards) {
    if (hasPreviewAvifs(card.id)) {
      copyPreviewAvifs(card.id, manifest);
      previewCopied++;
      continue;
    }
    const url = card.images?.full ?? card.images?.thumbnail;
    if (url) tasks.push({id: card.id, url});
  }
  return {tasks, previewCopied};
}

/** Tally a single batch's settled results into the running counts object. */
function tallyBatchResults(results, batch, counts) {
  for (const [idx, result] of results.entries()) {
    if (result.status === 'rejected') {
      counts.failed++;
      console.error(`  x ${batch[idx].id}: ${result.reason.message}`);
      continue;
    }
    if (result.value === 'cached') counts.cached++;
    else counts.downloaded++;
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  prepareCacheDir();

  // Clean output dir (no stale hash variants accumulate across builds)
  fs.rmSync(OUTPUT_DIR, {recursive: true, force: true});
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});

  // Manifest: { [cardId]: { full: hash, sm: hash } }, populated as images are emitted
  const manifest = {};
  const allCards = loadAllCards(data);
  const {tasks, previewCopied} = partitionCards(allCards, manifest);

  console.log(
    `\n  ${tasks.length} images (${allCards.length} cards, ${previewCopied} from preview AVIFs)${FORCE ? ' [force re-download]' : ''}`,
  );

  const counts = {cached: 0, downloaded: 0, failed: 0};
  const startTime = Date.now();

  // Process in batches with concurrency limit
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((task) => processTask(task, manifest)));
    tallyBatchResults(results, batch, counts);

    const total = counts.cached + counts.downloaded + counts.failed;
    if (total % 200 === 0 || i + CONCURRENCY >= tasks.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ${total}/${tasks.length} (${counts.cached} cached, ${counts.downloaded} new, ${counts.failed} failed) [${elapsed}s]`,
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${counts.downloaded} downloaded, ${counts.cached} from cache, ${counts.failed} failed\n`,
  );

  if (counts.failed > 0) {
    console.error(`  Warning: ${counts.failed} images failed to download. Cards will show fallback UI.\n`);
  }

  // Inject manifest into card data files. Both files get mutated because the
  // web loader reads from both and merges them; missing fields here would
  // surface as broken images on the affected cards.
  const mainUpdated = injectManifest(DATA_FILE, manifest);
  const previewUpdated = fs.existsSync(PREVIEW_DATA_FILE) ? injectManifest(PREVIEW_DATA_FILE, manifest) : 0;
  console.log(
    `  Injected hashes into card data: ${mainUpdated} in allCards.json, ${previewUpdated} in previewCards.json\n`,
  );

  // Guard: refuse to finish green if a whole set failed to image (would ship blank).
  assertImageCoverage(DATA_FILE, manifest);
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
