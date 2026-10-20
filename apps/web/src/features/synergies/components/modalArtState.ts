import {createContext, useLayoutEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {hasForeignScan, usePrintingSelection, type Printing} from '../../../shared/hooks';
import {ART_CONTROLS_HEIGHT, hasArtControls} from './cardOverviewModalStyles';

// The card overview modal's art state: the "See translation" overlay (#623), the printing
// shown (#625), and the slot under the card that a page may fill (#826). Each sits in a
// context because the header (desktop controls) and the card image (art, overlay, controls
// under it) read them; ModalCardArt.tsx holds those views.

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
  const {printings, index, select, pick, settle} = usePrintingSelection(card, {
    resetWhen: !isOpen || inComparison,
    surface: 'modal',
    initialKey: initialPrintingId,
  });
  if (printings.length < 2) return null;
  return {printings, index, select, pick, settle, locked: inComparison};
}

/** The window's slot under its card (#826), as `CopiesSlot` needs it. */
export interface CopiesSlotState {
  /** Hands the slot's element to its host, and null once it goes: `CardModalContext`'s `copiesSlot`. */
  attach: (el: HTMLElement | null) => void;
  /** The window's own key handling (the Tab trap, the arrows' paging), for keys pressed in the slot. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/** Null where nothing hosts a slot: a story, a test, or a window outside `CardModalProvider`. */
export const CopiesSlotContext = createContext<CopiesSlotState | null>(null);

/**
 * The height of what sits under a desktop card (`DesktopArtControls`), which the art shrinks
 * to leave free (`artScaleTransform`); 0 on a phone, whose controls sit in the column's flow.
 * Until it is measured, the pills' row for a card with printings, as the loading shell
 * reserves, so the art keeps its size when the window takes over from the shell.
 *
 * Measured at once, then again whenever it changes: a page filling the window's slot (#826),
 * the pills coming or going as the arrows page. The observer's update is flushed in its own
 * callback, which runs before the browser paints, so the art never shows a frame overlapped by
 * a block it has not yet shrunk for.
 *
 * The element is held in state, not a ref, so measuring follows it: a window that opens on a
 * phone and is widened to desktop mounts the controls only then, after a ref's mount-time
 * effect has come and gone.
 */
export function useUnderArtHeight(card: LorcanaCard, isMobile: boolean) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useLayoutEffect(() => {
    // Where nothing can observe it there is no layout to read either (jsdom): `initial` stands.
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setMeasured(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(() => {
      // A detached element measures 0, which says nothing about the window.
      if (el.isConnected) flushSync(measure);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  const initial = hasArtControls(card) ? ART_CONTROLS_HEIGHT : 0;
  return {underArtRef: setEl, below: isMobile ? 0 : (measured ?? initial)};
}
