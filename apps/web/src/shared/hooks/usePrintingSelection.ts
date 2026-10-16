import {useState} from 'react';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {isAltArtRarity} from '../../features/cards/loader';
import {trackEvent} from '../lib/analytics';

/** One printing of a card: its Standard art, or one of its alternate printings (#625). */
export interface Printing {
  /** 'standard', or the variant's id. */
  key: string;
  /** What the printing switcher shows: "Standard", or the variant's `printingName`. */
  label: string;
  /** The variant's printed rarity; absent for the Standard printing. */
  rarity?: string;
  /** The variant's collector number; absent for the Standard printing. */
  number?: number;
  /** A promo's set as printed on the card ("P1" in 25/P1); absent on every other printing. */
  promoGrouping?: string;
  /** Only on promo twins that share a code, such as Kuzco's foil and non-foil 8/C1. */
  finish?: 'foil' | 'normal';
  imageUrl?: string;
  /** Language code ("it") of this printing's scan if not English; absent means English. */
  scanLanguage?: string;
}

/** What a printing is, which decides how the printing switcher names it (#802). */
export type PrintingKind = 'standard' | 'chase' | 'altFoil' | 'promo';

/** The rarity LorcanaJSON gives promos. */
const PROMO_RARITY = 'Special';

/**
 * A printing's kind, from its printed rarity: none for the Standard art, a chase rarity (Epic,
 * Enchanted, Iconic) with a symbol of its own, Special for a promo, and anything else for a
 * printing that keeps its base card's rarity (Violet Parr's Super Rare #247), an alt foil.
 */
export function printingKind(rarity: string | undefined): PrintingKind {
  if (rarity === undefined) return 'standard';
  if (isAltArtRarity(rarity)) return 'chase';
  return rarity === PROMO_RARITY ? 'promo' : 'altFoil';
}

/** What a promo twin's finish adds to its name: the collection parser's "normal" reads "non-foil". */
export const FINISH_WORD = {foil: 'foil', normal: 'non-foil'} as const;

type PrintingFacts = Pick<Printing, 'number' | 'promoGrouping' | 'finish'>;

/** A promo's code as printed on the card ("25/P1"), or its set alone while its number is unknown. */
export function promoCode({number, promoGrouping}: PrintingFacts): string {
  return number === undefined ? `${promoGrouping}` : `${number}/${promoGrouping}`;
}

/**
 * What the printing switcher calls an alternate printing (#802): a chase rarity by its name, a
 * promo by the code printed on it plus the finish that only twins carry, and a printing that
 * keeps its base card's rarity "Alt foil" (its number alone told nothing, #796).
 */
export function printingName(printing: PrintingFacts & {rarity: string}): string {
  const kind = printingKind(printing.rarity);
  if (kind === 'chase') return printing.rarity;
  if (kind === 'altFoil') return 'Alt foil';
  const code = promoCode(printing);
  return printing.finish ? `${code} ${FINISH_WORD[printing.finish]}` : code;
}

/**
 * What assistive tech hears for a printing (#802): its label, with an alt foil's collector
 * number added (a card could hold two) and a promo called one (its code alone means little
 * read aloud).
 */
export function printingSpokenName(printing: PrintingFacts & Pick<Printing, 'label' | 'rarity'>): string {
  const kind = printingKind(printing.rarity);
  if (kind === 'altFoil') return `Alt foil, #${printing.number}`;
  if (kind !== 'promo') return printing.label;
  const finish = printing.finish ? `, ${FINISH_WORD[printing.finish]}` : '';
  return `Promo ${promoCode(printing)}${finish}`;
}

/** Accessible name for a printing's image: the card name, plus the printing's name for a variant. */
export function printingAlt(card: LorcanaCard, printing: PrintingFacts & {rarity?: string}): string {
  const {rarity} = printing;
  return rarity ? `${card.fullName}, ${printingName({...printing, rarity})} printing` : card.fullName;
}

/**
 * The switcher's order (#802): the chase and alt foil printings by collector number, then the
 * promos by set and number. Promo numbers restart in every set, so they sort apart.
 */
function byDisplayOrder(a: CardPrinting, b: CardPrinting): number {
  const promosLast = Number(a.rarity === PROMO_RARITY) - Number(b.rarity === PROMO_RARITY);
  const bySet = (a.promoGrouping ?? '').localeCompare(b.promoGrouping ?? '', undefined, {numeric: true});
  return promosLast || bySet || a.number - b.number;
}

/** Records a view of a variant printing; the Standard printing is the card itself, not a view. */
function recordView(card: LorcanaCard, printing: Printing, surface: 'card_page' | 'modal') {
  if (printing.rarity) {
    trackEvent('card_printing_view', {cardId: card.id, rarity: printing.rarity, surface});
  }
}

/**
 * A card's printings: its Standard art first, then each alternate printing in display order
 * (`byDisplayOrder`). Each carries its own scan's language, since a variant can be revealed
 * abroad first (#681).
 */
export function printingsOf(card: LorcanaCard): Printing[] {
  const standard: Printing = {
    key: 'standard',
    label: 'Standard',
    imageUrl: card.imageUrl,
    scanLanguage: card.scanLanguage,
  };
  // Sorted on a copy: the card's own variants are shared card data.
  const variants = [...(card.variants ?? [])].sort(byDisplayOrder).map((v): Printing => ({
    key: v.id,
    label: printingName(v),
    rarity: v.rarity,
    number: v.number,
    promoGrouping: v.promoGrouping,
    finish: v.finish,
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
