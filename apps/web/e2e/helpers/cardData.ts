import fs from 'node:fs';
import path from 'node:path';

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

/**
 * A promo set whose numbers skip one, so its binder holds an open pocket (#805), with its
 * promos that have a card, each a pocket of its own, and the first open pocket's code ("19/C2"),
 * which the pocket shows whatever it says about why it is open. The first in the file's order.
 */
export function promoSetWithOpenPocket(): {code: string; promos: string[]; openPocket: string} {
  for (const code of new Set(collectionPromos.map((promo) => promo.promoGrouping))) {
    const promos = collectionPromos.filter((promo) => promo.promoGrouping === code);
    const numbers = new Set(promos.flatMap((promo) => (promo.number === undefined ? [] : [promo.number])));
    const gap = Array.from({length: Math.max(0, ...numbers)}, (_, i) => i + 1).find((n) => !numbers.has(n));
    if (gap !== undefined) {
      return {
        code,
        promos: promos.filter((promo) => promo.baseId !== undefined).map((promo) => String(promo.id)),
        openPocket: `${gap}/${code}`,
      };
    }
  }
  throw new Error('Fixture broken: every promo set in promos.json numbers its promos without a gap');
}
