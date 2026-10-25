/**
 * The homepage's featured-card list, apps/web/src/features/cards/featuredCardIds.json: its
 * shape, the rule six cards must meet, and the file's text. Graduation writes the file through
 * these, and so does admin's Featured cards page (Doberjohn/inkweave-admin#95), which bridges
 * this module into the browser, so it imports nothing from Node.
 */

/** The homepage shows exactly six featured cards (featured.ts). */
export const FEATURED_COUNT = 6;

/** The inks in the list's order, one card for each: Amber to Steel. */
export const FEATURED_INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

/**
 * A card's line in featuredCardIds.json: its id, and "<inks>: <full name>", a dual-ink card's
 * inks joined by "-" as LorcanaJSON's `color` joins them.
 *
 * @param {{id: string | number, inks: readonly string[], fullName: string}} card
 * @returns {{id: string, card: string}}
 */
export function featuredEntry({id, inks, fullName}) {
  return {id: String(id), card: `${inks.join('-')}: ${fullName}`};
}

/**
 * The inks that none of the cards carries, each card given as its list of inks.
 *
 * @param {readonly (readonly string[])[]} cardInks
 * @returns {string[]}
 */
export function missingFeaturedInks(cardInks) {
  const carried = new Set(cardInks.flat());
  return FEATURED_INKS.filter((ink) => !carried.has(ink));
}

/**
 * Why a featured list can't be used, or null when it can: it must name FEATURED_COUNT different
 * cards that carry every ink between them. Graduation checks its answer with this, and admin's
 * Featured cards page checks a list with it before committing it.
 *
 * @param {readonly {id: string | number, inks: readonly string[]}[]} cards
 * @returns {string | null}
 */
export function featuredListProblem(cards) {
  const ids = new Set(cards.map(({id}) => String(id)));
  if (cards.length !== FEATURED_COUNT || ids.size !== FEATURED_COUNT) {
    return `pick ${FEATURED_COUNT} different cards`;
  }
  const missing = missingFeaturedInks(cards.map(({inks}) => inks));
  return missing.length > 0
    ? `pick cards that carry every ink between them (no card is ${missing.join(' or ')})`
    : null;
}

/**
 * featuredCardIds.json's text: one entry per line, as the file is kept.
 *
 * @param {readonly {id: string, card: string}[]} entries
 * @returns {string}
 */
export function featuredIdsJson(entries) {
  const lines = entries.map(
    ({id, card}) => `  {"id": ${JSON.stringify(id)}, "card": ${JSON.stringify(card)}}`,
  );
  return `[\n${lines.join(',\n')}\n]\n`;
}
