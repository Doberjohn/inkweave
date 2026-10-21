/**
 * Merge the promo catalog into allCards.json's cards (#805).
 *
 * The catalog (`scripts/data/promo-printings.json`, settled by the owner on 2026-10-16) is the
 * one source of a card's Special printings. Its `fold` section lists, per Core card (`baseId`,
 * the LorcanaJSON id allCards.json keeps), every promo printing of it. A merge makes each card's
 * promo entries exactly the catalog's, in the order the web switcher shows them, and leaves the
 * card's other printings as they were, ahead of the promos. `noBaseCard` holds the promos of
 * cards allCards.json doesn't hold (reprints of pre-Core cards): they wait there for their cards.
 *
 * Nothing else writes a promo entry: LorcanaJSON's promo cards never fold (fold-variants.mjs
 * skips Specials, and graduation strips them). Idempotent: a second run changes nothing.
 *
 * Collection mode lists every promo of both sections, from `collectionPromos` below.
 */
import {isFinishes, placeFinishes} from './finishes.mjs';
import {byPrintingOrder, isPromo, pickImages} from './fold-variants.mjs';

/** A promo entry as the reports name it: its id and the code printed on it ("2432 10/P3"). */
export const promoLabel = ({id, number, promoGrouping, finish}) =>
  `${id} ${number ?? '?'}/${promoGrouping}${finish ? ` ${finish}` : ''}`;

/**
 * A promo entry's fields, in the order it writes them; its art follows as `images`, and its
 * versions, last, as `finishes` (`withVersions`). `finish` tells two printings under one code
 * apart; `finishes` (#880) is what a printing comes in.
 */
const ENTRY_FIELDS = ['id', 'rarity', 'number', 'promoGrouping', 'finish', 'scanLanguage'];

/**
 * A collection promo's fields: a variant entry's, `artVariant`, which tells two arts under one
 * number apart (Hiro Hamada - Armor Designer's 24A/P2 and 24B/P2 in Dreamborn's export), so the
 * collection import can match each, and `printedName`, the character's name on a printing that
 * isn't its card's (26/P2's European printing, Vaiana, of Moana - Adventurer of Land and Sea).
 */
const COLLECTION_FIELDS = [...ENTRY_FIELDS, 'artVariant', 'printedName'];

/**
 * A catalog printing as a card's variant entry: its printing fields and art, nothing the
 * catalog lacks, and no null. So a number nobody knows yet is left out (no printing lacks one
 * today), and so are `artVariant` and `promoSource`, which only `noBaseCard` printings carry.
 */
function toEntry(printing, fields = ENTRY_FIELDS) {
  const entry = {};
  for (const field of fields) {
    if (printing[field] != null) entry[field] = printing[field];
  }
  const images = pickImages(printing.images);
  if (images) entry.images = images;
  return entry;
}

/**
 * `entry` (mutated) with its versions as its last key (#880): the catalog printing's `finishes`,
 * which the merge copies as it is, Both included, else the ones `stored` already holds, which
 * it never removes. Returns `entry`.
 */
const withVersions = (entry, printing, stored) => placeFinishes(entry, printing.finishes ?? stored);

/** What an entry holds beyond its fields: its versions and its art. */
const ENTRY_FACTS = [
  (entry) => entry.finishes?.join(),
  (entry) => entry.images?.full,
  (entry) => entry.images?.thumbnail,
];

/** Same fields, versions and art: the stored entry stays, with any hashes a local image build injected. */
function sameEntry(stored, entry) {
  return (
    ENTRY_FIELDS.every((field) => stored[field] === entry[field]) &&
    ENTRY_FACTS.every((fact) => fact(stored) === fact(entry))
  );
}

/** Who holds each id a promo can't take: every card, and every printing but the promos. */
function idOwners(cards) {
  const owners = new Map();
  for (const card of cards) {
    owners.set(card.id, card.fullName);
    for (const entry of (card.variants ?? []).filter((v) => !isPromo(v))) {
      owners.set(entry.id, `${card.fullName}'s ${entry.rarity}`);
    }
  }
  return owners;
}

/** Why a group can't merge onto its card: no card has its `baseId`, or that card is another. */
function cardProblem({baseId, fullName}, cardsById) {
  const card = cardsById.get(baseId);
  if (!card) return `no card ${baseId} (${fullName}) in allCards.json`;
  return card.fullName === fullName ? null : `card ${baseId} is ${card.fullName}, not ${fullName}`;
}

/** Why a group's printings can't merge: one isn't a promo, or its id is taken (see idOwners). */
function printingProblems({fullName, variants}, owners) {
  const problems = [];
  for (const {id, rarity} of variants) {
    if (!isPromo({rarity})) problems.push(`${id} on ${fullName} is ${rarity}, not a Special promo`);
    if (owners.has(id)) problems.push(`promo ${id} on ${fullName} has the id of ${owners.get(id)}`);
    owners.set(id, `${fullName}'s promo`);
  }
  return problems;
}

/**
 * Why a promo's versions can't ship (#880): a `finishes` field is the app's words for one
 * version, `["normal"]` or `["foil"]`, or for both, `["normal", "foil"]`, as admin's Edit card
 * writes a correction to Both. Asked of both sections, since every promo reaches collection mode.
 */
