/**
 * The collection dataset: every card Inkweave can SHOW but will not analyse (#553).
 *
 * `apps/web/public/data/allCards.json` is the Core pool and the only input to the
 * synergy engine, the deck builder and the playstyle pages. This module builds the
 * OTHER 2,152 cards: sets 1-8 and the Enchanted/Epic/Iconic/Special
 * printings inside Core sets — for collection viewing only.
 *
 * **Nothing appears in both datasets.** That is the invariant the whole Core
 * boundary rests on: the build scripts read `allCards.json` and never open these
 * files, so a non-Core card cannot reach a synergy calculation by construction
 * rather than by anyone remembering a rule.
 *
 * TWO TIERS, because the honest payload is larger than it first looked. The chunks
 * feed the engine's `transformCard`, whose `LorcanaJSONCard` interface reads nine
 * fields an earlier design omitted — `name`, `strength`, `willpower`, `lore`,
 * `abilities` among them — so a card built from that projection would render
 * nameless and statless. Complete, it measures 445 KB gzip, not the 118 KB the
 * design estimated. Hence:
 *
 *   - INDEX (~69 KB gzip, all 2,152 cards): what the grid and every filter need.
 *     Loaded once when collection mode turns on.
 *   - DETAIL (5-42 KB gzip per set): card text, stats, abilities and image URLs.
 *     Loaded for the set being viewed, which is also the binder's page unit.
 *
 * The index deliberately carries no image URLs; the binder views one set at a time
 * and so always holds that set's detail chunk. If cross-set filtered results turn
 * out to need thumbnails, add `images` to INDEX_FIELDS and regenerate.
 */

/** Fields the grid, the filters and name search need. No text, stats or images. */
export const INDEX_FIELDS = [
  'id',
  'name',
  'version',
  'fullName',
  'cost',
  'color',
  'inkwell',
  'type',
  'subtypes',
  'setCode',
  'number',
  'rarity',
  // Alternate printings point at the Core card they reprint. 260 of 260 resolve,
  // which is what lets an Enchanted card show its base card's real synergies.
  'baseId',
];

/**
 * Everything `transformCard` reads, so a detail chunk round-trips into a real
 * `LorcanaCard`. Derived from the engine's `LorcanaJSONCard` interface
 * (`packages/synergy-engine/src/utils/cardTransformer.ts`) — if that interface
 * gains a field, this list must follow or the card renders incomplete.
 */
export const DETAIL_FIELDS = [
  ...INDEX_FIELDS,
  'abilities',
  'fullText',
  'fullTextSections',
  'moveCost',
  'strength',
  'willpower',
  'lore',
  'keywordAbilities',
];

/**
 * Image URLs kept in a detail chunk. `thumbnail` is what `resolveImageUrl` reads
 * outside the production build; `full` carries the upstream content hash that
 * Phase A's restore path compares against (#554). `foilMask` is read by nothing
 * and costs 72 KB gzip across the set.
 */
const DETAIL_IMAGE_KEYS = ['thumbnail', 'full'];

/**
 * Illumineer's Quest sets, excluded from the collection dataset entirely (owner ruling,
 * 2026-10-06). Those are a separate co-op product, not trading-card boosters, so they are
 * not part of the collection anyone is tracking. Sets 1-8 stay: they are equally outside
 * Core format, but they are the same product and the whole reason this dataset exists.
 *
 * A side effect worth knowing: Quest cards carry `"color": ""`, which `parseInks` rejects,
 * so `transformCard` returns null and `transformCards` drops them silently. Excluding them
 * removes that trap rather than leaving it for Phase C to discover.
 *
 * Matches a future Q3 box automatically.
 */
const QUEST_SET_CODE = /^Q\d+$/i;

/** A set code that is safe as a filename: digits, or a letter-prefixed code. */
const SAFE_SET_CODE = /^[A-Za-z0-9]+$/;

/** The index tier's own filename, which no detail chunk may claim. */
const RESERVED_SET_CODE = 'index';

/** Copy `fields` that are actually present. Absent stays absent, never null. */
function pickFields(card, fields) {
  const out = {};
  for (const field of fields) {
    if (card[field] !== undefined) out[field] = card[field];
  }
  return out;
}

/**
 * Every card not already served by another dataset.
 *
 * Takes a LIST of id sets, not one: `allCards.json` is the obvious exclusion, but
 * `previewCards.json` also merges into the Core pool at runtime
 * (`features/cards/loader.ts` admits a preview card whose id is absent from the
 * primary file). A card in the full export and in previewCards but not yet in
 * allCards would otherwise appear twice in collection mode. Currently moot —
 * previewCards holds 0 cards off-season — which is exactly why it is easy to miss.
 */
export function selectCollectionCards(fullCards, excludedIdSets) {
  const excluded = new Set();
  for (const set of excludedIdSets) {
    for (const id of set) excluded.add(String(id));
  }
  return fullCards.filter(
    (card) => !excluded.has(String(card.id)) && !QUEST_SET_CODE.test(String(card.setCode)),
  );
}

/** The light tier: one entry per card, every set. */
export function buildIndex(cards) {
  return cards.map((card) => pickFields(card, INDEX_FIELDS));
}

/** The heavy tier, split per set. Returns Map<setCode, card[]>. */
export function buildDetailChunks(cards) {
  const chunks = new Map();
  for (const card of cards) {
    const detail = pickFields(card, DETAIL_FIELDS);
    if (card.images) {
      const images = pickFields(card.images, DETAIL_IMAGE_KEYS);
      if (Object.keys(images).length > 0) detail.images = images;
    }
    const setCode = String(card.setCode);
    chunks.set(setCode, [...(chunks.get(setCode) ?? []), detail]);
  }
  return chunks;
}

/**
 * Filename for a set's chunk. Validated rather than trusted: the set code comes
 * from an external data file and is interpolated into a path, so a `../` in it
 * would write outside the output directory.
 */
export function chunkFilename(setCode) {
  const code = String(setCode);
  if (!SAFE_SET_CODE.test(code)) {
    throw new Error(`Unsafe set code for a filename: ${JSON.stringify(setCode)}`);
  }
  // `index` is safe as a path but collides with the index tier: a set carrying that
  // code would write index.json and silently replace the all-cards projection with
  // one set's detail. Reserved rather than escaped, because a set genuinely named
  // "index" is upstream data we would want to look at, not quietly rename.
  if (code.toLowerCase() === RESERVED_SET_CODE) {
    throw new Error(`Set code "${code}" is reserved: it would overwrite index.json`);
  }
  return `${code}.json`;
}
