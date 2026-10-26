import fs from 'node:fs';
import path from 'node:path';
import {cardPath} from 'inkweave-synergy-engine/card';

/**
 * Test-side lookups into the precomputed card database (`public/data/allCards.json`).
 *
 * Used by specs that need a card's display name from its id — e.g. to filter the Browse grid to a
 * specific card with `?q=` and open the CardOverviewModal on it. Reading the name from the data
 * file (rather than hardcoding it) keeps fixtures drift-safe: if a card leaves the pool, the
 * lookup throws a clear "not in allCards.json" error instead of a mystery timeout.
 */

interface RawCard {
  id: number | string;
  fullName: string;
  setCode?: string;
  type?: string;
  /** Collector number. */
  number?: number;
  variants?: {id: number | string; rarity: string; number?: number; promoGrouping?: string}[];
}

const allCards = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/allCards.json'), 'utf8'),
) as {cards: RawCard[]};

/** A promo as collection mode lists it (`public/data/collection/promos.json`, #805). */
interface RawPromo {
  id: number;
  number?: number;
  promoGrouping: string;
  /** Absent while no dataset holds the promo's card: its pocket waits for it. */
  baseId?: number;
}

const collectionPromos = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/collection/promos.json'), 'utf8'),
) as RawPromo[];

function cardById(id: string): RawCard {
  const card = allCards.cards.find((c) => String(c.id) === id);
  if (!card) {
    throw new Error(`Fixture broken: card ${id} is not in allCards.json (did it leave the pool?)`);
  }
  return card;
}

/** The unique fullName ("Name - Version") for a card id. Throws if the card left the pool. */
export function cardFullNameById(id: string): string {
  return cardById(id).fullName;
}

/** The rarities of a card's alternate printings (#625), e.g. ['Enchanted']; [] for none. */
export function cardVariantRarities(id: string): string[] {
  return (cardById(id).variants ?? []).map((v) => v.rarity);
}

/** The printed codes of a card's promo printings (#805), in the data's order, e.g. ['25/P1', '15/P2']. */
export function cardPromoCodes(id: string): string[] {
  return (cardById(id).variants ?? []).flatMap((v) =>
    v.promoGrouping === undefined ? [] : [`${v.number}/${v.promoGrouping}`],
  );
}

/** The first set of the Core format (`MIN_CORE_SET` in the engine). */
const MIN_CORE_SET = 9;

/**
 * The Core character with the shortest full name: one line in any heading, whatever fonts the
 * browser has. The card page's loading layout draws the name on one line (#914).
 */
export function shortestNamedCoreCharacter(): {id: string; fullName: string} {
  const card = allCards.cards
    .filter((c) => Number(c.setCode) >= MIN_CORE_SET && c.type === 'Character')
    .reduce((shortest, c) => (c.fullName.length < shortest.fullName.length ? c : shortest));
  return {id: String(card.id), fullName: card.fullName};
}

/**
 * The card with synergies whose full name is the shortest: in the card window on a phone its name
 * is narrower than its card, so the window's width comes from the card and the synergies alone.
 * Reads the synergy manifest (precompute's list of Core cards with a file) when called, inside a
 * test, so the specs importing this module still load on a checkout whose synergies the dev
 * server hasn't written yet.
 */
export function shortestNamedCardWithSynergies(): {id: string; fullName: string} {
  const manifest = path.resolve(process.cwd(), 'public/data/synergies/_manifest.json');
  const withSynergies = new Set<string>(JSON.parse(fs.readFileSync(manifest, 'utf8')));
  const card = allCards.cards
    .filter((c) => withSynergies.has(String(c.id)))
    .reduce((shortest, c) => (c.fullName.length < shortest.fullName.length ? c : shortest));
  return {id: String(card.id), fullName: card.fullName};
}

/** A name of plain words with the one " - " after its first: "Russell - Senior Wilderness Explorer". */
const PLAIN_NAME = /^[A-Z][a-z]+ - [A-Z][a-z]+( [A-Z][a-z]+)*$/;

/**
 * The Core character with the longest plainly spelled name (`PLAIN_NAME`), and its card page's
 * address: two lines in the phone heading, and spelled exactly by its slug, so the loading
 * header can take its lines (`cardNameHint`, #914).
 */
export function longestPlainNamedCoreCharacter(): {id: string; fullName: string; path: string} {
  const card = allCards.cards
    .filter((c) => Number(c.setCode) >= MIN_CORE_SET && c.type === 'Character' && PLAIN_NAME.test(c.fullName))
    .reduce((longest, c) => (c.fullName.length > longest.fullName.length ? c : longest));
  return {id: String(card.id), fullName: card.fullName, path: cardPath(card)};
}

/** Every card's full name and its card page's address (`cardPath`, slug and all). */
export function everyCardPage(): {fullName: string; path: string}[] {
  return allCards.cards.map((c) => ({fullName: c.fullName, path: cardPath(c)}));
}

/** The newest Core set: the one collection mode's binder opens on. */
export function newestCoreSet(): string {
  const codes = allCards.cards.map((c) => Number(c.setCode)).filter((code) => code >= MIN_CORE_SET);
  return String(Math.max(...codes));
}