function finishesProblems({fold, noBaseCard = []}) {
  return [...fold, ...noBaseCard].flatMap(({fullName, variants}) =>
    variants
      .filter((printing) => printing.finishes !== undefined && !isFinishes(printing.finishes))
      .map(
        (printing) =>
          `promo ${printing.id} on ${fullName} has finishes ${JSON.stringify(printing.finishes)}`,
      ),
  );
}

function catalogProblems(cards, catalog) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const owners = idOwners(cards);
  const groupProblems = catalog.fold.flatMap((group) =>
    [cardProblem(group, cardsById), ...printingProblems(group, owners)].filter(Boolean),
  );
  return [...groupProblems, ...finishesProblems(catalog)];
}

/** What a merge does with a catalog printing, given the entry stored under its id, if any. */
function outcomeFor(stored, entry) {
  if (!stored) return 'added';
  return sameEntry(stored, entry) ? 'unchanged' : 'updated';
}

/**
 * Make `card`'s promos exactly `printings`, after its other printings; returns what changed. The
 * card's own versions, if it has any, stay its last key (#880).
 */
function syncPromos(card, printings) {
  const variants = card.variants ?? [];
  const stored = new Map(variants.filter(isPromo).map((entry) => [entry.id, entry]));
  const change = {card, added: [], updated: [], removed: [], unchanged: []};
  const promos = printings.map((printing) => {
    const entry = withVersions(toEntry(printing), printing, stored.get(printing.id)?.finishes);
    const outcome = outcomeFor(stored.get(entry.id), entry);
    const kept = outcome === 'unchanged' ? stored.get(entry.id) : entry;
    stored.delete(entry.id);
    change[outcome].push(kept);
    return kept;
  });
  change.removed.push(...stored.values());
  const merged = [...variants.filter((entry) => !isPromo(entry)), ...promos.sort(byPrintingOrder)];
  if (merged.length > 0) card.variants = merged;
  else delete card.variants;
  placeFinishes(card, card.finishes);
  return change;
}

/**
 * Make every card's promo entries exactly the catalog's (`cards` is mutated in place), or throw
 * without changing anything when the catalog can't merge. Returns, for each card that has or had
 * promos, the entries added, updated, removed and unchanged, plus the `noBaseCard` printings
 * skipped.
 */
export function mergePromoPrintings(cards, catalog) {
  const problems = catalogProblems(cards, catalog);
  if (problems.length > 0) {
    throw new Error(
      `The promo catalog can't merge into allCards.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  // Two groups for one card would add up rather than one hiding the other.
  const promosOf = new Map();
  for (const {baseId, variants} of catalog.fold) {
    promosOf.set(baseId, [...(promosOf.get(baseId) ?? []), ...variants]);
  }
  const changes = cards
    .filter((card) => promosOf.has(card.id) || (card.variants ?? []).some(isPromo))
    .map((card) => syncPromos(card, promosOf.get(card.id) ?? []));
  const waiting = catalog.noBaseCard ?? [];
  return {
    changes,
    skipped: {printings: waiting.flatMap((group) => group.variants).length, cards: waiting.length},
  };
}

/**
 * Every promo in the catalog as collection mode lists it (#805), a pocket each in its promo
 * set's binder: the folded ones and the waiting ones alike, by promo set and then number. They
 * are written to `apps/web/public/data/collection/promos.json`, which LorcanaJSON's own promo
 * cards no longer reach (collectionData.mjs leaves them out).
 *
 * Each is a collection entry (`COLLECTION_FIELDS`), the card's name, `baseId`: the card whose
 * text the promo reprints, a Core card for `fold`, a pre-Core collection card for `noBaseCard`,
 * and last, its versions (#880): the catalog's, else those `kept` holds for its id, the file's
 * own, which a run never removes. A promo whose card no dataset holds yet has no `baseId`
 * (Hades - Dark Usurper, whose card is in Set 15), so the binder names its pocket until the card
 * arrives.
 */
export function collectionPromos(catalog, kept = new Map()) {
  const folded = catalog.fold.map(({baseId, fullName, variants}) => ({baseId, fullName, variants}));
  const waiting = (catalog.noBaseCard ?? []).map(({lorcanaJsonBaseId, fullName, variants}) => ({
    baseId: lorcanaJsonBaseId,
    fullName,
    variants,
  }));
  return [...folded, ...waiting]
    .flatMap(({baseId, fullName, variants}) =>
      variants.map((printing) =>
        withVersions(
          {...toEntry(printing, COLLECTION_FIELDS), fullName, ...(baseId != null && {baseId})},
          printing,
          kept.get(String(printing.id)),
        ),
      ),
    )
    .sort(byPrintingOrder);
}

/**
 * Why the collection's promos can't ship: one names a card no dataset holds, or a card by
 * another name. Either would leave its pocket waiting for a card that will never come.
 */
export function promoBaseProblems(promos, cards) {
  const names = new Map(cards.map((card) => [String(card.id), card.fullName]));
  return promos.flatMap(({id, fullName, baseId}) => {
    if (baseId === undefined) return [];
    const name = names.get(String(baseId));
    if (name === undefined)
      return [`promo ${id} (${fullName}) reprints card ${baseId}, which no dataset holds`];
    return name === fullName
      ? []
      : [`promo ${id} (${fullName}) reprints card ${baseId}, which is ${name}`];
  });
}
