#!/usr/bin/env node
/**
 * Graduate a single set from preview curation to canonical LorcanaJSON data.
 *
 * Reads a per-set LorcanaJSON file (the format LorcanaJSON.org publishes for
 * each set, e.g. `set012.json`), strips it per the 6 graduation rules,
 * replaces any existing entries for that set in `allCards.json`, retargets
 * hardcoded card-id references (featured, playstyle heroes, reveals demos) from
 * preview to canonical, and empties `previewCards.json`.
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
const FEATURED_TSX = path.join(ROOT, 'apps/web/src/features/cards/components/FeaturedCards.tsx');

/**
 * Committed source that hardcodes REAL card ids from a set: the landing-page
 * featured cards + their test, the playstyle-gallery hero cards, and the reveals /
 * playstyle Storybook demos. When a set graduates its ids change, so these are
 * retargeted preview->canonical. Deliberately EXCLUDES self-contained mock-fixture
 * tests (analytics, reveal-admin, card-analytics) whose 13xxx ids are arbitrary and
 * must not move — add a new file here only if it references real graduated cards.
 */
const ID_REFERENCE_FILES = [
  'apps/web/src/features/cards/components/FeaturedCards.tsx',
  'apps/web/src/features/cards/components/__tests__/FeaturedCards.test.tsx',
  'apps/web/src/shared/constants/playstyleUi.ts',
  'apps/web/.env.example',
  'apps/web/src/features/reveals/setSpotlights.ts',
  'apps/web/src/features/reveals/InkBoard.stories.tsx',
  'apps/web/src/features/reveals/CardMosaic.stories.tsx',
  'apps/web/src/features/reveals/FranchiseCardsModal.stories.tsx',
  'apps/web/src/features/reveals/CardSlot.stories.tsx',
  'apps/web/src/features/playstyles/PlaystyleFanTile.stories.tsx',
  'apps/web/src/features/playstyles/PlaystyleSection.stories.tsx',
  'apps/web/src/features/reveal-admin/components/CardPreviewPanel.stories.tsx',
  'apps/web/src/features/reveal-admin/components/RevealAdminForm.stories.tsx',
].map((p) => path.join(ROOT, p));

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

/**
 * Step 7 — retarget hardcoded card-id references from the graduating set's PREVIEW
 * ids to their new canonical ids.
 *
 * Committed source hardcodes real card ids in a few spots: the landing-page
 * featured cards + their test, the playstyle-gallery hero cards, and the reveals /
 * playstyle Storybook demos (ID_REFERENCE_FILES). Graduation renumbers those cards,
 * so every such reference would otherwise dangle. This maps each graduating-set
 * preview id -> canonical id (previewCards' id<->number joined to the canonical
 * number<->id) and rewrites those files in place.
 *
 * The Vercel `VITE_FEATURED_CARD_IDS` env var lives outside the repo and can't be
 * written here — the translated value is printed for a manual paste + redeploy.
 *
 * TODO(future): when the featured ids don't reference the graduating set (a brand
 * new set with no pre-picked cards), prompt for which canonical ids to feature
 * rather than only translating existing ones.
 */
function retargetHardcodedIds(previewCards, baseCards) {
  const previewToCanonical = buildPreviewToCanonicalMap(previewCards, baseCards);
  if (previewToCanonical.size === 0) {
    console.log(`  Card-id refs:               previewCards empty — skipped\n`);
    return;
  }

  const touched = retargetIdsInFiles(previewToCanonical);
  if (touched === 0) {
    console.log(`  Card-id refs:               no graduating-set ids referenced — nothing to retarget\n`);
    return;
  }

  console.log(`  Card-id refs:               retargeted across ${touched} file(s) to canonical`);
  printFeaturedVercelHint();
}

/** Map each graduating-set preview id -> canonical id, joined on the shared card number. */
function buildPreviewToCanonicalMap(previewCards, baseCards) {
  const numberToCanonical = new Map(baseCards.map((c) => [c.number, String(c.id)]));
  const map = new Map();
  for (const pc of previewCards) {
    const canonId = numberToCanonical.get(pc.number);
    if (canonId) map.set(String(pc.id), canonId);
  }
  return map;
}

/** Replace every graduating-set preview id in one file; return true if it changed. */
function retargetFileIds(file, previewToCanonical) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const [pid, cid] of previewToCanonical) {
    after = after.replace(new RegExp(`\\b${pid}\\b`, 'g'), cid);
  }
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

/** Run the id retarget across every reference file; return how many changed. */
function retargetIdsInFiles(previewToCanonical) {
  let touched = 0;
  for (const file of ID_REFERENCE_FILES) {
    if (retargetFileIds(file, previewToCanonical)) touched++;
  }
  return touched;
}

/** Print the ordered canonical featured ids for the manual Vercel env update. */
function printFeaturedVercelHint() {
  const block = fs.readFileSync(FEATURED_TSX, 'utf8').match(/DEFAULT_FEATURED_IDS\s*=\s*\[([\s\S]*?)]/);
  const ordered = block ? [...block[1].matchAll(/'(\d+)'/g)].map((m) => m[1]) : [];
  if (ordered.length === 0) return;
  console.log(`\n  ⚠ Set the Vercel env var (external to repo — paste + redeploy):`);
  console.log(`    VITE_FEATURED_CARD_IDS=${ordered.join(',')}\n`);
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
  // Snapshot preview cards BEFORE the reset below empties them — the featured-id
  // retarget needs the graduating set's preview id<->number pairs.
  const existingPreview = fs.existsSync(PREVIEW)
    ? JSON.parse(fs.readFileSync(PREVIEW, 'utf8'))
    : {cards: []};
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

  // Retarget hardcoded card-id references to the new canonical ids (before reset).
  retargetHardcodedIds(existingPreview.cards ?? [], stripped);

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
