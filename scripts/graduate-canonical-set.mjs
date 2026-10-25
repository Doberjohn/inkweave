#!/usr/bin/env node
/**
 * Graduate a single set from preview curation to canonical LorcanaJSON data.
 *
 * Reads a per-set LorcanaJSON file (the format LorcanaJSON.org publishes for
 * each set, e.g. `set012.json`), applies the 6 graduation rules (Rule 1 folds
 * every printing, any card with a `baseId`, into its base card's `variants`),
 * replaces any existing entries for that set in `allCards.json`, puts the promo
 * catalog's printings on the new cards as `pnpm merge-promos` does (#805), retargets
 * hardcoded card-id references (featured, playstyle heroes, reveals demos) from
 * preview to canonical, asks for the set's featured cards when the homepage features
 * none of them, writes the Supabase migration that moves votes, cloud collection keys
 * and deck cards the same way (#748), and empties `previewCards.json`.
 *
 * Encodes the 6 graduation rules documented at:
 *   docs/CARD_DATA_PIPELINE.md  (Rules during canonical integration)
 *   memory/feedback_lorcanajson_graduation_rules.md
 *
 * Usage:
 *   node scripts/graduate-canonical-set.mjs <set-code> [source-path] [--allow-missing-variants]
 *                                           [--allow-unmapped-ids]
 *                                           [--featured=<numbers> | --keep-featured]
 *
 *   set-code      Set code as it appears on cards (e.g. "12", "13", "Q1").
 *                 Must match the `setCode` value the app uses for filtering.
 *   source-path   Path to the canonical per-set LorcanaJSON file.
 *                 Defaults to: apps/web/public/data/set{set-code}data.json
 *   --allow-missing-variants
 *                 Graduate even if a printing (Epic, Enchanted, Iconic or any other) would be dropped:
 *                 a hand-scanned preview variant missing from the canonical source, or a
 *                 canonical printing with no base card in it. Without this flag the
 *                 script stops before writing anything.
 *   --allow-unmapped-ids
 *                 Graduate even if a preview card matches no canonical card by number or
 *                 name, so its votes, collection keys and deck cards stay on its preview
 *                 id until it is added to the remap migration by hand. Without this flag
 *                 the script stops before writing anything.
 *   --featured=<numbers>
 *                 The homepage's six featured cards from this set, by collector number, one
 *                 per ink from Amber to Steel (e.g. --featured=28,51,72,109,140,197); six
 *                 that leave an ink out are turned down. Only asked for when the featured
 *                 list holds none of the set's cards; in a terminal the script asks instead,
 *                 and without one it stops before writing anything unless this flag or
 *                 --keep-featured answers.
 *   --keep-featured
 *                 Keep today's featured cards.
 *
 * Examples:
 *   node scripts/graduate-canonical-set.mjs 12
 *   node scripts/graduate-canonical-set.mjs 13 apps/web/public/data/canon-set13.json
 *   pnpm graduate-set 13
 *
 * After running:
 *   1. pnpm precompute-synergies   # regenerate per-card synergy files
 *   2. pnpm refresh-rule-coverage  # rule docs name the sets their counts cover
 *   3. pnpm generate-collection-data <full export>, for the set's Epic, Enchanted,
 *      Iconic and Special printings in collection mode. It reads LorcanaJSON's
 *      full export with the set in it, not the set file
 *   4. pnpm download-images        # fetch any new card images
 *   5. pnpm test                   # confirm no regressions
 *   6. Flip VITE_IS_REVEAL_SEASON=false in .env.local + Vercel env once the set
 *      is released (/reveals hides itself on release day either way)
 *   7. Once the graduated cards are live in production, apply the remap
 *      migration this wrote to supabase/migrations/ with the Supabase MCP's
 *      apply_migration
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {finishesById, finishesReport, givenFinishes, lorcanaFinishes, placeFinishes} from './lib/finishes.mjs';
import {
  FEATURED_COUNT,
  featuredEntry,
  featuredIdsJson,
  missingFeaturedInks,
} from './lib/featured-ids.mjs';
import {foldVariants, isPrinting} from './lib/fold-variants.mjs';
import {mergePromoPrintings} from './lib/promo-printings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ALL_CARDS = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const PROMO_CATALOG = path.join(ROOT, 'scripts/data/promo-printings.json');
const FEATURED_IDS_JSON = path.join(ROOT, 'apps/web/src/features/cards/featuredCardIds.json');
const ENV_EXAMPLE = path.join(ROOT, 'apps/web/.env.example');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');

/**
 * Committed source that hardcodes REAL card ids from a set: the landing-page
 * featured-card list (featuredCardIds.json, #641, which the FeaturedCards test reads),
 * the playstyle-gallery hero cards, and the reveals /
 * playstyle Storybook demos. When a set graduates its ids change, so these are
 * retargeted preview->canonical. Deliberately EXCLUDES self-contained mock-fixture
 * tests (analytics, card-analytics) whose 13xxx ids are arbitrary and
 * must not move — add a new file here only if it references real graduated cards.
 */
