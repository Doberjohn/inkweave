#!/usr/bin/env node
/**
 * Pre-computes the "what to watch for" (hoser) catalog for the deck builder.
 *
 * A "hoser" is a Core-legal removal card that punishes a deck's board COMPOSITION
 * rather than removing an arbitrary body — e.g. a banisher gated on low strength,
 * a board wipe, an Evasive/Bodyguard hunter, etc. The deck builder reads this
 * catalog to warn a player which opposing cards their board shape invites.
 *
 * It is pool-derived (no hardcoded card names) so it survives set rotation: every
 * entry comes from scanning the current Core pool through the engine's
 * `getRemovalCondition`, keeping only cards whose condition is NOT 'unconditional'.
 *
 * Output:
 *   apps/web/public/data/hosers.json
 *     [ { cardId, name, ink, condition: { type, threshold? }, scope, text }, ... ]
 *   sorted by cardId (numeric-aware) for clean diffs.
 *
 * Usage:
 *   node scripts/precompute-hosers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAIN_DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const OUTPUT_FILE = path.join(ROOT, 'apps/web/public/data/hosers.json');

/**
 * Curated overrides for hosers whose condition the removal regex can't parse
 * (odd wording, templated gates, split-clause thresholds, etc.). Each entry is a
 * full hoser record and is merged in by cardId: a curated entry OVERRIDES the
 * auto-detected one for the same card, and a curated-only cardId is appended.
 * Empty for now — populate as mis-classified hosers surface.
 *
 * Shape: { cardId, name, ink, condition: { type, threshold? }, scope, text }
 */
const CURATED_HOSERS = [];

/** Load Core-legal cards (main + optional preview) exactly like precompute-synergies. */
function loadCoreCards({transformCards, isCoreSet, MIN_CORE_SET}) {
  const mainData = JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8'));
  const mainIds = new Set(mainData.cards.map((c) => c.id));

  let mergedRaw = mainData.cards;
  let previewCount = 0;
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf-8'));
    const previewFiltered = previewData.cards.filter((c) => !mainIds.has(c.id));
    previewCount = previewFiltered.length;
    mergedRaw = [...mainData.cards, ...previewFiltered];
  }

  const preCoreCount = mergedRaw.length;
  mergedRaw = mergedRaw.filter((c) => isCoreSet(c.setCode));
  if (mergedRaw.length < preCoreCount) {
    console.log(`  Core filter: dropped ${preCoreCount - mergedRaw.length} cards (sets < ${MIN_CORE_SET})`);
  }

  const cards = transformCards(mergedRaw);
  console.log(
    `  ${cards.length}/${mergedRaw.length} cards loaded` +
      (previewCount > 0 ? ` (${previewCount} from previewCards.json)` : ''),
  );
  return cards;
}

/** Build a hoser record from a card and its (already non-unconditional) removal condition. */
function toHoser(card, condition) {
  const cond = {type: condition.type};
  if (condition.threshold !== undefined) cond.threshold = condition.threshold;
  return {
    cardId: card.id,
    name: card.fullName,
    ink: card.ink,
    condition: cond,
    scope: condition.type === 'mass' ? 'mass' : 'conditional',
    text: card.text ?? '',
  };
}

async function main() {
  console.log('⚙ Pre-computing hoser catalog...');
  const startTime = Date.now();

  const enginePath = path.join(ROOT, 'packages/synergy-engine/dist/index.js');
  if (!fs.existsSync(enginePath)) {
    console.error('ERROR: Engine not built. Run `pnpm build:engine` first.');
    process.exit(1);
  }
  const engineUrl = new URL(`file:///${enginePath.replace(/\\/g, '/')}`);
  const {transformCards, isCoreSet, MIN_CORE_SET, getRemovalCondition} = await import(engineUrl.href);

  const cards = loadCoreCards({transformCards, isCoreSet, MIN_CORE_SET});

  // Scan the pool: keep only conditional/mass removal (drop 'unconditional' and non-removal nulls).
  const byId = new Map();
  for (const card of cards) {
    const condition = getRemovalCondition(card);
    if (!condition || condition.type === 'unconditional') continue;
    byId.set(card.id, toHoser(card, condition));
  }

  // Merge curated overrides (override on cardId collision, append curated-only entries).
  for (const override of CURATED_HOSERS) {
    byId.set(override.cardId, override);
  }

  // Stable ordering by cardId (numeric-aware) for clean diffs.
  const hosers = [...byId.values()].sort((a, b) =>
    a.cardId.localeCompare(b.cardId, undefined, {numeric: true}),
  );

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(hosers, null, 2) + '\n');

  // Summary: total + condition-type distribution.
  const distribution = {};
  for (const h of hosers) {
    distribution[h.condition.type] = (distribution[h.condition.type] ?? 0) + 1;
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Pre-computed hoser catalog in ${elapsed}s`);
  console.log(`  ${hosers.length} hosers (${CURATED_HOSERS.length} curated overrides)`);
  console.log('  Condition distribution:');
  for (const [type, count] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log(`  Output: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Hoser pre-computation failed:', err);
  process.exit(1);
});
