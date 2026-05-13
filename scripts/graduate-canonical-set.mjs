#!/usr/bin/env node
/**
 * Graduate a single set from preview curation to canonical LorcanaJSON data.
 *
 * Reads a per-set LorcanaJSON file (the format LorcanaJSON.org publishes for
 * each set, e.g. `set012.json`), strips it per the 6 graduation rules,
 * replaces any existing entries for that set in `allCards.json`, and empties
 * `previewCards.json`.
 *
 * Encodes the 6 graduation rules documented at:
 *   docs/CARD_DATA_PIPELINE.md  (Rules during canonical integration)
 *   memory/feedback_lorcanajson_graduation_rules.md
 *
 * Usage:
 *   node scripts/graduate-canonical-set.mjs <set-code> [source-path]
 *
 *   set-code      Set code as it appears on cards (e.g. "12", "13", "Q1").
 *                 Must match the `setCode` value the app uses for filtering.
 *   source-path   Path to the canonical per-set LorcanaJSON file.
 *                 Defaults to: apps/web/public/data/set{set-code}data.json
 *
 * Examples:
 *   node scripts/graduate-canonical-set.mjs 12
 *   node scripts/graduate-canonical-set.mjs 13 apps/web/public/data/canon-set13.json
 *   pnpm graduate-set 13
 *
 * After running:
 *   1. pnpm precompute-synergies   # regenerate per-card synergy files
 *   2. pnpm download-images        # fetch any new card images
 *   3. pnpm test                   # confirm no regressions
 *   4. Flip VITE_IS_REVEAL_SEASON=false in .env.local + Vercel env
 *      (deactivates /reveals route until next reveal season)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ALL_CARDS = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW = path.join(ROOT, 'apps/web/public/data/previewCards.json');

/**
 * Rule 5 — allow-list of fields the synergy engine + web loader consume.
 * Matches `LorcanaJSONCard` in packages/synergy-engine/src/utils/cardTransformer.ts:7-44.
 * Everything else gets stripped at integration time so we don't pay the size
 * cost of unused fields (artists, flavor text, promo metadata, alternate ids).
 *
 * Note: `imageHash`/`imageHashSm` are injected by download-card-images.mjs
 * at build time — not preserved from source.
 */
const KEEP_FIELDS = [
  'id',
  'name',
  'version',
  'fullName',
  'cost',
  'color',
  'inkwell',
  'type',
  'subtypes',
  'abilities',
  'fullText',
  'fullTextSections',
  'moveCost',
  'strength',
  'willpower',
  'lore',
  'keywordAbilities',
  'images',
  'setCode',
  'number',
  'rarity',
];

/**
 * Rule 1 — variant printings the app doesn't currently render. These are
 * alternate-art versions of base cards, not new cards. Remove this filter
 * once multi-variant support ships in the app.
 */
const VARIANT_RARITIES = new Set(['Epic', 'Iconic', 'Enchanted', 'Special']);

/** Rule 6 — strip foilMask from images, keep only full + thumbnail. */
function stripImages(images) {
  if (!images || typeof images !== 'object') return undefined;
  const out = {};
  if (images.full) out.full = images.full;
  if (images.thumbnail) out.thumbnail = images.thumbnail;
  return out;
}

function stripCard(card, setCode) {
  const out = {};
  for (const k of KEEP_FIELDS) {
    if (k in card) out[k] = card[k];
  }
  if (out.images) out.images = stripImages(out.images);
  // Canonical LorcanaJSON puts set info at the top level, not per-card.
  // Inject setCode so the rest of the pipeline (filtering, browse page) works.
  if (!out.setCode) out.setCode = setCode;
  return out;
}

function parseArgs(argv) {
  const [, , setCode, sourceArg] = argv;
  if (!setCode) {
    console.error('Usage: graduate-canonical-set.mjs <set-code> [source-path]');
    console.error('Example: graduate-canonical-set.mjs 13');
    process.exit(2);
  }
  const source = sourceArg
    ? path.resolve(sourceArg)
    : path.join(ROOT, `apps/web/public/data/set${setCode}data.json`);
  if (!fs.existsSync(source)) {
    console.error(`Canonical source not found: ${source}`);
    console.error(`Place the per-set LorcanaJSON file there, or pass an explicit path.`);
    process.exit(2);
  }
  return {setCode: String(setCode), source};
}