const ID_REFERENCE_FILES = [
  'apps/web/src/features/cards/featuredCardIds.json',
  'apps/web/src/shared/constants/playstyleUi.ts',
  'apps/web/.env.example',
  'apps/web/src/features/reveals/InkBoard.stories.tsx',
  'apps/web/src/features/reveals/CardMosaic.stories.tsx',
  'apps/web/src/features/reveals/FranchiseCardsModal.stories.tsx',
  'apps/web/src/features/reveals/CardSlot.stories.tsx',
  'apps/web/src/features/playstyles/PlaystyleFanTile.stories.tsx',
  'apps/web/src/features/playstyles/PlaystyleSection.stories.tsx',
].map((p) => path.join(ROOT, p));

/**
 * Rule 5 — allow-list of fields the synergy engine + web loader consume.
 * Matches `LorcanaJSONCard` in packages/synergy-engine/src/utils/cardTransformer.ts:7-44.
 * Everything else gets stripped at integration time so we don't pay the size
 * cost of unused fields (artists, flavor text, promo metadata, alternate ids).
 *
 * Note: `imageHash`/`imageHashSm` are injected by download-card-images.mjs
 * at build time — not preserved from source. `foilTypes` is stripped too, but where its
 * versions differ from the app's rarity rule they survive as `finishes` (#880), on the card
 * (`applyCardRules`) and on its printings (fold-variants.mjs).
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
 * Rule 1 — variant printings are alternate-art versions of base cards, not new cards.
 * Every printing (a card with a `baseId`, #796) folds into its base card's `variants` (the
 * printing switcher, #625), including the ones that keep their base card's rarity; Special
 * promos are still stripped. An Epic, Enchanted or Iconic counts as a printing even when it
 * has lost its `baseId`: the fold reports it unmatched, which stops the run (or, with
 * --allow-missing-variants, drops it), so it never graduates as a card. Only a card that is
 * none of these stays a card of its own.
 */
const isBaseCard = (card) => !isPrinting(card) && card.rarity !== 'Special';

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
  // Rule 4: LorcanaJSON's `story` is the franchise the preview cards carried as `franchise`.
  // Kept under that name, it holds /reveals' debut-franchise tiers together when a set
  // graduates before its release day, the day the page hides itself.
  if (card.story) out.franchise = card.story;
  // Canonical LorcanaJSON puts set info at the top level, not per-card.
  // Inject setCode so the rest of the pipeline (filtering, browse page) works.
  if (!out.setCode) out.setCode = setCode;
  return out;
}

/**
 * Rules 1, 4, 5, 6 applied to one set's canonical cards: base printings stripped to the kept
 * fields, with their printings folded in by `baseId`; Special dropped.
 *
 * Each card and printing ends with its versions (`finishes`, #880): those `kept` holds for its
 * id, the set's entries in allCards.json as they stand (`finishesById`), which graduation never
 * changes, else LorcanaJSON's where they differ from its rarity's.
 */
