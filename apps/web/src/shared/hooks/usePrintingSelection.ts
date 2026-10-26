import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PROMO_RARITY, printingsOf, promoCode, type Printing} from 'inkweave-ui/lib/printings';
import {SET_PRINTED_SIZES} from '../constants';
import {trackEvent} from '../lib/analytics';

/** A number out of the card's set's printed size, "52/204"; none when either is unknown. */
function numberOutOfSet(card: LorcanaCard, number: number | undefined): string | undefined {
  const size = SET_PRINTED_SIZES[card.setCode ?? ''];
  return number === undefined || size === undefined ? undefined : `${number}/${size}`;
}

/**
 * The number printed on a card's printing (owner, 2026-10-20: the card window's header shows
 * it): the Standard printing's collector number out of its set's size, "52/204", a chase or
 * alt foil printing's own number, "223/204", and a promo's code, "25/P1", as is a promo card's
 * own (#805). None when it is not known.
 */
export function printedCardNumber(card: LorcanaCard, printing?: Printing): string | undefined {
  if (printing?.rarity === undefined) {
    if (card.rarity !== PROMO_RARITY) return numberOutOfSet(card, card.setNumber);
    return promoCode({number: card.setNumber, promoGrouping: card.setCode});
  }
  return printing.promoGrouping === undefined ? numberOutOfSet(card, printing.number) : promoCode(printing);
}

/** Records a view of a variant printing; the Standard printing is the card itself, not a view. */
function recordView(card: LorcanaCard, printing: Printing, surface: 'card_page' | 'modal') {
  if (printing.rarity) {
    trackEvent('card_printing_view', {
      cardId: card.id,
      printingId: printing.key,
      rarity: printing.rarity,
      surface,
    });
  }
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
 * and the `card_printing_view` it records, once per variant a visitor settles on: `settle`
 * records (PrintingCarousel's `onSettle`: each turn, by a throw, a swipe, a peek or an arrow
 * key). `select` only follows the printing in front, so it records nothing. `initialKey` (a
 * variant's id) starts the card on that printing instead of Standard: the reveals board opens
 * its special slots that way, and Browse names one for each card the modal's arrows reach
 * (CardModalContext's `printingFor`).
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
  return {printings, index, select, settle, current: printings[index]};
}
