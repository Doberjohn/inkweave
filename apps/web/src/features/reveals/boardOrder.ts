import type {CardPrinting, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {INK_BASE} from '../../shared/constants';
import {PER_INK} from './setComposition';
import type {SpecialSlot} from './useRevealProgress';

/*
 * The order an ink board shows its cards in: the mosaic's slots and the special printings'
 * lineup. The mosaic lays its cards out by it, and the card modal's arrows step through it
 * (owner, 2026-10-08), so the two cannot disagree.
 *
 * A card's slot is `number - INK_BASE[ink]` (the first collector number of the ink's block,
 * derived from PER_INK in shared/constants/revealSet.ts), so cards read across in true set
 * order and unrevealed numbers show as gaps in the right place rather than trailing off the end.
 */

/** The card's absolute slot from its collector number, or -1 if it can't claim one. */
function slotFor(card: LorcanaCard, base: number, slotCount: number): number {
  if (card.setNumber == null) return -1;
  const slot = card.setNumber - base;
  return slot >= 0 && slot < slotCount ? slot : -1;
}

/** Empty slot indices, highest first — where leftover cards spill in. */
function emptySlotsFromEnd(placed: (LorcanaCard | undefined)[]): number[] {
  const empty: number[] = [];
  for (let i = placed.length - 1; i >= 0; i--) {
    if (placed[i] == null) empty.push(i);
  }
  return empty;
}

/**
 * Lay the revealed cards into the ink's `slotCount` slots by collector number.
 * In-range numbered cards (number-base ∈ [0,slotCount)) claim their exact slot.
 * Anything that can't be placed absolutely — cards numbered outside the block or
 * with no number — fills the remaining gaps from the end so every revealed card
 * still shows.
 */
export function placeCards(ink: Ink, cards: LorcanaCard[], slotCount: number): (LorcanaCard | undefined)[] {
  const placed: (LorcanaCard | undefined)[] = new Array(slotCount).fill(undefined);
  const base = INK_BASE[ink];
  const leftovers: LorcanaCard[] = [];

  for (const card of cards) {
    const slot = slotFor(card, base, slotCount);
    if (slot >= 0 && placed[slot] == null) {
      placed[slot] = card;
    } else {
      leftovers.push(card);
    }
  }

  // Spill outliers / numberless cards into the remaining gaps from the end.
  const empty = emptySlotsFromEnd(placed);
  leftovers.forEach((card, i) => {
    if (i < empty.length) placed[empty[i]] = card;
  });
  return placed;
}

/** The mosaic's revealed cards in the order it shows them, slot by slot. */
export function mosaicOrder(ink: Ink, cards: LorcanaCard[]): LorcanaCard[] {
  return placeCards(ink, cards, PER_INK[ink]).filter((card): card is LorcanaCard => card !== undefined);
}

/**
 * The revealed special printings in lineup order: each one's base card, and the printing it
 * opens on. A card shown twice (two printings of one card) keeps its first: the modal's arrows
 * find their place by card id.
 */
export function specialsOrder(slots: SpecialSlot[]): {ids: string[]; printingFor: (cardId: string) => string | undefined} {
  const printingOf = new Map<string, string>();
  for (const {card, printing} of revealedSlots(slots)) {
    if (!printingOf.has(card.id)) printingOf.set(card.id, printing.id);
  }
  return {ids: [...printingOf.keys()], printingFor: (cardId) => printingOf.get(cardId)};
}

/** The slots whose printing has been revealed, each with its base card. */
function revealedSlots(slots: SpecialSlot[]): {card: LorcanaCard; printing: CardPrinting}[] {
  return slots.flatMap(({card, printing}) => (card && printing ? [{card, printing}] : []));
}
