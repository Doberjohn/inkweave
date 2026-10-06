#!/usr/bin/env node
/**
 * Generate the collection dataset from the LorcanaJSON full export (#553).
 *
 * Inkweave's `apps/web/public/data/allCards.json` is the Core pool (sets 9+) and
 * the only input to the synergy engine, the deck builder and the playstyle pages.
 * This script builds the OTHER cards — sets 1-8, Q1/Q2, and the
 * Enchanted/Epic/Iconic/Special printings inside Core sets — so a user can VIEW
 * their whole collection without any of it reaching a synergy calculation.
 *
 * **The invariant: no card id appears in both datasets.** That is what makes the
 * Core boundary structural. Every build script reads `allCards.json` and never
 * opens these files, so a set-1 card cannot reach the engine even by mistake.
 * Asserted below, and the run fails if it is ever violated.
 *
 * SOURCE IS MANUAL, exactly like `graduate-canonical-set.mjs`: download the full
 * export from https://lorcanajson.org/ and pass its path. It is deliberately not
 * fetched here — the same file feeds the graduation flow, and a build that
 * silently re-pulls upstream data is a build whose output nobody chose.
 *
 * Usage:
 *   node scripts/generate-collection-data.mjs [source-path]
 *     source-path  default: .knowledge/folder/allCards.json (git-ignored)
 *
 * Output (committed, like allCards.json):
 *   apps/web/public/data/collection/index.json    all cards, light projection
 *   apps/web/public/data/collection/{set}.json    per-set detail, one per set
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildDetailChunks,
  buildIndex,
  chunkFilename,
  selectCollectionCards,
} from './lib/collectionData.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(ROOT, '.knowledge/folder/allCards.json');
const CORE_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/data/collection');
const STAGING_DIR = `${OUTPUT_DIR}.staging`;
/** Holds the previous dataset across the swap, so a failed rename is recoverable. */
const BACKUP_DIR = `${OUTPUT_DIR}.backup`;
const INDEX_NAME = 'index.json';

function readCards(filePath, {required = true} = {}) {
  if (!fs.existsSync(filePath)) {
    if (required) {
      console.error(`\n  x Not found: ${filePath}`);
      console.error('    Download the full export from https://lorcanajson.org/ and pass its path.\n');
      process.exit(1);
    }
    return [];
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // `?? []` here would turn a mistyped path, or any JSON that is simply not a card
  // export, into "0 cards upstream". The run would then clear the output directory,
  // write an empty index and report success, having deleted the committed dataset.
  // An export with no `cards` array is never legitimate, so refuse it.
  if (!Array.isArray(data?.cards)) {
    console.error(`\n  x ${filePath} has no \`cards\` array, so it is not a LorcanaJSON export.`);
    console.error('    Refusing to run rather than replace the committed dataset with an empty one.\n');
    process.exit(1);
  }
  // Shape is not enough: `{"cards": []}` is a well-formed export of nothing, and would
  // atomically swap in an empty dataset while reporting success. `previewCards.json`
  // legitimately holds zero cards off-season, which is exactly why this is tied to
  // `required` rather than applied to every read.
  if (required && data.cards.length === 0) {
    console.error(`\n  x ${filePath} contains zero cards.`);
    console.error('    A required export is never legitimately empty. Refusing to run.\n');
    process.exit(1);
  }
  return data.cards;
}

const idSet = (cards) => new Set(cards.map((card) => String(card.id)));

/**
 * The invariant, checked rather than assumed. A card in both datasets would be
 * shown twice in collection mode and — far worse — would mean the boundary is no
 * longer structural, which is the entire argument for splitting the files.
 */
function assertDisjoint(collectionCards, excludedIds) {
  const overlap = collectionCards.filter((card) => excludedIds.has(String(card.id)));
  if (overlap.length === 0) return;
  console.error(`\n  x ${overlap.length} card(s) appear in BOTH datasets, e.g. ${overlap[0].id} ${overlap[0].fullName}`);
  console.error('    The Core boundary depends on these files being disjoint. Aborting.\n');
  process.exit(1);
}

/**
 * Install the fully-written STAGING_DIR as OUTPUT_DIR, keeping the old dataset until
 * the new one is in place.
 *
 * Generation used to clear the output first and write into the hole, so any failure
 * afterwards left the dataset deleted or half-rewritten. Staging fixed the write loop,
 * but an earlier version of this function still did `rm` then `rename`, which has the
 * same shape in miniature: if the rename FAILS, and on Windows a transient lock on a
 * directory is enough, there is no dataset at all and nothing to restore. "The window
 * is only milliseconds" is not a guarantee, it is a smaller version of the same bug.
 *
 * So the old dataset is moved aside rather than destroyed, and only deleted once the
 * replacement is installed. A failed rename puts it straight back.
 */
function commitStaging() {
  fs.rmSync(BACKUP_DIR, {recursive: true, force: true});
  const hadPrevious = fs.existsSync(OUTPUT_DIR);
  if (hadPrevious) fs.renameSync(OUTPUT_DIR, BACKUP_DIR);
  try {
    fs.renameSync(STAGING_DIR, OUTPUT_DIR);
  } catch (err) {
    if (hadPrevious) fs.renameSync(BACKUP_DIR, OUTPUT_DIR);
    throw err;
  }
  fs.rmSync(BACKUP_DIR, {recursive: true, force: true});
}

/**
 * Undo a commit that was interrupted between its two renames.
 *
 * That is the one state the swap cannot defend itself against: the process dies after
 * the old dataset has moved to BACKUP_DIR and before the new one is installed, leaving
 * no OUTPUT_DIR. Nothing in the next run would notice, since generation writes to
 * staging and never reads the output. So the next run checks for it explicitly.
 *
 * A backup sitting beside an OUTPUT_DIR that DOES exist just means the final cleanup
 * did not get to run, so it is discarded rather than restored.
 */
function recoverInterruptedCommit() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(BACKUP_DIR, {recursive: true, force: true});
    return;
  }
  fs.renameSync(BACKUP_DIR, OUTPUT_DIR);
  console.warn(`
  ! Restored ${path.relative(ROOT, OUTPUT_DIR)} from a previous interrupted run.
`);
}

