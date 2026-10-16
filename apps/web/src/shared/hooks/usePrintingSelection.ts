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
  /** Language code ("it") of this printing's scan if not English; absent means English. */
  scanLanguage?: string;
}

/** Accessible name for a printing's image: the card name, plus the rarity for a variant. */
export function printingAlt(card: LorcanaCard, printing: Pick<Printing, 'rarity'>): string {
  return printing.rarity ? `${card.fullName}, ${printing.rarity} printing` : card.fullName;
}

/** Records a view of a variant printing; the Standard printing is the card itself, not a view. */
function recordView(card: LorcanaCard, printing: Printing, surface: 'card_page' | 'modal') {
  if (printing.rarity) {
    trackEvent('card_printing_view', {cardId: card.id, rarity: printing.rarity, surface});
  }
}

/**
 * A card's printings: its Standard art first, then each Epic/Enchanted/Iconic variant. Each
 * carries its own scan's language, since a variant can be revealed abroad first (#681).
 */
export function printingsOf(card: LorcanaCard): Printing[] {
  const standard: Printing = {
    key: 'standard',
    label: 'Standard',
    imageUrl: card.imageUrl,
    scanLanguage: card.scanLanguage,
  };
  const variants = (card.variants ?? []).map((v): Printing => ({
    key: v.id,
    label: v.rarity,
    rarity: v.rarity,
    imageUrl: v.imageUrl,
    scanLanguage: v.scanLanguage,
  }));
  return [standard, ...variants];
}

/**
 * True when any printing of the card is a non-English scan (#681): the card modal then offers
 * "See translation", and its loading shell holds the toggle's place.
 */
export function hasForeignScan(card: LorcanaCard): boolean {
  return printingsOf(card).some((p) => p.scanLanguage);
}

/**
 * The printing index shown for `cardId`. Each card starts on `initialIndex` as it arrives,
 * opened or paged to: the printing the open names for it, else its Standard printing (0).
 * The same card arrives again when it is reached with another printing to start on: a
 * binder holds a card and its printings as pockets side by side under Name A-Z, and paging
 * between them keeps the id. `resetWhen` (the modal closing, or entering a comparison,
 * which always shows base art) puts the card back on Standard for good: its start applies
 * again only once another card has arrived. The render-time updates are the same pattern
 * as the modal's `useCardTranslation`.
 */
function useCardSelection(cardId: string, resetWhen: boolean, initialIndex: number) {
  const start = resetWhen ? 0 : Math.max(initialIndex, 0);
  const [selected, setSelected] = useState({cardId, initialIndex, index: start});
  const arrived = selected.cardId !== cardId || selected.initialIndex !== initialIndex;
  if (arrived) setSelected({cardId, initialIndex, index: start});
  else if (resetWhen && selected.index !== 0) setSelected({cardId, initialIndex, index: 0});
  const select = (next: number) => setSelected({cardId, initialIndex, index: next});
  return {selectedIndex: arrived || resetWhen ? start : selected.index, select};
}

/**
 * Which printing of `card` is shown (see useCardSelection for when it resets to Standard),
 * and the `card_printing_view` it records, once per variant a visitor settles on: `pick` (a
 * pill, already settled) records, and so does `settle` (the strip at rest after a swipe, from
 * PrintingCarousel's `onSettle`). `select` only follows the strip's live index as a swipe
 * crosses printings, so it records nothing. `initialKey` (a variant's id) starts the card on
 * that printing instead of Standard: the reveals board opens its special slots that way, and
 * Browse names one for each card the modal's arrows reach (CardModalContext's `printingFor`).
 */
export function usePrintingSelection(
  card: LorcanaCard,
  {
    resetWhen = false,
    surface,
    initialKey = null,
  }: {resetWhen?: boolean; surface: 'card_page' | 'modal'; initialKey?: string | null},
) {
  const printings = printingsOf(card);
  const initialIndex = printings.findIndex((printing) => printing.key === initialKey);
  const {selectedIndex, select} = useCardSelection(card.id, resetWhen, initialIndex);
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
