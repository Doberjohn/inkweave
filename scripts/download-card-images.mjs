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
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITE_ORIGIN} from './lib/siteOrigin.mjs';
import {
  deriveHash,
  hashedFilename,
  indexById,
  planFor,
  verifyRestored,
} from './lib/imageRestore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const CACHE_DIR = path.join(ROOT, 'node_modules/.cache/card-images');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/card-images');
const PREVIEW_AVIFS_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');
/** The deployed card data — already the record of what production is serving. */
const PROD_DATA_PATH = '/data/allCards.json';
/**
 * Restore is an optimisation, so it must never be able to hold the build open. Node's
 * fetch has no default timeout: a stalled origin would hang rather than fall through to
 * Ravensburger, turning the safety net into the failure.
 */
const RESTORE_TIMEOUT_MS = 15000;
/**
 * Collection detail chunks (#553): the 2,152 cards Inkweave shows but never
 * analyses. Imaged here because a binder without art is pointless.
 *
 * The INDEX is deliberately not read. It carries no image fields — the binder
 * renders one set at a time from that set's chunk, so the chunk is where hashes
 * belong. If cross-set filtered results ever render from the index, it needs
 * `imageHashSm` and this list has to grow.
 */
const COLLECTION_DIR = path.join(ROOT, 'apps/web/public/data/collection');

const CONCURRENCY = 20;
const IMAGE_QUALITY = 50;
const MAX_RETRIES = 2;
const FORCE = process.argv.includes('--force');

/**
 * Where a cache miss looks before it falls back to Ravensburger (#554).
 *
 * First match wins. `VERCEL_PROJECT_PRODUCTION_URL` is injected automatically on
 * every Vercel build with no setup and points at the deployment currently serving
 * production — precisely the one holding the images we want. `SITE_ORIGIN` is the
 * committed constant, used locally and as the last resort.
 */
const RESTORE_ORIGIN =
  process.env.PROD_IMAGE_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  SITE_ORIGIN;

/** Escape hatch: reverts to pure download behaviour with no code change. */
const RESTORE_ENABLED = process.env.SKIP_IMAGE_RESTORE !== '1' && Boolean(RESTORE_ORIGIN) && !FORCE;

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

// `deriveHash` and `hashedFilename` moved to lib/imageRestore.mjs (#554) so the
// restore path verifies with the exact function the emit path hashes with. Two
// copies of a hash function is the same bug class as two copies of a URL — and
// here it would mean verification silently disagreeing with emission. Their
// constraints (sha256, 16 hex chars, issue #323) are documented there.

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

/**
 * Fetch one already-converted AVIF from our own CDN, or null.
 *
 * VERIFIED, NOT TRUSTED. The expected hash is known before the request, so a
 * stale, truncated or substituted response is arithmetically detectable and
 * discarded. That is the only reason fetching a build input from a
 * build-time-resolved origin is acceptable here.
 */
