import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {byDisplayOrder} from '../../shared/hooks/usePrintingSelection';
import type {CollectionPromo} from './collectionPromos';

/*
 * A pre-Core card's printings (#891). The card window's printing switcher (`printingsOf`) reads
 * nothing but a card's `variants`, which the scripts fold into allCards.json for a Core card
 * (#625, #805). The collection dataset keeps sets 1-8 flat instead: a printing is a card of its
 * own in its set's chunk, naming its card in `baseId` (#796), and a promo is an entry of
 * `collection/promos.json` that names its card the same way. Gathered here as the collection
 * loads, they give a pre-Core card the switcher a Core card has.
 *
 * The binder keeps its pockets as they were: `withPrintingCards` passes over a printing the pool
 * already holds as a card, and over every promo, whose pocket comes from the promo list.
 */

/** A chunk card that reprints another: it names that card, and has a rarity of its own. */
type ChunkPrinting = LorcanaCard & {baseId: string; rarity: string};

const isChunkPrinting = (card: LorcanaCard): card is ChunkPrinting =>
  card.baseId !== undefined && card.rarity !== undefined;

/** A promo whose card is out: one naming none waits for it (Hades - Dark Usurper). */
const namesItsCard = (promo: CollectionPromo): promo is CollectionPromo & {baseId: string} =>
  promo.baseId !== undefined;

/** A chunk card that reprints another, as that card's `variants` hold it. */
function chunkPrinting(card: ChunkPrinting): CardPrinting {
  return {
    id: card.id,
    rarity: card.rarity,
    number: card.setNumber,
    imageUrl: card.imageUrl,
    imageHashSm: card.imageHashSm,
    finishes: card.finishes,
  };
}

/** A promo as its card's `variants` hold it: the printing alone, without its card's name and id. */
function promoPrinting(promo: CollectionPromo): CardPrinting {
  return {
    id: promo.id,
    rarity: promo.rarity,
    number: promo.number,
    imageUrl: promo.imageUrl,
    imageHashSm: promo.imageHashSm,
    scanLanguage: promo.scanLanguage,
    promoGrouping: promo.promoGrouping,
    finish: promo.finish,
    finishes: promo.finishes,
    artVariant: promo.artVariant,
    printedName: promo.printedName,
  };
}

/** Every printing among `cards` and `promos`, under the id of the card it reprints. */
function printingsByCard(
  cards: readonly LorcanaCard[],
  promos: readonly CollectionPromo[],
): Map<string, CardPrinting[]> {
  const byCard = new Map<string, CardPrinting[]>();
  const add = (cardId: string, printing: CardPrinting) => {
    byCard.set(cardId, [...(byCard.get(cardId) ?? []), printing]);
  };
  for (const card of cards.filter(isChunkPrinting)) add(card.baseId, chunkPrinting(card));
  for (const promo of promos.filter(namesItsCard)) add(promo.baseId, promoPrinting(promo));
  return byCard;
}

/**
 * The collection's cards with each pre-Core card's printings in its `variants`, in the
 * switcher's order (`byDisplayOrder`): its set's printings of it by number, then its promos. A
 * printing that names a Core card (a Core set's chunk printing, or a Core card's promo) finds no
 * card among `cards`, so it is passed over: allCards.json gives a Core card its own.
 */
export function withPreCoreVariants(
  cards: LorcanaCard[],
  promos: readonly CollectionPromo[],
): LorcanaCard[] {
  const byCard = printingsByCard(cards, promos);
  return cards.map((card) => {
    const variants = byCard.get(card.id);
    return variants ? {...card, variants: variants.sort(byDisplayOrder)} : card;
  });
}
