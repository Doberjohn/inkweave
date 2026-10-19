/**
 * Fold alternate printings into their base card.
 *
 * Alternate printings are rules-identical reprints of a base card with different art, so
 * they are not cards of their own: each is stored as a small entry in its base card's
 * `variants` array, which the web app shows as a printing switcher (#625). LorcanaJSON's
 * Special promos never fold (graduation Rule 1 still strips them): a card's promo entries come
 * from the promo catalog alone (scripts/lib/promo-printings.mjs, #805), and a fold leaves them be.
 *
 * A PRINTING IS WHAT HAS A `baseId`, not only what has a chase rarity (#796). LorcanaJSON
 * links every Epic, Enchanted and Iconic printing to its base card, and also four printings
 * that keep their base card's rarity (Sets 11 to 13, numbered after the Iconics: Sven #243,
 * Mr. Incredible #243, Christopher Robin #246, Violet Parr #247). A rarity list missed those;
 * the link does not, and it will not miss the next kind either. The chase rarities still
 * count on their own as a second guard: an Epic, Enchanted or Iconic that lost its `baseId`
 * is reported unmatched, which stops a graduation, instead of passing as a card of its own.
 *
 * Shared by `scripts/sync-variants.mjs` (backfill + reveal-season sync) and
 * `scripts/graduate-canonical-set.mjs` (Rule 1), so both write the same entry shape, and by
 * `scripts/lib/promo-printings.mjs` for the printings' order.
 */

const CHASE_RARITIES = new Set(['Enchanted', 'Epic', 'Iconic']);

/**
 * A printing of another card: one with a `baseId` (LorcanaJSON gives every printing one,
 * promos included), or one of a chase rarity whatever its data says.
 */
export const isPrinting = (card) => card.baseId !== undefined || CHASE_RARITIES.has(card.rarity);

/** A promo printing: LorcanaJSON gives every promo the rarity Special. */
export const isPromo = (card) => card.rarity === 'Special';

/** The printings that fold: every one but the Special promos. */
const folds = (card) => isPrinting(card) && !isPromo(card);

/** Where a promo whose number is unknown sorts by number: after every numbered one (#805). */
const UNNUMBERED = Number.MAX_SAFE_INTEGER;

/**
 * A card's printings in the order the web app's switcher shows them (`byDisplayOrder` in
 * usePrintingSelection.ts): the other printings by collector number, then the promos by set in
 * natural order (C2 before CC1, P2 before P10) and number, an unknown number last (#805).
 */
export function byPrintingOrder(a, b) {
  const promosLast = Number(isPromo(a)) - Number(isPromo(b));
  const bySet = (a.promoGrouping ?? '').localeCompare(b.promoGrouping ?? '', undefined, {
    numeric: true,
  });
  return promosLast || bySet || (a.number ?? UNNUMBERED) - (b.number ?? UNNUMBERED);
}

/** Only the two art URLs the image build and the dev loader read (graduation Rule 6). */
export function pickImages(images) {
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

/** What an entry is: its printing, its rarity and its art. */
const ENTRY_FACTS = [
  (entry) => entry.id,
  (entry) => entry.number,
  (entry) => entry.rarity,
  (entry) => entry.images?.full,
  (entry) => entry.images?.thumbnail,
];

/**
 * Same printing, same rarity, same art: an existing entry that needs no rewrite (build hashes
 * survive). The rarity counts because entries are found by number: a corrected rarity must
 * reach the entry, not leave the stale one in place.
 */
function sameEntry(existing, entry) {
  return ENTRY_FACTS.every((fact) => fact(existing) === fact(entry));
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

/**
 * Put `entry` on `base`, replacing the entry for the same printing; returns which report bucket
 * it lands in. A printing is known by its collector number, which stays put when a hand scan's
 * entry is replaced by official art. Not by rarity: a card can hold two printings of one rarity
 * now that printings which keep their base card's rarity fold too (#796). Promos are never
 * matched: their numbers restart in every promo set, and only the promo catalog writes them
 * (#805), so they stay as they are, after the other printings.
 */
function upsert(base, entry) {
  const variants = base.variants ?? [];
  const at = slotOf(variants, entry);
  if (at < 0) {
    variants.push(entry);
    base.variants = variants.sort(byPrintingOrder);
    return 'folded';
  }
  if (sameEntry(variants[at], entry)) return 'unchanged';
  variants[at] = entry;
  base.variants = variants.sort(byPrintingOrder);
  return 'replaced';
}

/** Where `entry`'s printing sits among `variants`: the entry with its collector number, never a promo. */
const slotOf = (variants, entry) => variants.findIndex((v) => !isPromo(v) && v.number === entry.number);

/**
 * Fold the printings in `sourceCards` (every card with a `baseId` but the Special promos) into
 * the `variants` of their base in `baseCards` (mutated in place).
 *
 * - `matchBy: 'baseId'` matches LorcanaJSON's `variant.baseId` to `base.id` (canonical data,
 *   whose ids are LorcanaJSON's).
 * - `matchBy: 'name'` matches on set code + full name (reveal-season preview cards, whose ids
 *   are `REVEAL_ID_BASE + number` rather than LorcanaJSON's).
 * - `idFor(variant)` picks the id stored on the entry.
 *
 * Idempotent: the entry with the same collector number is replaced, or left alone when nothing changed (so hashes a
 * local image build injected are not churned). Returns the source variants per outcome.
 */
export function foldVariants(baseCards, sourceCards, {matchBy, idFor}) {
  const findBase = baseFinder(baseCards, matchBy);
  const result = {folded: [], replaced: [], unchanged: [], unmatched: []};
  for (const variant of sourceCards) {
    if (!folds(variant)) continue;
    const base = findBase(variant);
    if (!base) {
      result.unmatched.push(variant);
      continue;
    }
    result[upsert(base, toEntry(variant, idFor(variant)))].push(variant);
  }
  return result;
}
