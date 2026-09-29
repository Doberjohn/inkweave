import {createContext, useContext, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {usePrintingSelection, type Printing} from '../../../shared/hooks';
import {trackEvent} from '../../../shared/lib/analytics';

// The card overview modal's art state: the "See translation" overlay (#623) and the printing
// shown (#625). Each sits in a context because the header (desktop controls) and the card
// image (art, overlay, mobile controls) both read it; ModalCardArt.tsx holds those views.

/** A foreign-scan card's "See translation" state; null when the card's scan is English. */
export interface CardTranslationState {
  shown: boolean;
  toggle: () => void;
}

/** Shared by the header (desktop toggle) and the card image (panel, mobile toggle). */
export const CardTranslationContext = createContext<CardTranslationState | null>(null);

/**
 * Every card opens on its scan: paging away clears the translation (so paging back starts on
 * the scan too), and so does closing, for a host that keeps the modal mounted.
 */
export function useCardTranslation(
  card: LorcanaCard,
  isOpen: boolean,
): CardTranslationState | null {
  const [translatedId, setTranslatedId] = useState<string | null>(null);
  const keepId = isOpen ? card.id : null;
  if (translatedId !== null && translatedId !== keepId) setTranslatedId(null);
  if (!card.scanLanguage) return null;
  const shown = translatedId === card.id;
  return {shown, toggle: () => setTranslatedId(shown ? null : card.id)};
}

/** The printing switcher's state (#625); null for a card with a single printing. */
export interface CardPrintingState {
  printings: Printing[];
  index: number;
  select: (index: number) => void;
}

/** Shared by the header (desktop pills) and the card image (the strip, mobile pills). */
export const CardPrintingContext = createContext<CardPrintingState | null>(null);

/**
 * Which printing the modal shows. Every card opens on its Standard printing, and a comparison
 * always shows the base art, so closing, paging and entering a comparison all reset it. A
 * variant's art is an official English printing, so picking one turns the translation off.
 */
export function useModalPrinting(
  card: LorcanaCard,
  {
    isOpen,
    inComparison,
    translation,
  }: {isOpen: boolean; inComparison: boolean; translation: CardTranslationState | null},
): CardPrintingState | null {
  const {printings, index, select} = usePrintingSelection(card, {
    resetWhen: !isOpen || inComparison,
  });
  if (printings.length < 2) return null;
  const selectPrinting = (next: number) => {
    select(next);
    const {rarity} = printings[next];
    if (!rarity) return;
    if (translation?.shown) translation.toggle();
    trackEvent('card_printing_view', {cardId: card.id, rarity, surface: 'modal'});
  };
  return {printings, index, select: selectPrinting};
}

/** True while an Epic/Enchanted/Iconic printing is shown instead of the card's own scan. */
export function useVariantShown(): boolean {
  return (useContext(CardPrintingContext)?.index ?? 0) > 0;
}