function main() {
  const {setCode, source} = parseArgs(process.argv);
  console.log(`\n  Graduating Set ${setCode} from preview to canonical\n`);
  console.log(`  Source: ${source}\n`);

  const all = JSON.parse(fs.readFileSync(ALL_CARDS, 'utf8'));
  const canonical = JSON.parse(fs.readFileSync(source, 'utf8'));
  const sourceCards = canonical.cards ?? canonical;
  if (!Array.isArray(sourceCards)) {
    console.error(`Source file has no .cards array (got keys: ${Object.keys(canonical).join(', ')})`);
    process.exit(2);
  }

  // Rule 1 — drop variant rarities
  const variantCount = sourceCards.filter((c) => VARIANT_RARITIES.has(c.rarity)).length;
  const baseCards = sourceCards.filter((c) => !VARIANT_RARITIES.has(c.rarity));
  console.log(`  Canonical input:           ${sourceCards.length} cards`);
  console.log(`  Rule 1 - strip variants:   -${variantCount} (Epic/Iconic/Enchanted/Special)`);
  console.log(`  Base cards after rule 1:    ${baseCards.length}`);

  // Rules 4, 5, 6 — strip per-card
  const stripped = baseCards.map((c) => stripCard(c, setCode));

  // Rules 2 + 3 — replace preview entries wholesale (canonical ids + names win)
  const beforeReplace = all.cards.length;
  const droppedPreview = all.cards.filter((c) => c.setCode === setCode).length;
  all.cards = all.cards.filter((c) => c.setCode !== setCode);
  all.cards.push(...stripped);
  console.log(`  allCards before:            ${beforeReplace} cards`);
  console.log(`  Dropped Set ${setCode} preview:        -${droppedPreview}`);
  console.log(`  Appended canonical:        +${stripped.length}`);
  console.log(`  allCards after:             ${all.cards.length}\n`);

  // Update sets[code] metadata — flip hasAllCards true.
  // If the set didn't exist in allCards.json (first graduation), seed from
  // the canonical file's top-level set metadata.
  if (!all.sets[setCode]) {
    all.sets[setCode] = {
      name: canonical.name,
      number: canonical.number,
      type: canonical.type,
      prereleaseDate: canonical.prereleaseDate,
      releaseDate: canonical.releaseDate,
      hasAllCards: true,
      allowedInFormats: canonical.allowedInFormats,
    };
  } else {
    all.sets[setCode].hasAllCards = true;
  }

  // Refresh generation timestamp so the Vite plugin's staleness check fires
  all.metadata.generatedOn = new Date().toISOString().slice(0, 19);

  fs.writeFileSync(ALL_CARDS, JSON.stringify(all, null, 2) + '\n');
  console.log(`  Wrote allCards.json:        ${ALL_CARDS}\n`);

  // Reset previewCards.json — empty cards, but preserve sets[setCode] metadata
  // so revealDates.ts (which reads prereleaseDate/releaseDate from this file)
  // keeps working post-graduation. The next graduation overwrites with its own
  // set's metadata, naturally retiring the previous set's dates.
  const emptyPreview = {
    metadata: {
      formatVersion: '2.3.2',
      generatedOn: all.metadata.generatedOn,
      language: 'en',
    },
    sets: all.sets[setCode] ? {[setCode]: all.sets[setCode]} : {},
    cards: [],
  };
  fs.writeFileSync(PREVIEW, JSON.stringify(emptyPreview, null, 2) + '\n');
  console.log(`  Reset previewCards.json:    ${PREVIEW}\n`);
  console.log(`  (sets[${setCode}] metadata preserved for revealDates.ts compatibility)\n`);

  console.log(`  Next steps:`);
  console.log(`    1. pnpm precompute-synergies          # regenerate per-card synergy files`);
  console.log(`    2. pnpm download-images               # fetch any new card images`);
  console.log(`    3. pnpm test                          # confirm no regressions`);
  console.log(`    4. Flip VITE_IS_REVEAL_SEASON=false   # in .env.local + Vercel env\n`);
}

main();
