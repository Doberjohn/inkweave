#!/usr/bin/env node
/**
 * Merge the promo catalog (scripts/data/promo-printings.json) into allCards.json (#805): each
 * Core card's promo printings become exactly the catalog's. The rules, and why the catalog is
 * their one source, are in scripts/lib/promo-printings.mjs. It also writes the collection's
 * promos (`collection/promos.json`, every promo in the catalog), which the next
 * `pnpm generate-collection-data` writes again the same way.
 *
 * A promo's versions (`finishes`, #880) are the catalog's, copied into both files as they are.
 * An entry the catalog names none for keeps any it holds, and the report lists those it gives.
 *
 * Usage:
 *   pnpm merge-promos           # dry run: report only
 *   pnpm merge-promos --write   # write allCards.json and collection/promos.json
 *
 * Writing the file directly bypasses the preview-data-auto-precompute hook, so run
 * `pnpm precompute-synergies` afterwards. The engine never reads printings, so its output must
 * not change.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROMOS_FILENAME} from './lib/collectionData.mjs';
import {readJson, writeJson} from './lib/json-file.mjs';
import {finishesById, finishesReport, givenFinishes} from './lib/finishes.mjs';
import {
  collectionPromos,
  mergePromoPrintings,
  promoBaseProblems,
  promoLabel,
} from './lib/promo-printings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'scripts/data/promo-printings.json');
const ALL_CARDS = path.join(ROOT, 'apps/web/public/data/allCards.json');
const COLLECTION_DIR = path.join(ROOT, 'apps/web/public/data/collection');
const COLLECTION_PROMOS = path.join(COLLECTION_DIR, PROMOS_FILENAME);

const OUTCOMES = ['added', 'updated', 'removed', 'unchanged'];

/** One line per card the merge changes, each removed promo by name, then the totals. */
function printReport({changes, skipped}) {
  const totals = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0]));
  for (const change of changes) {
    for (const outcome of OUTCOMES) totals[outcome] += change[outcome].length;
    const moved = OUTCOMES.filter((outcome) => outcome !== 'unchanged' && change[outcome].length);
    if (moved.length === 0) continue;
    const counts = moved.map((outcome) => `${change[outcome].length} ${outcome}`).join(', ');
    console.log(`  ${change.card.id} ${change.card.fullName}: ${counts}`);
    for (const entry of change.removed) console.log(`    removed: ${promoLabel(entry)}`);
  }
  const summary = OUTCOMES.map((outcome) => `${totals[outcome]} ${outcome}`).join(', ');
  console.log(`\n  ${summary}, on ${changes.length} cards`);
  console.log(
    `  ${skipped.printings} noBaseCard printings of ${skipped.cards} cards skipped: allCards.json doesn't hold their cards`,
  );
}

/** The collection's set chunks: among their cards, the pre-Core ones a `noBaseCard` promo reprints. */
function chunkCards() {
  return fs
    .readdirSync(COLLECTION_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'index.json' && file !== PROMOS_FILENAME)
    .flatMap((file) => readJson(path.join(COLLECTION_DIR, file)));
}

/** A promo list without the hashes a local image build injects, to tell a real change from them. */
const withoutHashes = (promos) =>
  JSON.stringify(promos, (key, value) => (key.startsWith('imageHash') ? undefined : value));

/** Whether the collection's promos differ from the stored file's, hashes aside. */
function promosChanged(promos) {
  if (!fs.existsSync(COLLECTION_PROMOS)) return true;
  return withoutHashes(readJson(COLLECTION_PROMOS)) !== withoutHashes(promos);
}

/**
 * The collection's promos, checked: each promo's card is in allCards.json or a chunk, or it has
 * none yet. Each keeps any versions the stored file gives it (`kept`, #880) that the catalog
 * doesn't name.
 */
function buildCollectionPromos(catalog, coreCards, kept) {
  const promos = collectionPromos(catalog, kept);
  const problems = promoBaseProblems(promos, [...coreCards, ...chunkCards()]);
  if (problems.length > 0) {
    throw new Error(
      `The promo catalog names cards the datasets don't hold:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return promos;
}

/** The stored collection promos, or none before the first merge. */
const storedPromos = () => (fs.existsSync(COLLECTION_PROMOS) ? readJson(COLLECTION_PROMOS) : []);

function main() {
  const write = process.argv.includes('--write');
  const allData = readJson(ALL_CARDS);
  const catalog = readJson(CATALOG);
  // The versions both files hold before the merge (#880), which it keeps where the catalog names none.
  const cardsBefore = finishesById(allData.cards);
  const promosBefore = finishesById(storedPromos());
  const report = mergePromoPrintings(allData.cards, catalog);
  const promos = buildCollectionPromos(catalog, allData.cards, promosBefore);
  const changed = promosChanged(promos);

  const mode = write ? '' : ' (dry run, nothing written)';
  console.log(`\n  Promo printings from scripts/data/promo-printings.json${mode}\n`);
  printReport(report);
  const waiting = promos.filter((promo) => promo.baseId === undefined).length;
  console.log(
    `  collection/${PROMOS_FILENAME}: ${promos.length} promos, ${waiting} waiting for their card, ${changed ? 'changed' : 'unchanged'}`,
  );
  // The versions the merge copied from the catalog (#880), so a slip in it shows.
  const given = [
    ...givenFinishes(
      cardsBefore,
      allData.cards,
      (entry, card) => `${promoLabel(entry)} ${card.fullName}`,
    ),
    ...givenFinishes(
      promosBefore,
      promos,
      (promo) => `${promoLabel(promo)} ${promo.fullName}, collection`,
    ),
  ];
  for (const line of finishesReport(given)) console.log(`  ${line}`);

  if (!write) return;
  writeJson(ALL_CARDS, allData);
  if (changed) writeJson(COLLECTION_PROMOS, promos, {compact: true});
  console.log(
    `\n  Wrote allCards.json${changed ? ` and collection/${PROMOS_FILENAME}` : ''}. Next: pnpm precompute-synergies\n`,
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
