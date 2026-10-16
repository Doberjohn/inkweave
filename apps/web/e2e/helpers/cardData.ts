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
  variants?: {id: number | string; rarity: string}[];
}

const allCards = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/allCards.json'), 'utf8'),
) as {cards: RawCard[]};

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

/** The rarities the "Alt art cards" preset picks. */
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
