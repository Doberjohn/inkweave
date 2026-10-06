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
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.json');

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

/** Remove stale chunks so a rotated-out set does not linger as a served file. */
function clearOutputDir() {
  fs.rmSync(OUTPUT_DIR, {recursive: true, force: true});
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
}

function main() {
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

  clearOutputDir();

  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index)}\n`);

  for (const [i, [setCode, cards]] of bySet.entries()) {
    fs.writeFileSync(path.join(OUTPUT_DIR, filenames[i]), `${JSON.stringify(cards)}\n`);
  }

  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
  console.log(`\n  Source: ${path.relative(ROOT, source)}`);
  console.log(`  ${fullCards.length} cards upstream − ${excluded.size} already served = ${collectionCards.length} for the collection\n`);
  console.log(`  index.json            ${String(index.length).padStart(4)} cards  ${kb(fs.statSync(INDEX_FILE).size).padStart(8)}`);
  for (const [setCode, cards] of bySet) {
    const file = path.join(OUTPUT_DIR, chunkFilename(setCode));
    console.log(`  ${chunkFilename(setCode).padEnd(21)} ${String(cards.length).padStart(4)} cards  ${kb(fs.statSync(file).size).padStart(8)}`);
  }
  console.log(`\n  Wrote ${bySet.length + 1} files to ${path.relative(ROOT, OUTPUT_DIR)}\n`);
}

main();
