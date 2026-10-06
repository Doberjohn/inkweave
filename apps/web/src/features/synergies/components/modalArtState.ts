import {createContext, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {hasForeignScan, usePrintingSelection, type Printing} from '../../../shared/hooks';

// The card overview modal's art state: the "See translation" overlay (#623) and the printing
// shown (#625). Each sits in a context because the header (desktop controls) and the card
// image (art, overlay, mobile controls) both read it; ModalCardArt.tsx holds those views.

/** "See translation" for a card with a non-English scan among its printings; else null. */
export interface CardTranslationState {
  shown: boolean;
  toggle: () => void;
  /** The language of the scan on screen; undefined while it is English, which hides the toggle. */
  language: string | undefined;
}

/** Shared by the header (desktop toggle) and the card image (panel, mobile toggle). */
export const CardTranslationContext = createContext<CardTranslationState | null>(null);

/**
 * Every card opens on its scan: paging away clears the translation (so paging back starts on
 * the scan too), and so does closing, for a host that keeps the modal mounted. So does an
 * English printing coming on screen, whatever brought it (a pill, a swipe, a comparison's
 * reset): a variant can be a foreign scan too (#681), so the translation follows the printing.
 */
export function useCardTranslation(
  card: LorcanaCard,
  isOpen: boolean,
  printing: CardPrintingState | null,
): CardTranslationState | null {
  const [translatedId, setTranslatedId] = useState<string | null>(null);
  const language = printing ? printing.printings[printing.index].scanLanguage : card.scanLanguage;
  const keepId = isOpen && language ? card.id : null;
  if (translatedId !== null && translatedId !== keepId) setTranslatedId(null);
  if (!hasForeignScan(card)) return null;
  const shown = translatedId === card.id;
  return {shown, language, toggle: () => setTranslatedId(shown ? null : card.id)};
}

/** The printing switcher's state (#625); null for a card with a single printing. */
export interface CardPrintingState {
  printings: Printing[];
  index: number;
  /** The strip following a swipe live: shows the printing, records nothing. */
  select: (index: number) => void;
  /** A pill pick: shows the printing and records the view. */
  pick: (index: number) => void;
  /** The strip came to rest on another printing after a swipe: records the view. */
  settle: (index: number) => void;
  /** A comparison shows the base art, so its strip can't be swiped. */
  locked: boolean;
}

/** Shared by the header (desktop pills) and the card image (the strip, mobile pills). */
export const CardPrintingContext = createContext<CardPrintingState | null>(null);

/**
 * Which printing the modal shows. A card opens on its Standard printing, or on the printing it
 * was opened with (`initialPrintingId`, from a reveals board special slot), and a comparison
 * always shows the base art, so closing, paging and entering a comparison all reset it (and a
 * comparison locks the strip). The translation reads it (useCardTranslation), so it is called
 * first.
 */
export function useModalPrinting(
  card: LorcanaCard,
  {
    isOpen,
    inComparison,
    initialPrintingId = null,
  }: {
    isOpen: boolean;
    inComparison: boolean;
    initialPrintingId?: string | null;
  },
): CardPrintingState | null {
  const {printings, index, select, pick, settle} = usePrintingSelection(card, {
    resetWhen: !isOpen || inComparison,
    surface: 'modal',
    initialKey: initialPrintingId,
  });
  if (printings.length < 2) return null;
  return {printings, index, select, pick, settle, locked: inComparison};
}
