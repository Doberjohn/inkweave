import {createContext, useLayoutEffect, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {hasForeignScan, usePrintingSelection, type Printing} from '../../../shared/hooks';

// The card overview modal's art state: the "See translation" overlay (#623), the printing
// shown (#625) and the row under the card that a page fills (#826). Each sits in a context
// because the header (the title, desktop's toggle) and the card image (art, overlay, mobile's
// toggle) read it; ModalCardArt.tsx holds those views.

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
 * English printing coming on screen, whatever brought it (a swipe, a peek, a comparison's
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
  /** The strip turning to another printing, live: shows the printing, records nothing. */
  select: (index: number) => void;
  /** The strip came to rest on another printing, or a peek or a key turned it: records the view. */
  settle: (index: number) => void;
  /** A comparison shows the base art, so its strip can't be turned. */
  locked: boolean;
}

/** Shared by the header (the title names the printing on show) and the card image (the strip). */
export const CardPrintingContext = createContext<CardPrintingState | null>(null);

/**
 * Which printing the modal shows. A card opens on its Standard printing, or on the printing the
 * open names for it (`initialPrintingId`: a reveals board special slot, or for every card the
 * arrows reach, the art its Browse tile showed). A comparison always shows the base art, so
 * closing and entering a comparison reset it (and a comparison locks the strip). The
 * translation reads it (useCardTranslation), so it is called first.
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
  const {printings, index, select, settle} = usePrintingSelection(card, {
    resetWhen: !isOpen || inComparison,
    surface: 'modal',
    initialKey: initialPrintingId,
  });
  if (printings.length < 2) return null;
  return {printings, index, select, settle, locked: inComparison};
}

type Attach = (el: HTMLElement | null) => void;

/** The window's row under its card (#826), and its friends slot, as `CopiesSlot` and `FriendsSlot` need them. */
export interface CopiesSlotState {
  /** Hands the slot's element to its host, and null once it goes: `CardModalContext`'s `copiesSlot`. */
  attach: Attach;
  /** The same for the friends slot, beside the set's logo on a computer, under the copies on a phone; absent where the host keeps none. */
  attachFriends?: Attach;
  /** The window's own key handling (the Tab trap, the arrows' paging), for keys pressed in the slot. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/** Null where nothing hosts a slot: a story, a test, or a window outside `CardModalProvider`. */
export const CopiesSlotContext = createContext<CopiesSlotState | null>(null);

/** The row under the card and the friends slot, wired to the window's own keys, or null where no page holds the row. */
export function pickCopiesSlot(
  attach: Attach | undefined,
  attachFriends: Attach | undefined,
  onKeyDown: (e: KeyboardEvent) => void,
): CopiesSlotState | null {
  return attach ? {attach, attachFriends, onKeyDown} : null;
}

/**
 * Tells the host which printing is on show (#826): a variant's id, or null for the card's own,
 * so a page filling the window's row follows each turn of the strip. In a layout effect, so
 * what the page draws from it is corrected before the browser paints.
 */
export function useReportShownPrinting(
  printing: CardPrintingState | null,
  report: ((printingId: string | null) => void) | undefined,
) {
  const key = printing ? printing.printings[printing.index].key : null;
  const shownId = key === 'standard' ? null : key;
  useLayoutEffect(() => {
    report?.(shownId);
  }, [shownId, report]);
}