export function applyCardRules(sourceCards, setCode, kept = new Map()) {
  const baseCards = sourceCards.filter(isBaseCard);
  const cards = baseCards.map((c) => stripCard(c, setCode));
  const fold = foldVariants(cards, sourceCards, {matchBy: 'baseId', idFor: (v) => v.id, kept});
  // Last, after the `variants` the fold gave the card.
  for (const [i, card] of cards.entries()) {
    placeFinishes(card, kept.get(String(card.id)) ?? lorcanaFinishes(baseCards[i]));
  }
  const specialCount = sourceCards.filter((c) => c.rarity === 'Special').length;
  return {cards, fold, specialCount};
}

/**
 * Rules 2 + 3: the set's cards in `all.cards` replaced wholesale by `newCards` (canonical ids
 * and names win). Rule 1 strips LorcanaJSON's promo cards, so the cards' promo printings come
 * from the promo `catalog`, exactly as `pnpm merge-promos` puts them (#805). Throws, changing
 * nothing, when the catalog can't merge, as when it names a card the new set lacks. Returns the
 * set's old cards and the merge's report.
 */
export function replaceSetCards(all, setCode, newCards, catalog) {
  const dropped = all.cards.filter((card) => card.setCode === setCode);
  const cards = [...all.cards.filter((card) => card.setCode !== setCode), ...newCards];
  const promos = mergePromoPrintings(cards, catalog);
  all.cards = cards;
  return {dropped, promos};
}

/**
 * The graduating set's preview variants that the canonical cards don't carry. A variant
 * hand-scanned during the reveal season (#625) lives only in previewCards.json, which
 * graduation empties, so any of these would be lost. Preview and canonical ids differ, so
 * the match is on rarity + collector number.
 */
export function previewVariantsMissingFrom(previewCards, canonicalCards, setCode) {
  const canonical = new Set(
    canonicalCards.flatMap((c) => (c.variants ?? []).map((v) => `${v.rarity}#${v.number}`)),
  );
  return previewCards
    .filter((c) => String(c.setCode) === String(setCode))
    .flatMap((c) => (c.variants ?? []).map((v) => ({...v, base: c.fullName})))
    .filter((v) => !canonical.has(`${v.rarity}#${v.number}`));
}

/**
 * The versions graduation gave the set's cards and their printings (#880), as `finishesReport`
 * lists them, so a wrong LorcanaJSON entry shows before the set ships: those that `kept`, the
 * set's entries before graduation, didn't hold.
 */
export const graduatedFinishes = (kept, cards) =>
  givenFinishes(kept, cards, (entry, card) => `${entry.id} #${entry.number} ${entry.rarity} ${card.fullName}`);

/**
 * Every variant graduating would drop: canonical printings whose base card isn't in the source
 * (a data anomaly, since a set's file carries its own base cards) and the preview-only ones.
 */
export function droppedVariants(previewCards, {cards, fold}, setCode) {
  return [
    ...fold.unmatched.map((v) => ({
      rarity: v.rarity,
      number: v.number,
      base: v.fullName,
      reason: 'has no base card in the canonical source',
    })),
    ...previewVariantsMissingFrom(previewCards, cards, setCode).map((v) => ({
      rarity: v.rarity,
      number: v.number,
      base: v.base,
      reason: 'is only in previewCards.json',
    })),
  ];
}

/**
 * Step 7 — retarget hardcoded card-id references from the graduating set's PREVIEW
 * ids to their new canonical ids.
 *
 * Committed source hardcodes real card ids in a few spots: the landing-page
 * featured-card list, the playstyle-gallery hero cards, and the reveals /
 * playstyle Storybook demos (ID_REFERENCE_FILES). Graduation renumbers those cards,
 * so every such reference would otherwise dangle. This rewrites those files in place
 * through the preview id -> canonical id map (buildPreviewToCanonicalMap). A featured
 * list that holds none of the set's cards gets new ones from chooseFeaturedEntries.
 *
 * Returns true when it changed a file.
 */
function retargetHardcodedIds(previewToCanonical) {
  if (previewToCanonical.size === 0) {
    console.log(`  Card-id refs:               previewCards empty — skipped\n`);
    return false;
  }

  const touched = retargetIdsInFiles(previewToCanonical);
  if (touched === 0) {
    console.log(`  Card-id refs:               no graduating-set ids referenced — nothing to retarget\n`);
    return false;
  }

  console.log(`  Card-id refs:               retargeted across ${touched} file(s) to canonical`);
  return true;
}