/** A set's cards in collector order, as the binder's first pockets hold them. */
export function setCards(setCode: string): RawCard[] {
  return allCards.cards
    .filter((c) => c.setCode === setCode)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/**
 * The chase rarities, which the "Alt art cards" preset picks with the promos. A card's promos
 * are pockets of their promo sets (#805), so a set's binder holds only its chase printings.
 */
const ALT_ART = new Set(['Epic', 'Enchanted', 'Iconic']);

/**
 * A set's Epic, Enchanted and Iconic printings (#625), each a pocket of its own in the
 * binder, in the order their base cards come. Only those three: a printing that keeps its
 * base card's rarity (#796) is a pocket too, but no alt-art filter or preset picks it.
 */
export function setPrintings(setCode: string): {id: string; rarity: string}[] {
  return setCards(setCode).flatMap((c) =>
    (c.variants ?? []).filter((v) => ALT_ART.has(v.rarity)).map((v) => ({id: String(v.id), rarity: v.rarity})),
  );
}

/** A card of a collection chunk (`public/data/collection/{set}.json`, #553). */
interface RawChunkCard extends RawCard {
  rarity?: string;
  /** The card it is a printing of (#796): on a printing alone. */
  baseId?: number;
}

/** The sets outside Core, which the collection's chunks alone serve. */
const PRE_CORE_SETS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * A pre-Core card whose one printing in its set is an Enchanted, and that set (#891): a search
 * for its name narrows the set's binder to its two pockets, the card's and then the
 * Enchanted's. The first such card in set order, read from the chunks so the test follows the
 * data.
 */
export function preCoreCardWithEnchanted(): {setCode: string; fullName: string} {
  for (const setCode of PRE_CORE_SETS) {
    const file = path.resolve(process.cwd(), `public/data/collection/${setCode}.json`);
    const chunk = JSON.parse(fs.readFileSync(file, 'utf8')) as RawChunkCard[];
    const card = chunk.find((base) => {
      if (base.baseId !== undefined) return false;
      const named = chunk.filter((c) => c.fullName === base.fullName);
      const enchanted = named.some((c) => c.baseId === base.id && c.rarity === 'Enchanted');
      return named.length === 2 && enchanted;
    });
    if (card) return {setCode, fullName: card.fullName};
  }
  throw new Error('Fixture broken: no card of Sets 1-8 has an Enchanted printing in its set');
}

/** The binder's pockets per page and per spread (`PER_PAGE`, `PER_SPREAD` in binderGeometry.ts). */
const PAGE_POCKETS = 12;
const SPREAD_POCKETS = 24;

/** A promo set's open pockets (#805), and its promos that have a card. */
interface PromoSetPockets {
  code: string;
  /** Its promos that have a card, by id: each a pocket of its own, the count its binder's numbers show. */
  promos: string[];
  /** The numbers it skips, in order: each an open pocket, which shows its code and why it is open. */
  gaps: number[];
}

/**
 * Every promo set with an open pocket, in the file's order: one whose numbers skip one, or one
 * with a promo that waits for a card no dataset holds yet, whose pocket shows its scan, or its
 * code and name when the scan fails.
 */
export function promoSetsWithOpenPockets(): PromoSetPockets[] {
  return Array.from(new Set(collectionPromos.map((promo) => promo.promoGrouping))).flatMap((code) => {
    const promos = collectionPromos.filter((promo) => promo.promoGrouping === code);
    const numbers = new Set(promos.flatMap((promo) => (promo.number === undefined ? [] : [promo.number])));
    const gaps = Array.from({length: Math.max(0, ...numbers)}, (_, i) => i + 1).filter((n) => !numbers.has(n));
    const carded = promos.filter((promo) => promo.baseId !== undefined).map((promo) => String(promo.id));
    return gaps.length > 0 || carded.length < promos.length ? [{code, promos: carded, gaps}] : [];
  });
}

/**
 * The first promo set whose numbers skip one, so its binder holds an open pocket (#805), with
 * its promos that have a card, each a pocket of its own, the first open pocket's code ("19/C2"),
 * which the pocket shows whatever it says about why it is open, and the spread it is on, from
 * 1, the first opening on the front cover (#806).
 */
export function promoSetWithOpenPocket(): {code: string; promos: string[]; openPocket: string; openSpread: number} {
  const set = promoSetsWithOpenPockets().find(({gaps}) => gaps.length > 0);
  if (!set) throw new Error('Fixture broken: every promo set in promos.json numbers its promos without a gap');
  const [gap] = set.gaps;
  // The promos numbered below the first gap fill the pockets before it, and the front cover
  // takes a page first (#806). E2E imports no app code, so the page sizes are repeated here.
  const before = collectionPromos.filter(
    (promo) => promo.promoGrouping === set.code && promo.number !== undefined && promo.number < gap,
  ).length;
  return {
    code: set.code,
    promos: set.promos,
    openPocket: `${gap}/${set.code}`,
    openSpread: Math.floor((before + PAGE_POCKETS) / SPREAD_POCKETS) + 1,
  };
}