async function restoreFromCdn(cardId, expectedHash, suffix) {
  try {
    const res = await fetch(`${RESTORE_ORIGIN}/card-images/${hashedFilename(cardId, expectedHash, suffix)}`, {
      signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return verifyRestored(bytes, expectedHash) ? bytes : null;
  } catch {
    return null; // Restore is an optimisation. A network failure is not a build failure.
  }
}

/**
 * Fill the cache for one card from the CDN. ALL-OR-NOTHING: every size is fetched
 * and verified before anything is written, because a half-restored card is the
 * partial-write poisoning the cache check already guards against — and it would
 * leave one variant restored and the other downloaded, from possibly different art.
 */
async function restoreIntoCache(task) {
  const fetched = [];
  for (const size of SIZES) {
    const bytes = await restoreFromCdn(task.id, task.plan[size.key], size.suffix);
    if (!bytes) return false;
    fetched.push({size, bytes});
  }
  for (const {size, bytes} of fetched) {
    fs.writeFileSync(path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`), bytes);
  }
  return true;
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

/** Every size variant present. Partial sets are never trusted (write poisoning). */
function isFullyCached(cardId) {
  return SIZES.every((size) => fs.existsSync(path.join(CACHE_DIR, `${cardId}${size.suffix}.avif`)));
}

/** Download the JPEG once and convert it into every cached size. */
async function convertIntoCache(task) {
  const buffer = await downloadWithRetry(task.url);
  for (const size of SIZES) {
    const cachePath = path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`);
    try {
      await sharp(buffer)
        .resize(size.width, size.height, {fit: 'cover'})
        .avif({quality: IMAGE_QUALITY})
        .toFile(cachePath);
    } catch (err) {
      throw new Error(`Failed to generate ${task.id}${size.suffix}.avif: ${err.message}`, {
        cause: err,
      });
    }
  }
}

/**
 * Populate the cache for one card, preferring restore. Returns how it got there.
 *
 * Both paths fill the CACHE, never the output, so the emit step stays a single
 * unconditional loop and output always comes from cache. Restored bytes ARE the
 * cache bytes that produced the CDN filename, so re-hashing them reproduces the
 * same hash by construction.
 */
async function fillCache(task) {
  const canRestore = RESTORE_ENABLED && task.plan.action === 'restore';
  if (canRestore && (await restoreIntoCache(task))) return 'restored';
  await convertIntoCache(task);
  return 'downloaded';
}

async function processTask(task, manifest) {
  const outcome = !FORCE && isFullyCached(task.id) ? 'cached' : await fillCache(task);

  // Hash + write hashed filename to OUTPUT_DIR for every size
  for (const size of SIZES) {
    const bytes = fs.readFileSync(path.join(CACHE_DIR, `${task.id}${size.suffix}.avif`));
    emitHashed(bytes, task.id, size.suffix, manifest);
  }

  return outcome;
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
    if (applyHashes(card, manifest[card.id])) updated++;
    // Variant printings (#625) carry their own art, hashed under the variant's id.
    for (const variant of card.variants ?? []) applyHashes(variant, manifest[variant.id]);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  return updated;
}

/** Every collection detail chunk, or [] before Phase B has been generated. */
function collectionChunkFiles() {
  if (!fs.existsSync(COLLECTION_DIR)) return [];
  return fs
    .readdirSync(COLLECTION_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => path.join(COLLECTION_DIR, file));
}

function readChunk(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Same job as injectManifest, but a chunk is a bare ARRAY rather than `{cards}`,
 * and is written compact — the generator emits it that way, and pretty-printing
 * here would turn every rebuild into a 2,000-line diff.
 */
function injectManifestIntoChunk(filePath, manifest) {
  const cards = readChunk(filePath);
  let updated = 0;
  for (const card of cards) {
    if (applyHashes(card, manifest[card.id])) updated++;
    // Variant printings (#625) hash under their own id, exactly as injectManifest does.
    for (const variant of card.variants ?? []) applyHashes(variant, manifest[variant.id]);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(cards)}\n`);
  return updated;
}

/** Set a card's (or variant's) hashes from this build's manifest entry, or clear stale ones. */
function applyHashes(target, hashes) {
  if (hashes) {
    target.imageHash = hashes.full;
    target.imageHashSm = hashes.sm;
    return true;
  }
  delete target.imageHash;
  delete target.imageHashSm;
  return false;
}

/**
 * Everything that needs an image this build: each card, then each of its variant printings
 * (#625) under the variant's own id, so a variant gets its own content-addressed AVIF.
 */
export function imageSubjects(cards) {
  return cards.flatMap((card) => [
    {id: card.id, images: card.images},
    ...(card.variants ?? []).map((v) => ({id: v.id, images: v.images})),
  ]);
}

/**
 * Variant ids this build emitted no image for. Reported as a warning, never fatal: a single
 * dead upstream variant URL must not block a deploy, and the switcher simply shows a broken
 * image for that printing (the same honest degradation an unhashed card gets, #323).
 */
export function missingVariantHashes(cards, manifest) {
  return cards.flatMap((card) =>
    (card.variants ?? []).filter((v) => !manifest[v.id]).map((v) => v.id),
  );
}

/**
 * Fail the build if any adequately-sized set is missing image hashes for more than
 * (1 - SET_COVERAGE_FLOOR) of its cards. Guards against a graduated or new set
 * silently shipping blank: without imageHash, resolveImageUrl returns undefined and
 * every card in that set renders empty in the production build. Scattered rot across
 * a set stays green (matches the non-fatal per-image warning above).
 */
function assertImageCoverage(cards, manifest) {
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
function partitionCards(allCards, manifest, deployed) {
  const tasks = [];
  let previewCopied = 0;
  for (const subject of imageSubjects(allCards)) {
    if (hasPreviewAvifs(subject.id)) {
      copyPreviewAvifs(subject.id, manifest);
      previewCopied++;
      continue;
    }
    const url = subject.images?.full ?? subject.images?.thumbnail;
    // The plan is decided HERE, where the subject (and so its source URL) is in
    // scope; `processTask` only ever sees the task. Variant printings get their own
    // plan, so a variant can restore while its base card downloads.
    if (url) tasks.push({id: subject.id, url, plan: planFor(subject, deployed.get(String(subject.id)))});
  }
  return {tasks, previewCopied};
}

/**
 * Is any image subject missing from the cache? Restore data is only worth fetching if
 * something could actually use it — a fully warm build should make ZERO network
 * requests, which is also what makes its "0 downloaded" report honest.
 *
 * Over SUBJECTS, not cards: a card whose own art is cached can still have an uncached
 * variant, and counting only top-level cards declared the cache complete, skipped the
 * manifest fetch, and left that variant unable to restore.
 */
function anyCacheMiss(allCards) {
  return imageSubjects(allCards).some((s) => needsFetch(s) && !isFullyCached(s.id));
}

/** A card the download path is responsible for: has a URL, has no preview AVIFs. */
function needsFetch(card) {
  if (hasPreviewAvifs(card.id)) return false;
  return Boolean(card.images?.full ?? card.images?.thumbnail);
}

/**
 * One line saying which of the four states this run is in. They are reported
 * separately on purpose: "nothing to restore" and "could not reach the origin"
 * produce identical counts and mean opposite things.
 */
function describeRestore(cacheIncomplete, deployed, tasks) {
  if (!RESTORE_ENABLED) return 'disabled (SKIP_IMAGE_RESTORE=1 or --force)';
  if (!cacheIncomplete) return 'not consulted — cache is already complete';
  if (deployed.size === 0) return `unavailable — ${RESTORE_ORIGIN} could not be read`;
  const eligible = tasks.filter((task) => task.plan.action === 'restore').length;
  return `${RESTORE_ORIGIN} (${eligible} of ${tasks.length} eligible)`;
}

/**
 * One collection chunk as a deployed index, or null when production has no such chunk
 * (a set added since the last deploy), which simply means those cards download.
 *
 * Goes through `indexById` rather than a bare `set` loop so collection VARIANTS are
 * indexed too. Writing that loop by hand here is what left core variants unrestorable.
 */
export async function fetchChunkIndex(file) {
  const res = await fetch(`${RESTORE_ORIGIN}/data/collection/${path.basename(file)}`, {
    signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS),
  });
  return res.ok ? indexById(await res.json()) : null;
}

/**
 * Fetch the deployed card data, which publishes the hashes production is serving
 * alongside the source URLs they were built from.
 *
 * Returns an empty index on any failure. That is not a degraded mode needing a
 * warning: with no deployment to restore from, every card downloads, which is
 * precisely the pre-#554 behaviour.
 */
async function fetchDeployedCards() {
  if (!RESTORE_ENABLED) return new Map();
  try {
    const res = await fetch(`${RESTORE_ORIGIN}${PROD_DATA_PATH}`, {
      signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const deployed = indexById((await res.json()).cards);
    // Collection chunks publish their hashes the same way, so they restore too.
    // Fetched per set rather than as one file because that is how they deploy, and
    // CONCURRENTLY because a serial loop multiplies RESTORE_TIMEOUT_MS by the chunk
    // count: thirteen stalled sets would add over three minutes to the build.
    const chunks = await Promise.allSettled(collectionChunkFiles().map(fetchChunkIndex));
    // Applied in chunk order rather than completion order, so the result cannot
    // depend on which request happened to win the race.
    for (const chunk of chunks) {
      // One unreachable chunk costs that set a download, not the build.
      if (chunk.status !== 'fulfilled' || !chunk.value) continue;
      for (const [id, card] of chunk.value) deployed.set(id, card);
    }
    return deployed;
  } catch (err) {
    console.warn(`  ! Could not read ${RESTORE_ORIGIN}${PROD_DATA_PATH} (${err.message}) — downloading everything.\n`);
    return new Map();
  }
}

/** Tally a single batch's settled results into the running counts object. */
function tallyBatchResults(results, batch, counts) {
  for (const [idx, result] of results.entries()) {
    if (result.status === 'rejected') {
      counts.failed++;
      console.error(`  x ${batch[idx].id}: ${result.reason.message}`);
      continue;
    }
    // Three outcomes, counted separately: a run reporting only "done" hides
    // whether restore worked at all, which is the one thing worth knowing.
    counts[result.value]++;
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
  // Core pool + the collection cards, imaged together: one cache, one manifest,
  // one coverage guard. They stay separate everywhere else, but an image is an
  // image, and splitting the pipeline would mean two of everything here.
  const chunkFiles = collectionChunkFiles();
  const collectionCards = chunkFiles.flatMap(readChunk);
  const allCards = [...loadAllCards(data), ...collectionCards];
  // What production is serving right now. Fetched only when something could use
  // it, so a fully warm build makes no network requests at all.
  const cacheIncomplete = anyCacheMiss(allCards);
  const deployed = cacheIncomplete ? await fetchDeployedCards() : new Map();
  const {tasks, previewCopied} = partitionCards(allCards, manifest, deployed);

  console.log(
    `\n  ${tasks.length} images (${allCards.length} cards, ${previewCopied} from preview AVIFs)${FORCE ? ' [force re-download]' : ''}`,
  );
  console.log(`  Restore: ${describeRestore(cacheIncomplete, deployed, tasks)}`);

  const counts = {cached: 0, restored: 0, downloaded: 0, failed: 0};
  const startTime = Date.now();

  // Process in batches with concurrency limit
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((task) => processTask(task, manifest)));
    tallyBatchResults(results, batch, counts);

    const total = counts.cached + counts.restored + counts.downloaded + counts.failed;
    if (total % 200 === 0 || i + CONCURRENCY >= tasks.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ${total}/${tasks.length} (${counts.cached} cached, ${counts.restored} restored, ${counts.downloaded} new, ${counts.failed} failed) [${elapsed}s]`,
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${counts.cached} cached, ${counts.restored} restored, ${counts.downloaded} downloaded, ${counts.failed} failed\n`,
  );

  if (counts.failed > 0) {
    console.error(`  Warning: ${counts.failed} images failed to download. Cards will show fallback UI.\n`);
  }

  // Inject manifest into card data files. Both files get mutated because the
  // web loader reads from both and merges them; missing fields here would
  // surface as broken images on the affected cards.
  const mainUpdated = injectManifest(DATA_FILE, manifest);
  const previewUpdated = fs.existsSync(PREVIEW_DATA_FILE) ? injectManifest(PREVIEW_DATA_FILE, manifest) : 0;
  let chunkUpdated = 0;
  for (const file of chunkFiles) chunkUpdated += injectManifestIntoChunk(file, manifest);
  console.log(
    `  Injected hashes into card data: ${mainUpdated} in allCards.json, ${previewUpdated} in previewCards.json,` +
      ` ${chunkUpdated} across ${chunkFiles.length} collection chunk(s)\n`,
  );

  // No manifest is written: the hashes injected into allCards.json above ARE the
  // record, and they ship with the deployment. The next build reads them back
  // from the live site (#554).

  // Guard: refuse to finish green if a whole set failed to image (would ship
  // blank). Covers the collection sets too — a binder page of empty frames is
  // the same failure as a blank Browse page.
  assertImageCoverage(allCards, manifest);
  const unimaged = missingVariantHashes(allCards, manifest);
  if (unimaged.length > 0) {
    console.warn(
      `  Warning: ${unimaged.length} variant printing(s) have no image: ${unimaged.join(', ')}\n`,
    );
  }
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