/**
 * Points the hardcoded card ids at the graduated set: step 7's retarget, then any new
 * featured cards. The Vercel `VITE_FEATURED_CARD_IDS` env var lives outside the repo and
 * can't be written here, so the featured ids are printed for a manual paste + redeploy.
 */
function updateCardIdReferences(previewToCanonical, featuredEntries) {
  const retargeted = retargetHardcodedIds(previewToCanonical);
  const picked = writeFeaturedEntries(featuredEntries);
  if (retargeted || picked) printFeaturedVercelHint();
}

/**
 * Map each graduating-set preview id -> canonical id, joined on the shared card number.
 * A card the number can't place (the +900 band has none) falls back to its full name,
 * which can miss: graduation corrected 6 of set 12's names and 14 of set 13's. Other
 * sets' preview cards are skipped, since their numbers would match the wrong cards.
 */
export function buildPreviewToCanonicalMap(previewCards, baseCards, setCode) {
  const byNumber = new Map(baseCards.map((c) => [c.number, String(c.id)]));
  const byName = new Map(baseCards.map((c) => [c.fullName, String(c.id)]));
  const map = new Map();
  for (const pc of previewCards) {
    if (String(pc.setCode) !== String(setCode)) continue;
    const canonId = byNumber.get(pc.number) ?? byName.get(pc.fullName);
    if (canonId) map.set(String(pc.id), canonId);
  }
  return map;
}

/** The graduating set's preview cards the map left out: what is stored on them stays put. */
export function unmappedPreviewCards(previewCards, previewToCanonical, setCode) {
  return previewCards.filter(
    (c) => String(c.setCode) === String(setCode) && !previewToCanonical.has(String(c.id)),
  );
}

/** Quote a value as a SQL string literal. */
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** The remap migration's filename: a UTC `YYYYMMDDHHMMSS` stamp, like every migration here. */
export function remapMigrationName(setCode, date) {
  const stamp = date.toISOString().replace(/\D/g, '').slice(0, 14);
  return `${stamp}_remap_set${String(setCode).toLowerCase()}_preview_ids.sql`;
}

/**
 * The migration that moves votes, cloud collection keys and deck cards from the graduating
 * set's preview ids to its canonical ids (#748), through `internal.remap_card_ids`.
 */
export function remapMigrationSql(setCode, previewToCanonical) {
  const map = JSON.stringify(Object.fromEntries(previewToCanonical), null, 2);
  return `-- Set ${setCode} graduation (#748): move the votes, cloud collection keys and deck cards still
-- on set ${setCode}'s preview ids to the released cards' ids. Written by \`pnpm graduate-set ${setCode}\`,
-- which pairs each preview card with its canonical card by collector number. The function is
-- in 20261013000000_card_id_remap.sql.
--
-- Apply it once the graduated cards are live in production, so no vote lands on a preview id
-- after it runs. Running it again is safe: it moves only what is still on a preview id.
select internal.remap_card_ids(${sqlString(map)}::jsonb, ${sqlString(`set ${setCode} graduation`)});
`;
}