/** Start from a clean staging directory, discarding any a crashed run left behind. */
function prepareStaging() {
  fs.rmSync(STAGING_DIR, {recursive: true, force: true});
  fs.mkdirSync(STAGING_DIR, {recursive: true});
}

function main() {
  recoverInterruptedCommit();

  const source = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;
  const fullCards = readCards(source);
  const coreCards = readCards(CORE_FILE);
  const previewCards = readCards(PREVIEW_FILE, {required: false});

  const excluded = idSet([...coreCards, ...previewCards]);
  const collectionCards = selectCollectionCards(fullCards, [excluded]);
  assertDisjoint(collectionCards, excluded);

  const index = buildIndex(collectionCards);
  const chunks = buildDetailChunks(collectionCards);
  const bySet = [...chunks.entries()].sort(
    (a, b) => (parseInt(a[0], 10) || 99) - (parseInt(b[0], 10) || 99),
  );
  // Validate EVERY set code before deleting anything. `chunkFilename` throws on a code
  // that is unsafe in a path, and set codes come from an external data file. Left until
  // the write loop, that throw lands AFTER clearOutputDir, leaving the committed dataset
  // deleted and only partly rewritten.
  const filenames = bySet.map(([setCode]) => chunkFilename(setCode));

  // Everything is written into staging while the committed dataset is still intact.
  prepareStaging();
  try {
    fs.writeFileSync(path.join(STAGING_DIR, INDEX_NAME), `${JSON.stringify(index)}\n`);
    for (const [i, [, cards]] of bySet.entries()) {
      fs.writeFileSync(path.join(STAGING_DIR, filenames[i]), `${JSON.stringify(cards)}\n`);
    }
  } catch (err) {
    fs.rmSync(STAGING_DIR, {recursive: true, force: true});
    console.error(`\n  x Generation failed: ${err.message}`);
    console.error('    The committed dataset is untouched.\n');
    process.exit(1);
  }

  commitStaging();

  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
  console.log(`\n  Source: ${path.relative(ROOT, source)}`);
  console.log(`  ${fullCards.length} cards upstream − ${excluded.size} already served = ${collectionCards.length} for the collection\n`);
  console.log(`  index.json            ${String(index.length).padStart(4)} cards  ${kb(fs.statSync(path.join(OUTPUT_DIR, INDEX_NAME)).size).padStart(8)}`);
  for (const [i, [, cards]] of bySet.entries()) {
    const file = path.join(OUTPUT_DIR, filenames[i]);
    console.log(`  ${filenames[i].padEnd(21)} ${String(cards.length).padStart(4)} cards  ${kb(fs.statSync(file).size).padStart(8)}`);
  }
  console.log(`\n  Wrote ${bySet.length + 1} files to ${path.relative(ROOT, OUTPUT_DIR)}\n`);
}

main();
