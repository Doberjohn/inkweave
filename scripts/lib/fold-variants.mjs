/**
 * Fold alternate printings into their base card.
 *
 * Epic, Enchanted and Iconic printings are rules-identical reprints of a base card with
 * different art, so they are not cards of their own: each is stored as a small entry in
 * its base card's `variants` array, which the web app shows as a printing switcher (#625).
 * Special promos stay out (graduation Rule 1 still strips them).
 *
 * Shared by `scripts/sync-variants.mjs` (backfill + reveal-season sync) and
 * `scripts/graduate-canonical-set.mjs` (Rule 1), so both write the same entry shape.
 */

export const FOLDED_RARITIES = new Set(['Enchanted', 'Epic', 'Iconic']);

/** Only the two art URLs the image build and the dev loader read (graduation Rule 6). */
function pickImages(images) {
  if (!images) return undefined;
  const out = {};
  if (images.full) out.full = images.full;
  if (images.thumbnail) out.thumbnail = images.thumbnail;
  return Object.keys(out).length > 0 ? out : undefined;
}

function toEntry(variant, id) {
  const entry = {id, rarity: variant.rarity, number: variant.number};
  const images = pickImages(variant.images);
  if (images) entry.images = images;
  return entry;
}

/** Same printing, same art: an existing entry that needs no rewrite (build hashes survive). */
function sameEntry(existing, entry) {
  return (
    existing.id === entry.id &&
    existing.number === entry.number &&
    existing.images?.full === entry.images?.full &&
    existing.images?.thumbnail === entry.images?.thumbnail
  );
}

function baseFinder(baseCards, matchBy) {
  if (matchBy === 'baseId') {
    const byId = new Map(baseCards.map((c) => [c.id, c]));
    return (v) => byId.get(v.baseId);
  }
  if (matchBy === 'name') {
    const byName = new Map(baseCards.map((c) => [`${c.setCode}|${c.fullName}`, c]));
    return (v) => byName.get(`${v.setCode}|${v.fullName}`);
  }
  throw new Error(`foldVariants: unknown matchBy "${matchBy}"`);
}

/** Put `entry` on `base`, replacing a same-rarity entry; returns which report bucket it lands in. */
function upsert(base, entry) {
  const variants = base.variants ?? [];
  const at = variants.findIndex((v) => v.rarity === entry.rarity);
  if (at >= 0 && sameEntry(variants[at], entry)) return 'unchanged';
  if (at >= 0) variants[at] = entry;
  else variants.push(entry);
  variants.sort((a, b) => a.number - b.number);
  base.variants = variants;
  return at >= 0 ? 'replaced' : 'folded';
}

/**
 * Fold the Epic/Enchanted/Iconic printings in `sourceCards` into the `variants` of their base
 * in `baseCards` (mutated in place).
 *
 * - `matchBy: 'baseId'` matches LorcanaJSON's `variant.baseId` to `base.id` (canonical data,
 *   whose ids are LorcanaJSON's).
 * - `matchBy: 'name'` matches on set code + full name (reveal-season preview cards, whose ids
 *   are `REVEAL_ID_BASE + number` rather than LorcanaJSON's).
 * - `idFor(variant)` picks the id stored on the entry.
 *
 * Idempotent: a same-rarity entry is replaced, or left alone when nothing changed (so hashes a
 * local image build injected are not churned). Returns the source variants per outcome.
 */
export function foldVariants(baseCards, sourceCards, {matchBy, idFor}) {
  const findBase = baseFinder(baseCards, matchBy);
  const result = {folded: [], replaced: [], unchanged: [], unmatched: []};
  for (const variant of sourceCards) {
    if (!FOLDED_RARITIES.has(variant.rarity)) continue;
    const base = findBase(variant);
    if (!base) {
      result.unmatched.push(variant);
      continue;
    }
    result[upsert(base, toEntry(variant, idFor(variant)))].push(variant);
  }
  return result;
}