/** Step 8 — write the remap migration for every preview id the map places. */
function writeRemapMigration(setCode, previewToCanonical) {
  if (previewToCanonical.size === 0) {
    console.log(`  Stored-data remap:          no preview ids to move — skipped\n`);
    return;
  }
  const file = path.join(MIGRATIONS, remapMigrationName(setCode, new Date()));
  fs.writeFileSync(file, remapMigrationSql(setCode, previewToCanonical));
  console.log(
    `  Stored-data remap:          ${previewToCanonical.size} preview ids, ${path.relative(ROOT, file)}\n`,
  );
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

/** featuredCardIds.json's entries: `{id, card}`, where `card` reads "<color>: <full name>". */
function readFeaturedEntries() {
  return JSON.parse(fs.readFileSync(FEATURED_IDS_JSON, 'utf8'));
}

/**
 * True when the featured list already holds a graduating-set card: a preview id, which step 7
 * carries over, or one of `baseCards`' canonical ids, which a rerun finds after the first run
 * emptied previewCards.json.
 */
export function featuresGraduatingSet(entries, baseCards, previewToCanonical) {
  const canonicalIds = new Set(baseCards.map((card) => String(card.id)));
  return entries.some(({id}) => previewToCanonical.has(String(id)) || canonicalIds.has(String(id)));
}

/** A LorcanaJSON card's inks: a dual-ink card ("Amber-Emerald") carries both. */
const inksOf = (card) => card.color.split('-');

/**
 * The featured-list entries for an answer of collector numbers, in the order given, or why
 * the answer can't be used: it names six different cards of the set that carry every ink
 * between them. `baseCards` are the graduating set's cards after rule 1.
 */
export function featuredEntriesFor(answer, baseCards) {
  const numbers = answer
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => token.replace(/^0+(?=\d)/, ''));
  if (numbers.length !== FEATURED_COUNT || new Set(numbers).size !== FEATURED_COUNT) {
    return {error: `give ${FEATURED_COUNT} different collector numbers`};
  }
  const byNumber = new Map(baseCards.map((card) => [String(card.number), card]));
  const unknown = numbers.filter((number) => !byNumber.has(number));
  if (unknown.length > 0) return {error: `this set has no card numbered ${unknown.join(', ')}`};
  const cards = numbers.map((number) => byNumber.get(number));
  const missing = missingFeaturedInks(cards.map(inksOf));
  if (missing.length > 0) {
    return {error: `pick one card of each ink (none is ${missing.join(' or ')})`};
  }
  const entries = cards.map((card) =>
    featuredEntry({id: card.id, inks: inksOf(card), fullName: card.fullName}),
  );
  return {entries};
}

/**
 * The homepage's featured cards, settled before anything is written. Step 7 carries featured
 * ids that point at the graduating set over to their canonical ids, but a list that holds none
 * of the set's cards would go on featuring an older set. So this asks for six of them by
 * collector number. Enter keeps today's list, as --keep-featured does, and --featured=<numbers>
 * answers where there is no terminal to ask on. Returns the new entries, or null to keep the
 * list.
 */
async function chooseFeaturedEntries(
  {setCode, featured, keepFeatured},
  baseCards,
  previewToCanonical,
) {
  const current = readFeaturedEntries();
  if (keepFeatured || featuresGraduatingSet(current, baseCards, previewToCanonical)) return null;
  console.log(`  Featured cards:             none from Set ${setCode}. Today's six:`);
  for (const entry of current) console.log(`    ${entry.id}  ${entry.card}`);
  if (featured !== undefined) return entriesFromFlag(featured, baseCards);
  if (!process.stdin.isTTY) stopForFeaturedAnswer();
  return askFeaturedEntries(setCode, baseCards);
}

/** --featured=<numbers>: its entries, or a stop before anything is written. */
function entriesFromFlag(answer, baseCards) {
  const {entries, error} = featuredEntriesFor(answer, baseCards);
  if (entries) return entries;
  console.error(`  --featured: ${error}. Stopped before writing anything.`);
  process.exit(1);
}

function stopForFeaturedAnswer() {
  console.error('  Stopped before writing anything: there is no terminal to ask on.');
  console.error(
    '  Rerun with --featured=<six collector numbers, Amber to Steel> or --keep-featured.',
  );
  process.exit(1);
}

/** Asks until the answer names six of the set's cards; an empty answer keeps the list (null). */
async function askFeaturedEntries(setCode, baseCards) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  rl.on('SIGINT', () => {
    console.error('\n  Stopped before writing anything.');
    process.exit(130);
  });
  try {
    for (;;) {
      const answer = await rl.question(
        `  Six Set ${setCode} collector numbers, Amber to Steel (Enter keeps today's): `,
      );
      if (answer.trim() === '') return null;
      const {entries, error} = featuredEntriesFor(answer, baseCards);
      if (entries) return entries;
      console.log(`    ${error}`);
    }
  } finally {
    rl.close();
  }
}

