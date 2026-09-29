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
  variants?: {rarity: string}[];
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
