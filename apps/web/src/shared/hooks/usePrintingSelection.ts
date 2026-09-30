import {useState} from 'react';
import type {LorcanaCard, VariantRarity} from 'inkweave-synergy-engine';
import {trackEvent} from '../lib/analytics';

/** One printing of a card: its Standard art, or an Epic/Enchanted/Iconic variant (#625). */
export interface Printing {
  /** 'standard', or the variant's id. */
  key: string;
  /** What the printing switcher shows: "Standard", or the variant's rarity. */
  label: string;
  /** Absent for the Standard printing. */
  rarity?: VariantRarity;
  imageUrl?: string;
}

/** Accessible name for a printing's image: the card name, plus the rarity for a variant. */
export function printingAlt(card: LorcanaCard, printing: Printing): string {
  return printing.rarity ? `${card.fullName}, ${printing.rarity} printing` : card.fullName;
}

/** Records a view of a variant printing; the Standard printing is the card itself, not a view. */
function recordView(card: LorcanaCard, printing: Printing, surface: 'card_page' | 'modal') {
  if (printing.rarity) {
    trackEvent('card_printing_view', {cardId: card.id, rarity: printing.rarity, surface});
  }
}

/** A card's printings: its Standard art first, then each Epic/Enchanted/Iconic variant. */
export function printingsOf(card: LorcanaCard): Printing[] {
  const standard: Printing = {key: 'standard', label: 'Standard', imageUrl: card.imageUrl};
  const variants = (card.variants ?? []).map((v): Printing => ({
    key: v.id,
    label: v.rarity,
    rarity: v.rarity,
    imageUrl: v.imageUrl,
  }));
  return [standard, ...variants];
}

/**
 * The printing index selected for `cardId`, 0 (Standard) until one is selected. Every card
 * starts on its Standard printing: paging to another card drops the selection, and so does
 * `resetWhen` (the modal closing, or entering a comparison, which always shows base art), so
 * the Standard printing is back once it clears. The render-time reset is the same pattern as
 * the modal's `useCardTranslation`.
 */
function useCardSelection(cardId: string, resetWhen: boolean) {
  const [selected, setSelected] = useState<{cardId: string; index: number} | null>(null);
  const keep = !resetWhen && selected?.cardId === cardId;
  if (selected && !keep) setSelected(null);
  const select = (next: number) => setSelected(next === 0 ? null : {cardId, index: next});
  return {selectedIndex: keep ? selected.index : 0, select};
}

/**
 * Which printing of `card` is shown (see useCardSelection for when it resets to Standard),
 * and the `card_printing_view` it records, once per variant a visitor settles on: `pick` (a
 * pill, already settled) records, and so does `settle` (the strip at rest after a swipe, from
 * PrintingCarousel's `onSettle`). `select` only follows the strip's live index as a swipe
 * crosses printings, so it records nothing.
 */
export function usePrintingSelection(
  card: LorcanaCard,
  {resetWhen = false, surface}: {resetWhen?: boolean; surface: 'card_page' | 'modal'},
) {
  const {selectedIndex, select} = useCardSelection(card.id, resetWhen);
  const printings = printingsOf(card);
  // A selection past this card's printings falls back to Standard.
  const index = selectedIndex < printings.length ? selectedIndex : 0;
  const settle = (at: number) => recordView(card, printings[at], surface);
  const pick = (next: number) => {
    if (next === index) return;
    select(next);
    settle(next);
  };
  return {printings, index, select, pick, settle, current: printings[index]};
}