/** Writes new featured entries, and the .env.example example to match; true when it wrote. */
function writeFeaturedEntries(entries) {
  if (!entries) return false;
  const before = readFeaturedEntries().map((entry) => entry.id);
  fs.writeFileSync(FEATURED_IDS_JSON, featuredIdsJson(entries));
  const example = fs.readFileSync(ENV_EXAMPLE, 'utf8');
  const after = entries.map((entry) => entry.id);
  fs.writeFileSync(
    ENV_EXAMPLE,
    example.replace(
      `VITE_FEATURED_CARD_IDS=${before.join(',')}`,
      `VITE_FEATURED_CARD_IDS=${after.join(',')}`,
    ),
  );
  console.log(`  Featured cards:             ${entries.length} from the graduated set`);
  for (const entry of entries) console.log(`    ${entry.id}  ${entry.card}`);
  return true;
}

/** Print the ordered canonical featured ids for the manual Vercel env update. */
function printFeaturedVercelHint() {
  const ordered = JSON.parse(fs.readFileSync(FEATURED_IDS_JSON, 'utf8')).map((entry) => entry.id);
  if (ordered.length === 0) return;
  console.log(`\n  ⚠ Set the Vercel env var (external to repo — paste + redeploy):`);
  console.log(`    VITE_FEATURED_CARD_IDS=${ordered.join(',')}\n`);
}

