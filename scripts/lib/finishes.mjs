/**
 * Which versions a printing comes in (#880): normal, foil or both, in the web app's `Finish`
 * words (`apps/web/src/features/collection/collectionParser.ts`).
 *
 * A printing's entry names them in `finishes`, `["normal"]`, `["foil"]` or `["normal", "foil"]`,
 * only where the app's rarity rule gets them wrong (Enchanted, Epic and Iconic in foil alone,
 * every other rarity in both: `finishesOf` in the app's `printingFinishes.ts`), or where admin's
 * Edit card wrote the owner's correction, Both included. Wherever it is written it is the
 * entry's last key, so every file keeps its format and an edit changes only its own lines.
 *
 * Set printings take theirs from LorcanaJSON's `foilTypes` (graduation, `pnpm sync-variants`
 * and `pnpm generate-collection-data`), promos from the promo catalog (`pnpm merge-promos`),
 * never from LorcanaJSON, whose docs warn that Special-rarity data may be inaccurate. NO SCRIPT
 * CHANGES OR REMOVES A `finishes` ALREADY THERE: a run that rebuilds an entry carries its value
 * over (`finishesById`), so an owner's correction outlives every later run, even one where
 * LorcanaJSON has changed its mind.
 */

/** Both versions, in the order a `finishes` field lists them. */
const BOTH = ['normal', 'foil'];

/** What a `finishes` field may hold. */
const VALID = [['normal'], ['foil'], BOTH];

/** LorcanaJSON's foil type for a printing with no foiling: its normal version. */
const NO_FOIL = 'None';

/** LorcanaJSON's rarity for every promo, whose versions only the catalog gives. */
const PROMO_RARITY = 'Special';

/**
 * The chase printings' rarities, each with a symbol of its own, which the app's rarity rule
 * prints in foil alone. `fold-variants.mjs` also counts them as printings whatever their data
 * says.
 */
export const CHASE_RARITIES = new Set(['Enchanted', 'Epic', 'Iconic']);

const sameVersions = (a, b) => a.join() === b.join();

/** Whether `finishes` is a value the field may hold: one version, or both, in that order. */
export const isFinishes = (finishes) =>
  Array.isArray(finishes) && VALID.some((valid) => sameVersions(valid, finishes));

/** The versions the app's rarity rule gives a printing without the field. */
const rarityFinishes = (rarity) => (CHASE_RARITIES.has(rarity) ? ['foil'] : BOTH);

/** The versions LorcanaJSON's `foilTypes` list, normal first, or none when it lists none. */
function foilTypeVersions(foilTypes) {
  if (!Array.isArray(foilTypes) || foilTypes.length === 0) return undefined;
  return [
    ...(foilTypes.includes(NO_FOIL) ? ['normal'] : []),
    ...(foilTypes.some((type) => type !== NO_FOIL) ? ['foil'] : []),
  ];
}

/**
 * The `finishes` LorcanaJSON gives a set printing: the versions its `foilTypes` list ("None" is
 * the normal version, any other entry a foil type, so the foil one), where they differ from its
 * rarity's. None for a promo, nor where `foilTypes` is missing, as LorcanaJSON leaves it out for
 * external reveals.
 */
export function lorcanaFinishes({rarity, foilTypes}) {
  if (rarity === PROMO_RARITY) return undefined;
  const versions = foilTypeVersions(foilTypes);
  return versions === undefined || sameVersions(versions, rarityFinishes(rarity))
    ? undefined
    : versions;
}

/** Every entry of `cards`: each card, then its `variants`. */
const entriesOf = (cards) => cards.flatMap((card) => [card, ...(card.variants ?? [])]);

/**
 * Every `finishes` already in `cards` and their `variants`, by id: what a run that rebuilds
 * those entries carries over, and what its report compares against (`givenFinishes`).
 */
export function finishesById(cards) {
  const byId = new Map();
  for (const entry of entriesOf(cards)) {
    if (entry.finishes !== undefined) byId.set(String(entry.id), entry.finishes);
  }
  return byId;
}

/** Make `finishes` the last key of `entry` (mutated), or leave it none. Returns `entry`. */
export function placeFinishes(entry, finishes) {
  delete entry.finishes;
  if (finishes !== undefined) entry.finishes = finishes;
  return entry;
}

/**
 * The printings among `cards` (and their `variants`) whose `finishes` this run gave: those that
 * hold one `before` didn't hold for their id, or another, each as `{label, finishes}`, labelled
 * by `label(entry, card)`. Since a set script never changes a value, only the catalog's promos
 * can be given another.
 */
export function givenFinishes(before, cards, label) {
  return cards.flatMap((card) =>
    [card, ...(card.variants ?? [])]
      .filter(
        ({id, finishes}) =>
          finishes !== undefined && before.get(String(id))?.join() !== finishes.join(),
      )
      .map((entry) => ({label: label(entry, card), finishes: entry.finishes})),
  );
}

/** "foil only", "normal only" or "both": what a `finishes` says. */
const versionsName = (finishes) => (finishes.length === 1 ? `${finishes[0]} only` : 'both');

/**
 * The lines a script prints for the printings it gave a `finishes` (`givenFinishes`): how many,
 * then each by name, so a wrong LorcanaJSON entry stands out at the next graduation.
 */
export function finishesReport(given) {
  return [
    `Versions given (finishes, #880): ${given.length === 0 ? 'none' : given.length}`,
    ...given.map(({label, finishes}) => `  ${label}: ${versionsName(finishes)}`),
  ];
}