/** The run's flags: what it may drop or leave behind, and how the featured cards are settled. */
function parseFlags(args) {
  return {
    allowMissingVariants: args.includes('--allow-missing-variants'),
    allowUnmappedIds: args.includes('--allow-unmapped-ids'),
    featured: args.find((a) => a.startsWith('--featured='))?.slice('--featured='.length),
    keepFeatured: args.includes('--keep-featured'),
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const [setCode, sourceArg] = args.filter((a) => !a.startsWith('--'));
  if (!setCode) {
    console.error(
      'Usage: graduate-canonical-set.mjs <set-code> [source-path] [--allow-missing-variants] [--allow-unmapped-ids]',
    );
    console.error('                                  [--featured=<numbers> | --keep-featured]');
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
  return {setCode: String(setCode), source, ...parseFlags(args)};
}

/** Stops the run, before anything is written, when graduating would drop a variant. */
function guardDroppedVariants(dropped, allowMissingVariants) {
  if (dropped.length === 0) return;
  for (const v of dropped) console.error(`    ! ${v.rarity} #${v.number} of ${v.base} ${v.reason}`);
  if (allowMissingVariants) {
    console.warn(`  --allow-missing-variants: dropping ${dropped.length} variant(s).\n`);
    return;
  }
  console.error('  Stopped before writing anything. Fix the source (or wait for LorcanaJSON),');
  console.error('  or rerun with --allow-missing-variants to drop these printings.');
  process.exit(1);
}

/**
 * Stops the run, before anything is written, when a preview card matches no canonical card:
 * the remap migration would leave its votes, collection keys and deck cards behind (#748).
 */
function guardUnmappedPreviewIds(unmapped, allowUnmappedIds) {
  if (unmapped.length === 0) return;
  for (const c of unmapped) console.error(`    ! ${c.id} ${c.fullName} matched no canonical card`);
  if (allowUnmappedIds) {
    console.warn(
      `  --allow-unmapped-ids: ${unmapped.length} preview id(s) stay put; add them to the remap migration by hand.\n`,
    );
    return;
  }
  console.error('  Stopped before writing anything. Fix the source (or wait for LorcanaJSON),');
  console.error('  or rerun with --allow-unmapped-ids and add them to the migration by hand.');
  process.exit(1);
}

/**
 * `replaceSetCards` with the promo catalog, or a stop before anything is written when the
 * catalog can't merge onto the new cards: point its groups at them, then rerun.
 */
function replaceSetCardsOrStop(all, setCode, newCards) {
  try {
    return replaceSetCards(all, setCode, newCards, JSON.parse(fs.readFileSync(PROMO_CATALOG, 'utf8')));
  } catch (error) {
    console.error(`\n  ${error.message}`);
    console.error('  Stopped before writing anything. Point those groups in scripts/data/promo-printings.json');
    console.error('  at the new cards, then rerun.');
    process.exit(1);
  }
}

const PROMO_OUTCOMES = ['added', 'updated', 'removed', 'unchanged'];

/** The catalog merge's totals in a line, as `pnpm merge-promos` reports them. */
function promoTotals({changes}) {
  const total = (outcome) => changes.reduce((n, change) => n + change[outcome].length, 0);
  return PROMO_OUTCOMES.map((outcome) => `${total(outcome)} ${outcome}`).join(', ');
}

/**
 * Update sets[code] metadata — flip hasAllCards true.
 * If the set didn't exist in allCards.json (first graduation), seed from
 * the canonical file's top-level set metadata.
 */
function markSetGraduated(sets, setCode, canonical) {
  if (sets[setCode]) {
    sets[setCode].hasAllCards = true;
    return;
  }
  sets[setCode] = {
    name: canonical.name,
    number: canonical.number,
    type: canonical.type,
    prereleaseDate: canonical.prereleaseDate,
    releaseDate: canonical.releaseDate,
    hasAllCards: true,
    allowedInFormats: canonical.allowedInFormats,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const {setCode, source, allowMissingVariants, allowUnmappedIds} = args;
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

  // Rule 1 — fold every printing into its base, strip Special; Rules 4, 5, 6 — strip per-card.
  // Any versions the set's entries hold already carry over (#880).
  const kept = finishesById(all.cards.filter((card) => card.setCode === setCode));
  const {cards: stripped, fold, specialCount} = applyCardRules(sourceCards, setCode, kept);
  console.log(`  Canonical input:           ${sourceCards.length} cards`);
  console.log(
    `  Rule 1 - fold variants:    +${fold.folded.length + fold.replaced.length} printings, strip Special: -${specialCount}`,
  );
  for (const line of finishesReport(graduatedFinishes(kept, stripped))) console.log(`  ${line}`);
  const previewCards = existingPreview.cards ?? [];
  const dropped = droppedVariants(previewCards, {cards: stripped, fold}, setCode);
  guardDroppedVariants(dropped, allowMissingVariants);
  const previewToCanonical = buildPreviewToCanonicalMap(previewCards, stripped, setCode);
  const unmapped = unmappedPreviewCards(previewCards, previewToCanonical, setCode);
  guardUnmappedPreviewIds(unmapped, allowUnmappedIds);
  console.log(`  Base cards after rule 1:    ${stripped.length}`);

  // Rules 2 + 3 — replace preview entries wholesale (canonical ids + names win), with the
  // promo catalog's printings on the new cards (#805)
  const beforeReplace = all.cards.length;
  const {dropped: oldSetCards, promos} = replaceSetCardsOrStop(all, setCode, stripped);
  console.log(`  allCards before:            ${beforeReplace} cards`);
  console.log(`  Dropped Set ${setCode} preview:        -${oldSetCards.length}`);
  console.log(`  Appended canonical:        +${stripped.length}`);
  console.log(`  Promo printings (catalog): ${promoTotals(promos)}`);
  console.log(`  allCards after:             ${all.cards.length}\n`);

  markSetGraduated(all.sets, setCode, canonical);

  // Refresh generation timestamp so the Vite plugin's staleness check fires
  all.metadata.generatedOn = new Date().toISOString().slice(0, 19);

  // Asked before the first write, so stopping at the question leaves every file as it was.
  const featuredEntries = await chooseFeaturedEntries(args, stripped, previewToCanonical);

  fs.writeFileSync(ALL_CARDS, JSON.stringify(all, null, 2) + '\n');
  console.log(`  Wrote allCards.json:        ${ALL_CARDS}\n`);

  // Carry card-id references and stored data to the new canonical ids (before reset).
  updateCardIdReferences(previewToCanonical, featuredEntries);
  writeRemapMigration(setCode, previewToCanonical);

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
  console.log(`    2. pnpm refresh-rule-coverage         # rule docs name the sets their counts cover`);
  console.log(`    3. pnpm generate-collection-data <full export>  # printings for collection mode`);
  console.log(`    4. pnpm download-images               # fetch any new card images`);
  console.log(`    5. pnpm test                          # confirm no regressions`);
  console.log(`    6. Flip VITE_IS_REVEAL_SEASON=false   # in .env.local + Vercel env, once released`);
  console.log(
    `    7. Apply the remap migration          # Supabase MCP, once the deploy is live\n`,
  );
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
